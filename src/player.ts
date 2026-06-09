import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { ModuleWithArtist } from "./db";

export type PlayerStatus = "playing" | "paused" | "stopped";

export interface PlayerState {
  queue: ModuleWithArtist[];
  currentIndex: number;
  status: PlayerStatus;
  progress: number;
  duration: number;
  elapsed: number;
  volume: number;
  shuffle: boolean;
}

const initialState: PlayerState = {
  queue: [],
  currentIndex: -1,
  status: "stopped",
  progress: 0,
  duration: 0,
  elapsed: 0,
  volume: 70,
  shuffle: false,
};

let state: PlayerState = { ...initialState };
let listeners: Array<(s: PlayerState) => void> = [];
let playerProc: ChildProcess | null = null;
let tickInterval: NodeJS.Timeout | null = null;
let playSession = 0; // incremented on every new playback, guards stale exit callbacks

// Injected by App.tsx so the player can trigger download+convert before playing
let downloadHook: ((mod: ModuleWithArtist, cb: () => void) => void) | null =
  null;
export function setDownloadHook(
  fn: (mod: ModuleWithArtist, cb: () => void) => void,
) {
  downloadHook = fn;
}
const isWindows = process.platform === "win32";
const openmptExe = (() => {
  const local = path.join(process.cwd(), "openmpt123.exe");
  return fs.existsSync(local) ? local : "openmpt123";
})();
const ffplayExe = (() => {
  const local = path.join(process.cwd(), "ffplay.exe");
  return fs.existsSync(local) ? local : "ffplay";
})();
const ffprobeExe = (() => {
  const local = path.join(process.cwd(), "ffprobe.exe");
  return fs.existsSync(local) ? local : "ffprobe";
})();

const PLAYER_LOG = path.join(process.cwd(), "player.log");
function plog(msg: string) {
  try {
    fs.appendFileSync(PLAYER_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

function notify() {
  listeners.forEach((l) => l({ ...state, queue: [...state.queue] }));
}

export function subscribe(fn: (s: PlayerState) => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getState(): PlayerState {
  return { ...state, queue: [...state.queue] };
}

function stopCurrentProc() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  const proc = playerProc;
  playerProc = null; // clear immediately to prevent re-entry
  if (proc) {
    const pid = proc.pid;
    try {
      if (isWindows) {
        const { spawnSync } = require("child_process");
        // Kill the specific process tree
        if (pid)
          spawnSync("taskkill", ["/pid", String(pid), "/f", "/t"], {
            stdio: "ignore",
          });
        // Also kill any stray ffplay processes
        spawnSync("taskkill", ["/im", "ffplay.exe", "/f"], { stdio: "ignore" });
      } else {
        try {
          process.kill(pid!, "SIGTERM");
        } catch (_) {}
      }
    } catch (_) {}
  }
}

function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (state.status !== "playing") return;
    state.elapsed += 1;
    if (state.duration > 0) {
      state.progress = Math.min(100, (state.elapsed / state.duration) * 100);
      if (state.elapsed >= state.duration) {
        nextTrack();
        return;
      }
    }
    notify();
  }, 1000);
}

/**
 * Resolve the FLAC path for a module — checks both local_path field
 * AND the expected path on disk (in case local_path wasn't updated in memory yet).
 */
