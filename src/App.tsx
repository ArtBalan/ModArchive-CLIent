import React, { useState, useEffect, useCallback } from "react";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import { Box, Text, useInput, useApp, Spacer } from "ink";
import {
  initDb,
  getTopArtists,
  getAllArtists,
  getRecentModules,
  searchModules,
  searchArtists,
  getModulesByArtist,
  getModulesByGenre,
  getAllGenres,
  getDbStats,
  setModuleLocalPath,
  setModuleFavorite,
  getFavorites,
  getDownloadedModules,
  Artist,
  ModuleWithArtist,
  Genre,
} from "./db";
import * as Player from "./player";

// ─── Downloader ──────────────────────────────────────────────────────────────

type DownloadStatus = {
  file: string;
  status: "downloading" | "converting" | "done" | "exists" | "error";
  error?: string;
};

function convertToFlac(
  srcPath: string,
  safeFile: string,
  onStatus: (s: DownloadStatus) => void,
): void {
  const { spawn, spawnSync } = require("child_process");
  const os = require("os");
  const flacPath = srcPath.replace(/\.[^.]+$/, ".flac");
  if (fs.existsSync(flacPath)) {
    log(`CONVERT SKIP: flac exists`);
    onStatus({ file: safeFile, status: "done" });
    return;
  }

  const openmptExe = (() => {
    const local = path.join(process.cwd(), "openmpt123.exe");
    return fs.existsSync(local) ? local : "openmpt123";
  })();

  // openmpt123 --render writes a .flac file next to the source by default,
  // but we want it in the same folder. Use --output to specify exact output path.
  // It renders directly to FLAC — no ffmpeg needed.
  const args = [
    "--render",
    "--output-type",
    "flac",
    "--samplerate",
    "44100",
    "--channels",
    "2",
    "--force",
    "--",
    srcPath,
  ];
  log(`CONVERT: ${openmptExe} ${args.join(" ")}`);
  onStatus({ file: safeFile, status: "converting" });

  const proc = spawn(openmptExe, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  proc.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString();
  });

  proc.on("exit", (code: number) => {
    log(
      `OPENMPT EXIT: code=${code}${stderr ? " stderr=" + stderr.slice(-300) : ""}`,
    );
    // Log all files in the output directory to see what openmpt123 actually created
    const dir = path.dirname(srcPath);
    try {
      const files = fs
        .readdirSync(dir)
        .filter((f: string) => f.endsWith(".flac") || f.endsWith(".wav"));
      log(`DIR CONTENTS (flac/wav): ${JSON.stringify(files)}`);
    } catch (e: any) {
      log(`DIR READ ERROR: ${e.message}`);
    }
    log(`EXPECTED FLAC: ${flacPath} exists=${fs.existsSync(flacPath)}`);
    if (code === 0 && fs.existsSync(flacPath)) {
      log(`CONVERT DONE: ${flacPath}`);
      onStatus({ file: safeFile, status: "done" });
    } else if (code === 0) {
      // openmpt123 may have created a differently-named file — find it
      const dir2 = path.dirname(srcPath);
      const base = path.basename(srcPath, path.extname(srcPath));
      try {
        const allFiles = fs.readdirSync(dir2);
        const created = allFiles.find(
          (f: string) => f.startsWith(base) && f.endsWith(".flac"),
        );
        if (created) {
          const actual = path.join(dir2, created);
          log(`RENAMING: ${actual} -> ${flacPath}`);
          fs.renameSync(actual, flacPath);
          onStatus({ file: safeFile, status: "done" });
        } else {
          log(`NO FLAC FOUND in ${dir2}: ${JSON.stringify(allFiles)}`);
          onStatus({
            file: safeFile,
            status: "error",
            error: "openmpt123 succeeded but no FLAC found",
          });
        }
      } catch (e: any) {
        onStatus({
          file: safeFile,
          status: "error",
          error: `Post-convert error: ${e.message}`,
        });
      }
    } else {
      try {
        fs.unlinkSync(flacPath);
      } catch (_) {}
      onStatus({
        file: safeFile,
        status: "error",
        error: `openmpt123 failed (code ${code}): ${stderr.slice(-100).trim()}`,
      });
    }
  });
  proc.on("error", (err: Error) => {
    log(`OPENMPT ERROR: ${err.message}`);
    onStatus({
      file: safeFile,
      status: "error",
      error: `openmpt123: ${err.message}`,
    });
  });
}

const LOG_FILE = path.join(process.cwd(), "download.log");
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (_) {}
}

function downloadModule(
  mod: ModuleWithArtist,
  onStatus: (s: DownloadStatus) => void,
): void {
  if (!mod.file_name) {
    log(`ERROR: mod ${mod.id} has no file_name`);
    onStatus({ file: "?", status: "error", error: "No file name" });
    return;
  }

  const safeArtist = mod.artist_name.replace(/[<>:"/\\|?*]/g, "_");
  const safeFile = mod.file_name.replace(/[<>:"/\\|?*]/g, "_");
  const relPath = path.join("Roaster", safeArtist, safeFile);
  const dest = path.join(process.cwd(), relPath);
  const flacPath = dest.replace(/\.[^.]+$/, ".flac");

  log(
    `START id=${mod.id} file=${safeFile} dest=${dest} local_path=${mod.local_path ?? "null"}`,
  );

  if (mod.local_path && fs.existsSync(flacPath)) {
    log(`EXISTS (local_path + flac): ${flacPath}`);
    onStatus({ file: safeFile, status: "exists" });
    return;
  }

  if (fs.existsSync(dest) && !fs.existsSync(flacPath)) {
    log(`CONVERTING (module present, no flac): ${dest}`);
    convertToFlac(dest, safeFile, onStatus);
    return;
  }

  if (mod.local_path || fs.existsSync(dest)) {
    log(`EXISTS (file on disk): ${dest}`);
    onStatus({ file: safeFile, status: "exists" });
    return;
  }

  log(`MKDIR: ${path.dirname(dest)}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  onStatus({ file: safeFile, status: "downloading" });

  const url = `http://api.modarchive.org/downloads.php?moduleid=${mod.id}`;
  log(`FETCH: ${url}`);
  const tmp = dest + ".part";
  const out = fs.createWriteStream(tmp);

  out.on("error", (err: Error) => {
    log(`WRITE ERROR: ${err.message}`);
    onStatus({
      file: safeFile,
      status: "error",
      error: `Write: ${err.message}`,
    });
  });

  const req = http.get(url, (res: any) => {
    log(`RESPONSE: HTTP ${res.statusCode}`);
    if (res.statusCode !== 200) {
      out.close();
      fs.unlink(tmp, () => {});
      onStatus({
        file: safeFile,
        status: "error",
        error: `HTTP ${res.statusCode}`,
      });
      return;
    }
    let bytes = 0;
    res.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
    });
    res.pipe(out);
    out.on("finish", () => {
      out.close();
      log(`DOWNLOADED: ${bytes} bytes -> ${dest}`);
      try {
        fs.renameSync(tmp, dest);
        setModuleLocalPath(mod.id, relPath);
        log(`SAVED: ${dest}, starting conversion`);
        convertToFlac(dest, safeFile, onStatus);
      } catch (e: any) {
        log(`POST-DOWNLOAD ERROR: ${e.message}`);
        onStatus({ file: safeFile, status: "error", error: e.message });
      }
    });
  });
  req.on("error", (err: Error) => {
    log(`REQUEST ERROR: ${err.message}`);
    out.close();
    fs.unlink(tmp, () => {});
    onStatus({ file: safeFile, status: "error", error: err.message });
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────

type View = "home" | "search" | "library" | "artist" | "genre" | "queue";
type NavItem = { label: string; view: View; icon: string };

const NAV: NavItem[] = [
  { label: "Home", view: "home", icon: "⌂" },
  { label: "Search", view: "search", icon: "⌕" },
  { label: "Library", view: "library", icon: "▤" },
  { label: "Queue", view: "queue", icon: "≡" },
  { label: "Playlists", view: "playlists", icon: "▶" },
];

// ─── Utility components ──────────────────────────────────────────────────────

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <Text dimColor>—</Text>;
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <Text color="yellow">
      {"★".repeat(filled)}
      {"☆".repeat(5 - filled)}
      <Text color="white"> {rating.toFixed(1)}</Text>
    </Text>
  );
}

function ProgressBar({
  percent,
  width = 30,
}: {
  percent: number;
  width?: number;
}) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return (
    <Text>
      <Text color="green">{"█".repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
    </Text>
  );
}

function VolumeBar({ vol }: { vol: number }) {
  const bars = Math.round((vol / 100) * 10);
  return (
    <Text>
      <Text color={vol > 70 ? "green" : vol > 30 ? "yellow" : "red"}>
        {"▮".repeat(bars)}
      </Text>
      <Text dimColor>{"▯".repeat(10 - bars)}</Text>
    </Text>
  );
}

function truncate(s: string | null | undefined, len: number): string {
  if (!s) return "—";
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

// ─── Player Bar ──────────────────────────────────────────────────────────────

function PlayerBar({ playerState }: { playerState: Player.PlayerState }) {
  const track = Player.getCurrentTrack();
  const { status, progress, volume, elapsed, duration } = playerState;
  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;

  const statusIcon =
    status === "playing" ? "▶" : status === "paused" ? "⏸" : "■";
  const statusColor =
    status === "playing" ? "green" : status === "paused" ? "yellow" : "gray";

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1}>
      {/* Row 1: Controls — always visible */}
      <Box justifyContent="space-between">
        <Box gap={2}>
          <Text dimColor>[,]Prev</Text>
          <Text color="white">[Space]</Text>
          <Text dimColor>[N]ext</Text>
          <Text color={playerState.shuffle ? "green" : "gray"}>[Z]{playerState.shuffle ? " shuffle ON" : " shuffle"}</Text>
        </Box>
        <Box gap={2}>
          <Text dimColor>Vol [-/+] {volume}%</Text>
        </Box>
      </Box>
      {/* Row 2: Now playing + progress + volume */}
      <Box gap={2}>
        <Text color={statusColor} bold>{statusIcon}</Text>
        {track ? (
          <>
            <Text color="white" bold>{truncate(track.module_name ?? track.file_name, 26)}</Text>
            <Text dimColor>{truncate(track.artist_name, 20)}</Text>
          </>
        ) : (
          <Text dimColor italic>No track selected</Text>
        )}
        <Box flexGrow={1} />
        <ProgressBar percent={progress} width={24} />
        <Text dimColor>{fmtTime(elapsed)}{duration > 0 ? ` / ${fmtTime(duration)}` : ""}</Text>
        <VolumeBar vol={volume} />
      </Box>
      {/* Row 3: Genres */}
      {track && track.genres.length > 0 && (
        <Text dimColor> ♪ {track.genres.join(" · ")}</Text>
      )}
    </Box>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  activeView,
  onNav,
}: {
  activeView: View;
  onNav: (v: View) => void;
}) {
  return (
    <Box flexDirection="column" width={18} paddingX={1} gap={1}>
      <Box flexDirection="column" marginTop={1}>
        <Text color="green" bold>
          {" "}
          ♫ MODPLAYER
        </Text>
      </Box>
      <Box flexDirection="column" gap={0}>
        {NAV.map((item) => (
          <Box key={item.view} paddingX={1}>
            <Text
              color={activeView === item.view ? "green" : "white"}
              bold={activeView === item.view}
            >
              {activeView === item.view ? "▸ " : "  "}
              {item.icon} {item.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1} gap={0}>
        <Text dimColor bold>
          {" "}
          CONTROLS
        </Text>
        <Text dimColor> H/S/L/Q/F Nav</Text>
        <Text dimColor> ↑↓←→ Move</Text>
        <Text dimColor> Enter Select</Text>
        <Text dimColor> A Add queue</Text>
        <Text dimColor> Esc Back</Text>
        <Text dimColor> Ctrl+C Quit</Text>
      </Box>
    </Box>
  );
}

// ─── Track List ───────────────────────────────────────────────────────────────

function TrackList({
  modules,
  selectedIdx,
  title,
  showArtist = true,
  currentTrackId,
}: {
  modules: ModuleWithArtist[];
  selectedIdx: number;
  title: string;
  showArtist?: boolean;
  currentTrackId?: string | null;
}) {
  const rows = (process.stdout.rows ?? 40) - 10;
  const start = Math.max(0, selectedIdx - Math.floor(rows / 2));
  const visible = modules.slice(start, start + rows);

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="green" bold>
        {" "}
        {title}
      </Text>
      <Text dimColor> {"─".repeat(60)}</Text>
      {visible.length === 0 && <Text dimColor> No tracks found.</Text>}
      {visible.map((m, i) => {
        const realIdx = start + i;
        const isSelected = realIdx === selectedIdx;
        const isPlaying = currentTrackId != null && m.id === currentTrackId;
        const rowColor = isSelected ? "green" : isPlaying ? "blueBright" : "white";
        return (
          <Box key={m.id} paddingX={1} gap={1}>
            <Text color={rowColor}>
              {isSelected ? "▸" : isPlaying ? "♪" : " "} {pad(String(realIdx + 1), 3)}
            </Text>
            <Text color={rowColor} bold={isSelected || isPlaying}>
              {pad(truncate(m.module_name ?? m.file_name, 28), 29)}
            </Text>
            {showArtist && (
              <Text color={isSelected ? "white" : isPlaying ? "blueBright" : "gray"}>
                {pad(truncate(m.artist_name, 18), 19)}
              </Text>
            )}
            {m.favorite ? <Text color="red">♥</Text> : <Text> </Text>}
            <Text dimColor>{truncate(m.genres.join(", "), 18)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Artist List ──────────────────────────────────────────────────────────────

function ArtistList({
  artists,
  selectedIdx,
  title,
}: {
  artists: Artist[];
  selectedIdx: number;
  title: string;
}) {
  const rows = (process.stdout.rows ?? 40) - 10;
  const start = Math.max(0, selectedIdx - Math.floor(rows / 2));
  const visible = artists.slice(start, start + rows);

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="green" bold>
        {" "}
        {title}
      </Text>
      <Box paddingX={1} gap={2}>
        <Text dimColor>{pad("#", 5)}</Text>
        <Text dimColor>{pad("Artist", 26)}</Text>
        <Text dimColor>{pad("Mods", 8)}</Text>
        <Text dimColor>Rating</Text>
      </Box>
      <Text dimColor> {"─".repeat(60)}</Text>
      {visible.length === 0 && <Text dimColor> No artists found.</Text>}
      {visible.map((a, i) => {
        const realIdx = start + i;
        const isSelected = realIdx === selectedIdx;
        return (
          <Box key={a.id} paddingX={1} gap={2}>
            <Text color={isSelected ? "green" : "white"}>
              {isSelected ? "▸" : " "} {pad(String(realIdx + 1), 3)}
            </Text>
            <Text color={isSelected ? "green" : "white"} bold={isSelected}>
              {pad(truncate(a.name, 25), 26)}
            </Text>
            <Text dimColor>{pad(String(a.module_count ?? "?"), 4)} mods</Text>
            <Stars rating={a.rating} />
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Genre Grid ───────────────────────────────────────────────────────────────

const GENRE_COLORS = [
  "cyan",
  "magenta",
  "yellow",
  "blue",
  "green",
  "red",
  "white",
];

function GenreGrid({
  genres,
  selectedIdx,
}: {
  genres: Genre[];
  selectedIdx: number;
}) {
  const cols = 3;
  const visibleRows = 6; // show 6 rows × 3 cols = 18 genres at a time
  const allRows = chunk(genres, cols);
  const selectedRow = Math.floor(selectedIdx / cols);
  const startRow = Math.max(0, selectedRow - Math.floor(visibleRows / 2));
  const visibleChunks = allRows.slice(startRow, startRow + visibleRows);
  const total = genres.length;

  return (
    <Box flexDirection="column" gap={0}>
      <Text color="green" bold>
        {" "}
        Browse Genres
      </Text>
      <Text dimColor>
        {" "}
        {"─".repeat(60)} ({selectedIdx + 1}/{total})
      </Text>
      {visibleChunks.map((row, ri) => (
        <Box key={startRow + ri} flexDirection="row" gap={1} paddingX={1}>
          {row.map((g, ci) => {
            const idx = (startRow + ri) * cols + ci;
            const color = GENRE_COLORS[idx % GENRE_COLORS.length] as any;
            const isSelected = idx === selectedIdx;
            return (
              <Box
                key={g.id}
                width={22}
                height={5}
                borderStyle={isSelected ? "bold" : "single"}
                borderColor={isSelected ? "green" : color}
                justifyContent="center"
                alignItems="center"
              >
                <Box flexDirection="column" alignItems="center">
                  <Text color={isSelected ? "green" : color} bold={isSelected}>
                    {truncate(g.name, 20)}
                  </Text>
                  <Text dimColor>{g.module_count ?? 0} tracks</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Views ────────────────────────────────────────────────────────────────────

function HomeView({
  onNavigate,
  stats,
}: {
  onNavigate: (v: View) => void;
  stats: { artists: number; modules: number; genres: number };
}) {
  return (
    <Box flexDirection="column" gap={1} paddingX={2}>
      <Text color="green" bold>
        Welcome to ModPlayer
      </Text>
      <Text dimColor>
        Your terminal tracker music player — powered by ModArchive
      </Text>
      <Text dimColor>{"─".repeat(56)}</Text>

      <Box flexDirection="row" gap={4}>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="green"
          paddingX={2}
          paddingY={1}
        >
          <Text color="green" bold>
            {stats.artists.toLocaleString()}
          </Text>
          <Text dimColor>Artists</Text>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
        >
          <Text color="cyan" bold>
            {stats.modules.toLocaleString()}
          </Text>
          <Text dimColor>Modules</Text>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="magenta"
          paddingX={2}
          paddingY={1}
        >
          <Text color="magenta" bold>
            {stats.genres.toLocaleString()}
          </Text>
          <Text dimColor>Genres</Text>
        </Box>
      </Box>

      <Text dimColor>{"─".repeat(56)}</Text>
      <Text color="white">Quick Actions</Text>
      <Text>
        {" "}
        <Text color="green">Press 2</Text>{" "}
        <Text dimColor>to search for tracks and artists</Text>
      </Text>
      <Text>
        {" "}
        <Text color="green">Press 3</Text>{" "}
        <Text dimColor>to browse your library</Text>
      </Text>
      <Text>
        {" "}
        <Text color="green">Press 4</Text>{" "}
        <Text dimColor>to view the queue</Text>
      </Text>
      <Text dimColor>{"─".repeat(56)}</Text>
      <Text dimColor>Built with ♥ for the demoscene</Text>
    </Box>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

interface AppState {
  view: View;
  prevView: View;
  // Search
  searchQuery: string;
  searchResults: ModuleWithArtist[];
  favorites: ModuleWithArtist[];
  downloaded: ModuleWithArtist[];
  searchArtistResults: Artist[];
  searchMode: "tracks" | "artists";
  // Library
  libraryTab: "genres" | "artists";
  genres: Genre[];
  artists: Artist[];
  // Artist detail
  focusedArtist: Artist | null;
  artistModules: ModuleWithArtist[];
  // Genre detail
  focusedGenre: Genre | null;
  genreModules: ModuleWithArtist[];
  // UI state
  selectedIdx: number;
  playerState: Player.PlayerState;
  stats: { artists: number; modules: number; genres: number };
  isSearchFocused: boolean;
  downloadStatus: {
    file: string;
    status: DownloadStatus["status"];
    error?: string;
  } | null;
}

export default function App({ dbPath }: { dbPath?: string }) {
  const { exit } = useApp();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>({
    view: "home",
    prevView: "home",
    searchQuery: "",
    searchResults: [],
    searchArtistResults: [],
    searchMode: "tracks",
    libraryTab: "genres",
    genres: [],
    artists: [],
    focusedArtist: null,
    artistModules: [],
    focusedGenre: null,
    genreModules: [],
    selectedIdx: 0,
    playerState: Player.getState(),
    stats: { artists: 0, modules: 0, genres: 0 },
    isSearchFocused: false,
    downloadStatus: null,
    favorites: [],
    downloaded: [],
    allModules: [],
    allArtists: [],
  });

  // Init DB
  useEffect(() => {
    initDb(dbPath).then(() => {
      const stats = getDbStats();
      const genres = getAllGenres();
      const artists = getTopArtists(9999);
      const allModules = getRecentModules(9999);
      const allArtists = getAllArtists(9999);
      const favorites = getFavorites();
      const downloaded = getDownloadedModules();
      setState((s) => ({
        ...s, stats, genres, artists,
        allModules, allArtists, favorites, downloaded,
        searchResults: allModules,
        searchArtistResults: allArtists,
      }));
      setReady(true);
    });
  }, []);

  // Subscribe to player state
  useEffect(() => {
    return Player.subscribe((ps) => {
      setState((s) => ({ ...s, playerState: ps }));
    });
  }, []);

  const navigate = useCallback((view: View) => {
    setState((s) => {
      const next: Partial<AppState> = {
        view,
        prevView: s.view,
        selectedIdx: 0,
      };
      if (view === "library" && s.genres.length === 0) {
        next.genres = getAllGenres();
        next.artists = getAllArtists(9999);
      }
      return { ...s, ...next };
    });
  }, []);

  const goBack = useCallback(() => {
    setState((s) => ({ ...s, view: s.prevView, selectedIdx: 0 }));
  }, []);

  const openArtist = useCallback((artist: Artist) => {
    const mods = getModulesByArtist(artist.id);
    setState((s) => ({
      ...s,
      focusedArtist: artist,
      artistModules: mods,
      prevView: s.view,
      view: "artist",
      selectedIdx: 0,
    }));
  }, []);

  const openGenre = useCallback((genre: Genre) => {
    const mods = getModulesByGenre(genre.name);
    setState((s) => ({
      ...s,
      focusedGenre: genre,
      genreModules: mods,
      prevView: s.view,
      view: "genre",
      selectedIdx: 0,
    }));
  }, []);

  const runSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    const results = searchModules(query, 9999);
    const artistResults = searchArtists(query, 9999);
    setState((s) => ({
      ...s,
      searchResults: results,
      searchArtistResults: artistResults,
      selectedIdx: 0,
    }));
  }, []);

  useInput((input, key) => {
    if (!ready) return;

    // Quit
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    // Nav shortcuts
    if (!state.isSearchFocused) {
      if (input === "h" || input === "H") {
        navigate("home");
        return;
      }
      if (input === "s" || input === "S") {
        navigate("search");
        return;
      }
      if (input === "l" || input === "L") {
        navigate("library");
        return;
      }
      if (input === "q" || input === "Q") {
        navigate("queue");
        return;
      }
      if (key.escape) {
        goBack();
        return;
      }

      // Player controls
      if (input === " ") {
        Player.togglePlayPause();
        return;
      }
      if (input === "n" || input === "N") {
        Player.nextTrack();
        return;
      }
      if (input === ",") {
        Player.prevTrack();
        return;
      }
      if (input === ".") {
        Player.nextTrack();
        return;
      }
      if (input === "+" || input === "=") {
        Player.setVolume(state.playerState.volume + 10);
        return;
      }
      if (input === "-" || input === "_") {
        Player.setVolume(state.playerState.volume - 10);
        return;
      }

      // List navigation
      const isGenreGrid =
        state.view === "library" && state.libraryTab === "genres";
      const gridCols = 3;

      if (key.upArrow) {
        setState((s) => ({
          ...s,
          selectedIdx: Math.max(
            0,
            s.selectedIdx - (isGenreGrid ? gridCols : 1),
          ),
        }));
        return;
      }
      if (key.downArrow) {
        setState((s) => {
          const max = getListLength(s) - 1;
          return {
            ...s,
            selectedIdx: Math.min(
              max,
              s.selectedIdx + (isGenreGrid ? gridCols : 1),
            ),
          };
        });
        return;
      }
      if (isGenreGrid && key.leftArrow) {
        setState((s) => ({
          ...s,
          selectedIdx: Math.max(0, s.selectedIdx - 1),
        }));
        return;
      }
      if (isGenreGrid && key.rightArrow) {
        setState((s) => {
          const max = getListLength(s) - 1;
          return { ...s, selectedIdx: Math.min(max, s.selectedIdx + 1) };
        });
        return;
      }

      // Enter / select
      if (key.return) {
        handleEnter();
        return;
      }

      // Tab switching in library / search
      if (input === "t" || input === "T") {
        setState((s) => ({
          ...s,
          libraryTab: s.libraryTab === "genres" ? "artists" : "genres",
          searchMode: s.searchMode === "tracks" ? "artists" : "tracks",
          selectedIdx: 0,
        }));
        return;
      }

      // Queue add
      if (input === "a" || input === "A") {
        const track = getSelectedTrack();
        if (track) {
          Player.addToQueue(track);
        }
        return;
      }

      // Navigate to favorites
      // Navigate to playlists
      if (input === "p" || input === "P") {
        navigate("playlists");
        return;
      }

      // Toggle favorite (Ctrl+F)
      if (key.ctrl && input === "f") {
        const track = getSelectedTrack();
        if (track) {
          const newFav = !track.favorite;
          setModuleFavorite(track.id, newFav);
          setState((s) => {
            const update = (list: ModuleWithArtist[]) =>
              list.map((m) =>
                m.id === track.id ? { ...m, favorite: newFav ? 1 : 0 } : m,
              );
            return {
              ...s,
              allModules: update(s.allModules),
              searchResults: update(s.searchResults),
              artistModules: update(s.artistModules),
              genreModules: update(s.genreModules),
              favorites: newFav
                ? [...s.favorites, { ...track, favorite: 1 }]
                : s.favorites.filter((m) => m.id !== track.id),
            };
          });
        }
        return;
      }
    }

    // Search input handling
    if (state.view === "search") {
      if (key.escape) {
        setState((s) => ({ ...s, isSearchFocused: false }));
        return;
      }
      if (input === "/" && !state.isSearchFocused) {
        setState((s) => ({ ...s, isSearchFocused: true }));
        return;
      }
      if (state.isSearchFocused) {
        if (key.return) {
          runSearch(state.searchQuery);
          setState((s) => ({ ...s, isSearchFocused: false }));
          return;
        }
        if (key.backspace || key.delete) {
          setState((s) => ({ ...s, searchQuery: s.searchQuery.slice(0, -1) }));
          return;
        }
        if (input && input.length === 1) {
          setState((s) => ({ ...s, searchQuery: s.searchQuery + input }));
          return;
        }
      }
    }
  });

  function getListLength(s: AppState): number {
    switch (s.view) {
      case "search":
        return s.searchMode === "tracks"
          ? s.searchResults.length
          : s.searchArtistResults.length;
      case "library":
        return s.libraryTab === "genres" ? s.genres.length : s.artists.length;
      case "artist":
        return s.artistModules.length;
      case "genre":
        return s.genreModules.length;
      case "queue":
        return s.playerState.queue.length;
      case "favorites":
      case "playlist_favorites":
        return (s.favorites ?? []).length;
      case "playlist_downloaded":
        return (s.downloaded ?? []).length;
      case "playlists":
        return 2;
      default:
        return 0;
    }
  }

  function getSelectedTrack(): ModuleWithArtist | null {
    switch (state.view) {
      case "search":
        return state.searchMode === "tracks"
          ? (state.searchResults[state.selectedIdx] ?? null)
          : null;
      case "artist":
        return state.artistModules[state.selectedIdx] ?? null;
      case "genre":
        return state.genreModules[state.selectedIdx] ?? null;
      case "queue":
        return state.playerState.queue[state.selectedIdx] ?? null;
      case "favorites":
      case "playlist_favorites":
        return (state.favorites ?? [])[state.selectedIdx] ?? null;
      case "playlist_downloaded":
        return (state.downloaded ?? [])[state.selectedIdx] ?? null;
      default:
        return null;
    }
  }

  const playingRef = React.useRef(false);
  function triggerDownloadAndPlay(track: ModuleWithArtist, onReady: () => void) {
    if (playingRef.current) return;
    playingRef.current = true;
    downloadModule(track, ({ file, status, error }) => {
      setState((s) => ({ ...s, downloadStatus: { file, status, error } }));
      if (status === "done" || status === "exists") {
        playingRef.current = false;
        onReady();
        setTimeout(() => setState((s) => ({ ...s, downloadStatus: null })), 3000);
      } else if (status === "error") {
        playingRef.current = false;
        setTimeout(() => setState((s) => ({ ...s, downloadStatus: null })), 3000);
      }
    });
  }

  function handleEnter() {
    const { view, selectedIdx, searchMode } = state;

    if (view === "search") {
      if (searchMode === "tracks") {
        const track = state.searchResults[selectedIdx];
        if (track) {
          downloadModule(track, ({ file, status, error }) => {
            setState((s) => ({
              ...s,
              downloadStatus: { file, status, error },
            }));
            if (status === "done" || status === "exists") {
              Player.playModule(track);
              setTimeout(
                () => setState((s) => ({ ...s, downloadStatus: null })),
                3000,
              );
            } else if (status === "error") {
              setTimeout(
                () => setState((s) => ({ ...s, downloadStatus: null })),
                3000,
              );
            }
          });
        }
      } else {
        const artist = state.searchArtistResults[selectedIdx];
        if (artist) openArtist(artist);
      }
      return;
    }

    if (view === "library") {
      if (state.libraryTab === "genres") {
        const genre = state.genres[selectedIdx];
        if (genre) openGenre(genre);
      } else {
        const artist = state.artists[selectedIdx];
        if (artist) openArtist(artist);
      }
      return;
    }

    if (view === "artist") {
      const track = state.artistModules[selectedIdx];
      if (track) {
        downloadModule(track, ({ file, status, error }) => {
          setState((s) => ({ ...s, downloadStatus: { file, status, error } }));
          if (status === "done" || status === "exists") {
            Player.playQueue(state.artistModules, selectedIdx);
            setTimeout(
              () => setState((s) => ({ ...s, downloadStatus: null })),
              3000,
            );
          } else if (status === "error") {
            setTimeout(
              () => setState((s) => ({ ...s, downloadStatus: null })),
              3000,
            );
          }
        });
      }
      return;
    }

    if (view === "genre") {
      const track = state.genreModules[selectedIdx];
      if (track) {
        downloadModule(track, ({ file, status, error }) => {
          setState((s) => ({ ...s, downloadStatus: { file, status, error } }));
          if (status === "done" || status === "exists") {
            Player.playQueue(state.genreModules, selectedIdx);
            setTimeout(
              () => setState((s) => ({ ...s, downloadStatus: null })),
              3000,
            );
          } else if (status === "error") {
            setTimeout(
              () => setState((s) => ({ ...s, downloadStatus: null })),
              3000,
            );
          }
        });
      }
      return;
    }

    if (view === "playlists") {
      if (selectedIdx === 0)
        setState((s) => ({ ...s, view: "playlist_favorites", selectedIdx: 0 }));
      if (selectedIdx === 1)
        setState((s) => ({
          ...s,
          view: "playlist_downloaded",
          selectedIdx: 0,
        }));
      return;
    }

    if (view === "favorites" || view === "playlist_favorites") {
      const track = state.favorites[selectedIdx];
      const queue = state.favorites.slice();
      const idx = selectedIdx;
      if (track)
        triggerDownloadAndPlay(track, () => Player.playQueue(queue, idx));
      return;
    }

    if (view === "playlist_downloaded") {
      const track = state.downloaded[selectedIdx];
      const queue = state.downloaded.slice();
      const idx = selectedIdx;
      if (track)
        triggerDownloadAndPlay(track, () => Player.playQueue(queue, idx));
      return;
    }

    if (view === "queue") {
      const track = state.playerState.queue[selectedIdx];
      if (track) {
        downloadModule(track, ({ file, status, error }) => {
          setState((s) => ({ ...s, downloadStatus: { file, status, error } }));
          if (status === "done" || status === "exists") {
            Player.playQueue(state.playerState.queue, selectedIdx);
            setTimeout(
              () => setState((s) => ({ ...s, downloadStatus: null })),
              3000,
            );
          } else if (status === "error") {
            setTimeout(
              () => setState((s) => ({ ...s, downloadStatus: null })),
              3000,
            );
          }
        });
      }
      return;
    }
  }

  if (!ready) {
    return (
      <Box padding={2}>
        <Text color="green">♫ Loading ModPlayer…</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows ?? 40}>
      {/* Main layout */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Sidebar */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          width={18}
        >
          <Sidebar activeView={state.view} onNav={navigate} />
        </Box>

        {/* Content */}
        <Box
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderColor="gray"
          paddingY={1}
        >
          {state.view === "home" && (
            <HomeView onNavigate={navigate} stats={state.stats} />
          )}

          {state.view === "search" && (
            <Box flexDirection="column" gap={1}>
              {/* Search bar */}
              <Box paddingX={2} gap={2}>
                <Text color="green" bold>
                  ⌕ Search:
                </Text>
                <Box
                  borderStyle="single"
                  borderColor={state.isSearchFocused ? "green" : "gray"}
                  paddingX={1}
                  minWidth={30}
                >
                  <Text color={state.isSearchFocused ? "white" : "gray"}>
                    {state.searchQuery ||
                      (state.isSearchFocused ? "" : "Press / to type…")}
                    {state.isSearchFocused && <Text color="green">█</Text>}
                  </Text>
                </Box>
                {!state.isSearchFocused && (
                  <Text dimColor>[/] focus [T] toggle mode [Enter] search</Text>
                )}
              </Box>

              {/* Mode toggle */}
              <Box paddingX={2} gap={2}>
                <Text
                  color={state.searchMode === "tracks" ? "green" : "gray"}
                  bold={state.searchMode === "tracks"}
                  underline={state.searchMode === "tracks"}
                >
                  Tracks
                </Text>
                <Text
                  color={state.searchMode === "artists" ? "green" : "gray"}
                  bold={state.searchMode === "artists"}
                  underline={state.searchMode === "artists"}
                >
                  Artists
                </Text>
                <Text dimColor>[T] to toggle</Text>
              </Box>

              {state.searchMode === "tracks" ? (
                <TrackList
                  modules={state.searchResults}
                  selectedIdx={state.selectedIdx}
                  currentTrackId={state.playerState.queue[state.playerState.currentIndex]?.id}
                  title={
                    state.searchResults.length > 0
                      ? `Tracks (${state.searchResults.length})`
                      : "Enter a search term"
                  }
                />
              ) : (
                <ArtistList
                  artists={state.searchArtistResults}
                  selectedIdx={state.selectedIdx}
                  title={
                    state.searchArtistResults.length > 0
                      ? `Artists (${state.searchArtistResults.length})`
                      : "Enter a search term"
                  }
                />
              )}
            </Box>
          )}

          {state.view === "library" && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} gap={3}>
                <Text
                  color={state.libraryTab === "genres" ? "green" : "gray"}
                  bold={state.libraryTab === "genres"}
                  underline={state.libraryTab === "genres"}
                >
                  Genres
                </Text>
                <Text
                  color={state.libraryTab === "artists" ? "green" : "gray"}
                  bold={state.libraryTab === "artists"}
                  underline={state.libraryTab === "artists"}
                >
                  Artists
                </Text>
                <Text dimColor>[T] to toggle [Enter] to open</Text>
              </Box>

              {state.libraryTab === "genres" ? (
                <GenreGrid
                  genres={state.genres}
                  selectedIdx={state.selectedIdx}
                />
              ) : (
                <ArtistList
                  artists={state.artists}
                  selectedIdx={state.selectedIdx}
                  title={`Artists (${state.artists.length})`}
                />
              )}
            </Box>
          )}

          {state.view === "artist" && state.focusedArtist && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} flexDirection="column">
                <Text color="green" bold>
                  ◉ {state.focusedArtist.name}
                </Text>
                <Box gap={3}>
                  <Text dimColor>
                    {state.focusedArtist.module_count ?? "?"} modules
                  </Text>
                  <Stars rating={state.focusedArtist.rating} />
                  <Text dimColor>
                    [Esc] back [Enter] play all from here [A] add to queue
                  </Text>
                </Box>
              </Box>
              <TrackList
                modules={state.artistModules}
                selectedIdx={state.selectedIdx}
                  currentTrackId={state.playerState.queue[state.playerState.currentIndex]?.id}
                title={`Tracks (${state.artistModules.length})`}
                showArtist={false}
              />
            </Box>
          )}

          {state.view === "genre" && state.focusedGenre && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} flexDirection="column">
                <Text color="green" bold>
                  ♪ {state.focusedGenre.name.toUpperCase()}
                </Text>
                <Text dimColor>[Esc] back [Enter] play [A] add to queue</Text>
              </Box>
              <TrackList
                modules={state.genreModules}
                selectedIdx={state.selectedIdx}
                  currentTrackId={state.playerState.queue[state.playerState.currentIndex]?.id}
                title={`Tracks in ${state.focusedGenre.name} (${state.genreModules.length})`}
              />
            </Box>
          )}

          {state.view === "playlists" && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} gap={2}>
                <Text color="green" bold>
                  ▶ Playlists
                </Text>
                <Text dimColor>[Enter] open</Text>
              </Box>
              <Box paddingX={2} flexDirection="column" gap={0}>
                <Box gap={2}>
                  <Text color={state.selectedIdx === 0 ? "green" : "white"}>
                    {state.selectedIdx === 0 ? "▸" : " "} ♥ Favorites
                  </Text>
                  <Text dimColor>({state.favorites.length} tracks)</Text>
                </Box>
                <Box gap={2}>
                  <Text color={state.selectedIdx === 1 ? "green" : "white"}>
                    {state.selectedIdx === 1 ? "▸" : " "} ⬇ Downloaded
                  </Text>
                  <Text dimColor>({state.downloaded.length} tracks)</Text>
                </Box>
              </Box>
            </Box>
          )}

          {state.view === "playlist_favorites" && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} gap={2}>
                <Text color="red" bold>
                  ♥ Favorites
                </Text>
                <Text dimColor>
                  ({state.favorites.length} tracks) [Ctrl+F] toggle ♥ [Esc] back
                </Text>
              </Box>
              {state.favorites.length === 0 ? (
                <Box paddingX={2} paddingY={2}>
                  <Text dimColor>
                    No favorites yet. Press [Ctrl+F] on any track to add it.
                  </Text>
                </Box>
              ) : (
                <TrackList
                  modules={state.favorites}
                  selectedIdx={state.selectedIdx}
                  currentTrackId={
                    state.playerState.queue[state.playerState.currentIndex]?.id
                  }
                  title={`Favorites (${state.favorites.length})`}
                />
              )}
            </Box>
          )}

          {state.view === "playlist_downloaded" && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} gap={2}>
                <Text color="cyan" bold>
                  ⬇ Downloaded
                </Text>
                <Text dimColor>
                  ({state.downloaded.length} tracks) [Esc] back
                </Text>
              </Box>
              {state.downloaded.length === 0 ? (
                <Box paddingX={2} paddingY={2}>
                  <Text dimColor>
                    No downloaded tracks yet. Press [Enter] on any track to
                    download it.
                  </Text>
                </Box>
              ) : (
                <TrackList
                  modules={state.downloaded}
                  selectedIdx={state.selectedIdx}
                  currentTrackId={
                    state.playerState.queue[state.playerState.currentIndex]?.id
                  }
                  title={`Downloaded (${state.downloaded.length})`}
                />
              )}
            </Box>
          )}

          {state.view === "favorites" && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} gap={2}>
                <Text color="red" bold>
                  ♥ Favorites
                </Text>
                <Text dimColor>
                  ({(state.favorites ?? []).length} tracks) [Ctrl+F] toggle ♥
                </Text>
              </Box>
              {(state.favorites ?? []).length === 0 ? (
                <Box paddingX={2} paddingY={2}>
                  <Text dimColor>
                    No favorites yet. Press [Ctrl+F] on any track to add it.
                  </Text>
                </Box>
              ) : (
                <TrackList
                  modules={state.favorites ?? []}
                  selectedIdx={state.selectedIdx}
                  currentTrackId={
                    state.playerState.queue[state.playerState.currentIndex]?.id
                  }
                  title=""
                />
              )}
            </Box>
          )}

          {state.view === "queue" && (
            <Box flexDirection="column" gap={1}>
              <Box paddingX={2} gap={2}>
                <Text color="green" bold>
                  ≡ Play Queue
                </Text>
                <Text dimColor>
                  ({state.playerState.queue.length} tracks) [Enter] play from
                  here
                </Text>
              </Box>
              {state.playerState.queue.length === 0 ? (
                <Box paddingX={2} paddingY={2}>
                  <Text dimColor>
                    Queue is empty. Press [A] on any track to add it.
                  </Text>
                </Box>
              ) : (
                <TrackList
                  modules={state.playerState.queue}
                  selectedIdx={state.selectedIdx}
                  currentTrackId={state.playerState.queue[state.playerState.currentIndex]?.id}
                  title=""
                />
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Download status */}
      {state.downloadStatus &&
        (() => {
          const { file, status, error } = state.downloadStatus!;
          const icon =
            status === "downloading"
              ? "⬇"
              : status === "converting"
                ? "⚙"
                : status === "done"
                  ? "✔"
                  : status === "exists"
                    ? "✔"
                    : "✖";
          const color =
            status === "downloading"
              ? "cyan"
              : status === "converting"
                ? "yellow"
                : status === "done"
                  ? "green"
                  : status === "exists"
                    ? "green"
                    : "red";
          const label =
            status === "downloading"
              ? "Downloading"
              : status === "converting"
                ? "Converting to FLAC"
                : status === "done"
                  ? "Ready"
                  : status === "exists"
                    ? "Already downloaded"
                    : "Error";
          const detail = error ? `: ${error}` : "";
          return (
            <Box paddingX={2} gap={1}>
              <Text color={color}>
                {icon} {label}
              </Text>
              <Text dimColor>
                {file}
                {detail}
              </Text>
            </Box>
          );
        })()}

      {/* Player bar */}
      <PlayerBar playerState={state.playerState} />
    </Box>
  );
}