function resolveFlacPath(mod: ModuleWithArtist): string | null {
  plog(
    `RESOLVE: id=${mod.id} file=${mod.file_name} artist=${mod.artist_name} local_path=${mod.local_path ?? "null"}`,
  );
  // Try from local_path stored in DB
  if (mod.local_path) {
    const base = path.join(process.cwd(), mod.local_path);
    const flac = base.replace(/\.[^.]+$/, ".flac");
    plog(
      `  local_path base=${base} flac=${flac} flacExists=${fs.existsSync(flac)} baseExists=${fs.existsSync(base)}`,
    );
    if (fs.existsSync(flac)) return flac;
    if (fs.existsSync(base)) return base;
  }

  // Fallback: reconstruct expected path from artist/filename (handles fresh downloads)
  if (mod.file_name && mod.artist_name) {
    const safeArtist = mod.artist_name.replace(/[<>:"/\\|?*]/g, "_");
    const safeFile = mod.file_name.replace(/[<>:"/\\|?*]/g, "_");
    const base = path.join(process.cwd(), "Roaster", safeArtist, safeFile);
    const flac = base.replace(/\.[^.]+$/, ".flac");
    plog(
      `  fallback base=${base} flac=${flac} flacExists=${fs.existsSync(flac)} baseExists=${fs.existsSync(base)}`,
    );
    if (fs.existsSync(flac)) return flac;
    if (fs.existsSync(base)) return base;
  }

  plog("  RESOLVE FAILED: no file found");
  return null;
}

function spawnPlayback(mod: ModuleWithArtist, onEnd: () => void) {
  stopCurrentProc();
  playSession++; // invalidate any previous exit callbacks
  const mySession = playSession;
  plog(`SPAWN session=${mySession} for ${mod.file_name}`);

  state.elapsed = 0;
  state.progress = 0;
  state.duration = 0;

  const filePath = resolveFlacPath(mod);
  plog(`SPAWN: filePath=${filePath ?? "null"}`);
  if (!filePath) {
    plog("SPAWN ABORTED: no file");
    state.status = "stopped";
    notify();
    return;
  }

  const isFlac = filePath.endsWith(".flac");

  if (isFlac) {
    plog(`FFPLAY: spawning for ${filePath}`);
    playerProc = spawn(
      ffplayExe,
      [
        "-nodisp",
        "-autoexit",
        "-loglevel",
        "quiet",
        "-volume",
        String(state.volume),
        filePath,
      ],
      { stdio: "ignore" },
    );
    plog(`FFPLAY PID: ${playerProc.pid}`);

    playerProc.on("exit", (code) => {
      plog(
        `FFPLAY EXIT: code=${code} session=${mySession} current=${playSession}`,
      );
      playerProc = null;
      if (code === 0 && mySession === playSession) onEnd();
    });
    playerProc.on("error", (err: Error) => {
      plog(`FFPLAY ERROR: ${err.message}`);
      playerProc = null;
    });

    // Get duration via ffprobe
    const probe = spawn(ffprobeExe, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ]);
    let buf = "";
    probe.stdout?.on("data", (d: Buffer) => {
      buf += d.toString();
    });
    probe.on("exit", () => {
      try {
        const dur = parseFloat(JSON.parse(buf)?.format?.duration ?? "0");
        if (dur > 0) {
          state.duration = dur;
          notify();
        }
      } catch (_) {}
    });
  } else {
    // Raw module: openmpt123 → ffplay
    plog(`OPENMPT: spawning for ${filePath}`);
    const openmpt = spawn(
      openmptExe,
      [
        "--batch",
        "--stdout",
        "--no-float",
        "--samplerate",
        "44100",
        "--channels",
        "2",
        "--",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );

    const ffplay = spawn(
      ffplayExe,
      [
        "-nodisp",
        "-autoexit",
        "-loglevel",
        "quiet",
        "-volume",
        String(state.volume),
        "-f",
        "s16le",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-",
      ],
      { stdio: ["pipe", "ignore", "ignore"] },
    );

    openmpt.stdout!.pipe(ffplay.stdin!);
    openmpt.on("exit", () => {
      try {
        ffplay.stdin!.end();
      } catch (_) {}
    });
    ffplay.on("exit", (code) => {
      plog(
        `FFPLAY EXIT: code=${code} session=${mySession} current=${playSession}`,
      );
      playerProc = null;
      try {
        openmpt.kill();
      } catch (_) {}
      if (code === 0 && mySession === playSession) onEnd();
    });
    ffplay.on("error", (err: Error) => {
      plog(`FFPLAY ERROR: ${err.message}`);
    });
    openmpt.on("error", (err: Error) => {
      plog(`OPENMPT ERROR: ${err.message}`);
    });
    ffplay.on("exit", (code2) => {
      plog(`FFPLAY EXIT: code=${code2}`);
    });
    openmpt.on("exit", (code2: number) => {
      plog(`OPENMPT EXIT: code=${code2}`);
    });
    playerProc = ffplay;
  }

  startTick();
  notify();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function playModule(mod: ModuleWithArtist) {
  const existingIdx = state.queue.findIndex((m) => m.id === mod.id);
  if (existingIdx >= 0) {
    state.currentIndex = existingIdx;
  } else {
    state.queue = [mod, ...state.queue.filter((m) => m.id !== mod.id)];
    state.currentIndex = 0;
  }
  state.status = "playing";
  spawnPlayback(mod, () => nextTrack());
  notify();
}

export function addToQueue(mod: ModuleWithArtist) {
  if (!state.queue.find((m) => m.id === mod.id)) {
    state.queue = [...state.queue, mod];
    notify();
  }
}

export function playQueue(modules: ModuleWithArtist[], startIndex = 0) {
  state.queue = [...modules];
  state.currentIndex = startIndex;
  state.status = "playing";
  spawnPlayback(modules[startIndex], () => nextTrack());
  notify();
}

export function togglePlayPause() {
  if (state.status === "stopped") return;
  if (state.status === "playing") {
    state.status = "paused";
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    // ffplay doesn't support pause — stop and remember position
    stopCurrentProc();
  } else {
    state.status = "playing";
    const mod = state.queue[state.currentIndex];
    if (mod) spawnPlayback(mod, () => nextTrack());
  }
  notify();
}

function playWithDownload(mod: ModuleWithArtist) {
  stopCurrentProc();
  if (downloadHook) {
    state.status = "playing"; // show loading state
    notify();
    downloadHook(mod, () => spawnPlayback(mod, () => nextTrack()));
  } else {
    spawnPlayback(mod, () => nextTrack());
  }
}

export function nextTrack() {
  if (state.queue.length === 0) return;
  state.currentIndex = (state.currentIndex + 1) % state.queue.length;
  state.elapsed = 0;
  const mod = state.queue[state.currentIndex];
  playWithDownload(mod);
  notify();
}

export function prevTrack() {
  if (state.queue.length === 0) return;
  if (state.elapsed > 5) {
    state.elapsed = 0;
    const mod = state.queue[state.currentIndex];
    playWithDownload(mod);
  } else {
    state.currentIndex =
      state.currentIndex <= 0 ? state.queue.length - 1 : state.currentIndex - 1;
    const mod = state.queue[state.currentIndex];
    playWithDownload(mod);
  }
  notify();
}

export function toggleShuffle() {
  state.shuffle = !state.shuffle;
  if (state.shuffle) {
    // Fisher-Yates shuffle keeping current track at index 0
    const current = state.queue[state.currentIndex];
    const rest = state.queue.filter((_, i) => i !== state.currentIndex);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    state.queue = current ? [current, ...rest] : rest;
    state.currentIndex = 0;
  }
  notify();
}

export function setVolume(vol: number) {
  state.volume = Math.max(0, Math.min(100, vol));
  // Volume takes effect on next track start — no restart needed
  notify();
}

export function getCurrentTrack(): ModuleWithArtist | null {
  if (state.currentIndex < 0 || state.currentIndex >= state.queue.length)
    return null;
  return state.queue[state.currentIndex];
}

export function stopAll() {
  stopCurrentProc();
  state.status = "stopped";
  notify();
}
