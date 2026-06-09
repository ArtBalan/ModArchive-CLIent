"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const react_1 = __importStar(require("react"));
const ink_1 = require("ink");
const db_1 = require("./db");
const Player = __importStar(require("./player"));
const NAV = [
    { label: 'Home', view: 'home', icon: '⌂' },
    { label: 'Search', view: 'search', icon: '⌕' },
    { label: 'Library', view: 'library', icon: '▤' },
    { label: 'Queue', view: 'queue', icon: '≡' },
];
// ─── Utility components ──────────────────────────────────────────────────────
function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <Text dimColor>—</Text>;
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <Text color="yellow">
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
      <Text color="white"> {rating.toFixed(1)}</Text>
    </Text>
  );
}

function ProgressBar({ percent, width = 30 }) {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return (react_1.default.createElement(ink_1.Text, null,
        react_1.default.createElement(ink_1.Text, { color: "green" }, '█'.repeat(filled)),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, '░'.repeat(empty))));
}
function VolumeBar({ vol }) {
    const bars = Math.round((vol / 100) * 10);
    return (react_1.default.createElement(ink_1.Text, null,
        react_1.default.createElement(ink_1.Text, { color: vol > 70 ? 'green' : vol > 30 ? 'yellow' : 'red' }, '▮'.repeat(bars)),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, '▯'.repeat(10 - bars))));
}
function truncate(s, len) {
    if (!s)
        return '—';
    return s.length > len ? s.slice(0, len - 1) + '…' : s;
}
function pad(s, len) {
    return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}
// ─── Player Bar ──────────────────────────────────────────────────────────────
function PlayerBar({ playerState }) {
    const track = Player.getCurrentTrack();
    const { status, progress, volume } = playerState;
    const statusIcon = status === 'playing' ? '▶' : status === 'paused' ? '⏸' : '■';
    const statusColor = status === 'playing' ? 'green' : status === 'paused' ? 'yellow' : 'gray';
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "single", borderColor: "green", paddingX: 1 },
        react_1.default.createElement(ink_1.Box, { justifyContent: "space-between", gap: 2 },
            react_1.default.createElement(ink_1.Box, { flexDirection: "row", gap: 1, width: 40 },
                react_1.default.createElement(ink_1.Text, { color: statusColor, bold: true }, statusIcon),
                track ? (react_1.default.createElement(ink_1.Box, { flexDirection: "column" },
                    react_1.default.createElement(ink_1.Text, { color: "white", bold: true }, truncate(track.module_name ?? track.file_name, 28)),
                    react_1.default.createElement(ink_1.Text, { dimColor: true }, truncate(track.artist_name, 28)))) : (react_1.default.createElement(ink_1.Text, { dimColor: true, italic: true }, "No track selected"))),
            react_1.default.createElement(ink_1.Box, { flexDirection: "column", alignItems: "center", gap: 0 },
                react_1.default.createElement(ink_1.Box, { gap: 1 },
                    react_1.default.createElement(ink_1.Text, { dimColor: true }, "[P]rev"),
                    react_1.default.createElement(ink_1.Text, { color: "white" }, "[Space]"),
                    react_1.default.createElement(ink_1.Text, { dimColor: true }, "[N]ext")),
                react_1.default.createElement(ProgressBar, { percent: progress, width: 32 }),
                react_1.default.createElement(ink_1.Text, { dimColor: true },
                    Math.round(progress),
                    "%")),
            react_1.default.createElement(ink_1.Box, { flexDirection: "column", alignItems: "flex-end", gap: 0 },
                react_1.default.createElement(ink_1.Text, { dimColor: true }, "Vol [-/+]"),
                react_1.default.createElement(VolumeBar, { vol: volume }),
                react_1.default.createElement(ink_1.Text, { dimColor: true },
                    volume,
                    "%"))),
        track && track.genres.length > 0 && (react_1.default.createElement(ink_1.Text, { dimColor: true },
            "  \u266A ",
            track.genres.join(' · ')))));
}
// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ activeView, onNav }) {
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", width: 18, paddingX: 1, gap: 1 },
        react_1.default.createElement(ink_1.Box, { flexDirection: "column", marginTop: 1 },
            react_1.default.createElement(ink_1.Text, { color: "green", bold: true }, "  \u266B MODPLAYER")),
        react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 0 }, NAV.map(item => (react_1.default.createElement(ink_1.Box, { key: item.view, paddingX: 1 },
            react_1.default.createElement(ink_1.Text, { color: activeView === item.view ? 'green' : 'white', bold: activeView === item.view },
                activeView === item.view ? '▸ ' : '  ',
                item.icon,
                " ",
                item.label))))),
        react_1.default.createElement(ink_1.Box, { flexDirection: "column", marginTop: 1, gap: 0 },
            react_1.default.createElement(ink_1.Text, { dimColor: true, bold: true }, " CONTROLS"),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "  1-4  Navigate"),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "  \u2191\u2193   Move"),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "  Enter Select"),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "  Q/q  Add queue"),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "  Esc  Back"),
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "  Ctrl+C Quit"))));
}
// ─── Track List ───────────────────────────────────────────────────────────────
function TrackList({ modules, selectedIdx, title, showArtist = true, }) {
    const start = Math.max(0, selectedIdx - 10);
    const visible = modules.slice(start, start + 20);
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 0 },
        react_1.default.createElement(ink_1.Text, { color: "green", bold: true },
            "  ",
            title),
        react_1.default.createElement(ink_1.Text, { dimColor: true },
            "  ",
            '─'.repeat(60)),
        visible.length === 0 && react_1.default.createElement(ink_1.Text, { dimColor: true }, "  No tracks found."),
        visible.map((m, i) => {
            const realIdx = start + i;
            const isSelected = realIdx === selectedIdx;
            return (react_1.default.createElement(ink_1.Box, { key: m.id, paddingX: 1, gap: 1 },
                react_1.default.createElement(ink_1.Text, { color: isSelected ? 'green' : 'white' },
                    isSelected ? '▸' : ' ',
                    " ",
                    pad(String(realIdx + 1), 3)),
                react_1.default.createElement(ink_1.Text, { color: isSelected ? 'green' : 'white', bold: isSelected }, pad(truncate(m.module_name ?? m.file_name, 28), 29)),
                showArtist && (react_1.default.createElement(ink_1.Text, { color: isSelected ? 'white' : 'gray' }, pad(truncate(m.artist_name, 18), 19))),
                react_1.default.createElement(ink_1.Text, { dimColor: true }, truncate(m.genres.join(', '), 18))));
        })));
}
// ─── Artist List ──────────────────────────────────────────────────────────────
function ArtistList({ artists, selectedIdx, title, }) {
    const start = Math.max(0, selectedIdx - 10);
    const visible = artists.slice(start, start + 20);
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 0 },
        react_1.default.createElement(ink_1.Text, { color: "green", bold: true },
            "  ",
            title),
        react_1.default.createElement(ink_1.Text, { dimColor: true },
            "  ",
            '─'.repeat(60)),
        visible.length === 0 && react_1.default.createElement(ink_1.Text, { dimColor: true }, "  No artists found."),
        visible.map((a, i) => {
            const realIdx = start + i;
            const isSelected = realIdx === selectedIdx;
            return (react_1.default.createElement(ink_1.Box, { key: a.id, paddingX: 1, gap: 2 },
                react_1.default.createElement(ink_1.Text, { color: isSelected ? 'green' : 'white' },
                    isSelected ? '▸' : ' ',
                    " ",
                    pad(String(realIdx + 1), 3)),
                react_1.default.createElement(ink_1.Text, { color: isSelected ? 'green' : 'white', bold: isSelected }, pad(truncate(a.name, 25), 26)),
                react_1.default.createElement(ink_1.Text, { dimColor: true },
                    pad(String(a.module_count ?? '?'), 4),
                    " mods"),
                react_1.default.createElement(Stars, { rating: a.rating })));
        })));
}
// ─── Genre Grid ───────────────────────────────────────────────────────────────
const GENRE_COLORS = ['cyan', 'magenta', 'yellow', 'blue', 'green', 'red', 'white'];
function GenreGrid({ genres, selectedIdx }) {
    const cols = 4;
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 0 },
        react_1.default.createElement(ink_1.Text, { color: "green", bold: true }, "  Browse Genres"),
        react_1.default.createElement(ink_1.Text, { dimColor: true },
            "  ",
            '─'.repeat(60)),
        chunk(genres, cols).map((row, ri) => (react_1.default.createElement(ink_1.Box, { key: ri, flexDirection: "row", gap: 1, paddingX: 1 }, row.map((g, ci) => {
            const idx = ri * cols + ci;
            const color = GENRE_COLORS[idx % GENRE_COLORS.length];
            const isSelected = idx === selectedIdx;
            return (react_1.default.createElement(ink_1.Box, { key: g.id, width: 16, height: 3, borderStyle: isSelected ? 'bold' : 'single', borderColor: isSelected ? 'green' : color, justifyContent: "center", alignItems: "center" },
                react_1.default.createElement(ink_1.Text, { color: isSelected ? 'green' : color, bold: isSelected }, g.name)));
        }))))));
}
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
// ─── Views ────────────────────────────────────────────────────────────────────
function HomeView({ onNavigate, stats, }) {
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 1, paddingX: 2 },
        react_1.default.createElement(ink_1.Text, { color: "green", bold: true }, "Welcome to ModPlayer"),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, "Your terminal tracker music player \u2014 powered by ModArchive"),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, '─'.repeat(56)),
        react_1.default.createElement(ink_1.Box, { flexDirection: "row", gap: 4 },
            react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "round", borderColor: "green", paddingX: 2, paddingY: 1 },
                react_1.default.createElement(ink_1.Text, { color: "green", bold: true }, stats.artists.toLocaleString()),
                react_1.default.createElement(ink_1.Text, { dimColor: true }, "Artists")),
            react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 2, paddingY: 1 },
                react_1.default.createElement(ink_1.Text, { color: "cyan", bold: true }, stats.modules.toLocaleString()),
                react_1.default.createElement(ink_1.Text, { dimColor: true }, "Modules")),
            react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "round", borderColor: "magenta", paddingX: 2, paddingY: 1 },
                react_1.default.createElement(ink_1.Text, { color: "magenta", bold: true }, stats.genres.toLocaleString()),
                react_1.default.createElement(ink_1.Text, { dimColor: true }, "Genres"))),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, '─'.repeat(56)),
        react_1.default.createElement(ink_1.Text, { color: "white" }, "Quick Actions"),
        react_1.default.createElement(ink_1.Text, null,
            "  ",
            react_1.default.createElement(ink_1.Text, { color: "green" }, "Press 2"),
            " ",
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "to search for tracks and artists")),
        react_1.default.createElement(ink_1.Text, null,
            "  ",
            react_1.default.createElement(ink_1.Text, { color: "green" }, "Press 3"),
            " ",
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "to browse your library")),
        react_1.default.createElement(ink_1.Text, null,
            "  ",
            react_1.default.createElement(ink_1.Text, { color: "green" }, "Press 4"),
            " ",
            react_1.default.createElement(ink_1.Text, { dimColor: true }, "to view the queue")),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, '─'.repeat(56)),
        react_1.default.createElement(ink_1.Text, { dimColor: true }, "Built with \u2665 for the demoscene")));
}
function App({ dbPath }) {
    const { exit } = (0, ink_1.useApp)();
    const [ready, setReady] = (0, react_1.useState)(false);
    const [state, setState] = (0, react_1.useState)({
        view: 'home',
        prevView: 'home',
        searchQuery: '',
        searchResults: [],
        searchArtistResults: [],
        searchMode: 'tracks',
        libraryTab: 'genres',
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
    });
    // Init DB
    (0, react_1.useEffect)(() => {
        (0, db_1.initDb)(dbPath).then(() => {
            const stats = (0, db_1.getDbStats)();
            const genres = (0, db_1.getAllGenres)();
            const artists = (0, db_1.getTopArtists)(50);
            setState(s => ({ ...s, stats, genres, artists }));
            setReady(true);
        });
    }, []);
    // Subscribe to player state
    (0, react_1.useEffect)(() => {
        return Player.subscribe(ps => {
            setState(s => ({ ...s, playerState: ps }));
        });
    }, []);
    const navigate = (0, react_1.useCallback)((view) => {
        setState(s => {
            const next = { view, prevView: s.view, selectedIdx: 0 };
            if (view === 'library' && s.genres.length === 0) {
                next.genres = (0, db_1.getAllGenres)();
                next.artists = (0, db_1.getAllArtists)(80);
            }
            return { ...s, ...next };
        });
    }, []);
    const goBack = (0, react_1.useCallback)(() => {
        setState(s => ({ ...s, view: s.prevView, selectedIdx: 0 }));
    }, []);
    const openArtist = (0, react_1.useCallback)((artist) => {
        const mods = (0, db_1.getModulesByArtist)(artist.id);
        setState(s => ({
            ...s,
            focusedArtist: artist,
            artistModules: mods,
            prevView: s.view,
            view: 'artist',
            selectedIdx: 0,
        }));
    }, []);
    const openGenre = (0, react_1.useCallback)((genre) => {
        const mods = (0, db_1.getModulesByGenre)(genre.name);
        setState(s => ({
            ...s,
            focusedGenre: genre,
            genreModules: mods,
            prevView: s.view,
            view: 'genre',
            selectedIdx: 0,
        }));
    }, []);
    const runSearch = (0, react_1.useCallback)((query) => {
        if (!query.trim())
            return;
        const results = (0, db_1.searchModules)(query);
        const artistResults = (0, db_1.searchArtists)(query);
        setState(s => ({ ...s, searchResults: results, searchArtistResults: artistResults, selectedIdx: 0 }));
    }, []);
    (0, ink_1.useInput)((input, key) => {
        if (!ready)
            return;
        // Quit
        if (key.ctrl && input === 'c') {
            exit();
            return;
        }
        // Nav shortcuts
        if (!state.isSearchFocused) {
            if (input === '1') {
                navigate('home');
                return;
            }
            if (input === '2') {
                navigate('search');
                return;
            }
            if (input === '3') {
                navigate('library');
                return;
            }
            if (input === '4') {
                navigate('queue');
                return;
            }
            if (key.escape) {
                goBack();
                return;
            }
            // Player controls
            if (input === ' ') {
                Player.togglePlayPause();
                return;
            }
            if (input === 'n' || input === 'N') {
                Player.nextTrack();
                return;
            }
            if (input === 'p' || input === 'P') {
                Player.prevTrack();
                return;
            }
            if (input === '+' || input === '=') {
                Player.setVolume(state.playerState.volume + 10);
                return;
            }
            if (input === '-' || input === '_') {
                Player.setVolume(state.playerState.volume - 10);
                return;
            }
            // List navigation
            if (key.upArrow) {
                setState(s => ({ ...s, selectedIdx: Math.max(0, s.selectedIdx - 1) }));
                return;
            }
            if (key.downArrow) {
                setState(s => {
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
            if (input === 't' || input === 'T') {
                setState(s => ({
                    ...s,
                    libraryTab: s.libraryTab === 'genres' ? 'artists' : 'genres',
                    searchMode: s.searchMode === 'tracks' ? 'artists' : 'tracks',
                    selectedIdx: 0,
                }));
                return;
            }
            // Queue add
            if (input === 'q' || input === 'Q') {
                const track = getSelectedTrack();
                if (track) {
                    Player.addToQueue(track);
                }
                return;
            }
        }
        // Search input handling
        if (state.view === 'search') {
            if (key.escape) {
                setState(s => ({ ...s, isSearchFocused: false }));
                return;
            }
            if (input === '/' && !state.isSearchFocused) {
                setState(s => ({ ...s, isSearchFocused: true }));
                return;
            }
            if (state.isSearchFocused) {
                if (key.return) {
                    runSearch(state.searchQuery);
                    setState(s => ({ ...s, isSearchFocused: false }));
                    return;
                }
                if (key.backspace || key.delete) {
                    setState(s => ({ ...s, searchQuery: s.searchQuery.slice(0, -1) }));
                    return;
                }
                if (input && input.length === 1) {
                    setState(s => ({ ...s, searchQuery: s.searchQuery + input }));
                    return;
                }
            }
        }
    });
    function getListLength(s) {
        switch (s.view) {
            case 'search': return s.searchMode === 'tracks' ? s.searchResults.length : s.searchArtistResults.length;
            case 'library': return s.libraryTab === 'genres' ? s.genres.length : s.artists.length;
            case 'artist': return s.artistModules.length;
            case 'genre': return s.genreModules.length;
            case 'queue': return s.playerState.queue.length;
            default: return 0;
        }
    }
    function getSelectedTrack() {
        switch (state.view) {
            case 'search': return state.searchMode === 'tracks' ? state.searchResults[state.selectedIdx] ?? null : null;
            case 'artist': return state.artistModules[state.selectedIdx] ?? null;
            case 'genre': return state.genreModules[state.selectedIdx] ?? null;
            case 'queue': return state.playerState.queue[state.selectedIdx] ?? null;
            default: return null;
        }
    }
    function handleEnter() {
        const { view, selectedIdx, searchMode } = state;
        if (view === 'search') {
            if (searchMode === 'tracks') {
                const track = state.searchResults[selectedIdx];
                if (track)
                    Player.playModule(track);
            }
            else {
                const artist = state.searchArtistResults[selectedIdx];
                if (artist)
                    openArtist(artist);
            }
            return;
        }
        if (view === 'library') {
            if (state.libraryTab === 'genres') {
                const genre = state.genres[selectedIdx];
                if (genre)
                    openGenre(genre);
            }
            else {
                const artist = state.artists[selectedIdx];
                if (artist)
                    openArtist(artist);
            }
            return;
        }
        if (view === 'artist') {
            const track = state.artistModules[selectedIdx];
            if (track)
                Player.playQueue(state.artistModules, selectedIdx);
            return;
        }
        if (view === 'genre') {
            const track = state.genreModules[selectedIdx];
            if (track)
                Player.playQueue(state.genreModules, selectedIdx);
            return;
        }
        if (view === 'queue') {
            const track = state.playerState.queue[selectedIdx];
            if (track)
                Player.playQueue(state.playerState.queue, selectedIdx);
            return;
        }
    }
    if (!ready) {
        return (react_1.default.createElement(ink_1.Box, { padding: 2 },
            react_1.default.createElement(ink_1.Text, { color: "green" }, "\u266B Loading ModPlayer\u2026")));
    }
    return (react_1.default.createElement(ink_1.Box, { flexDirection: "column", height: process.stdout.rows ?? 40 },
        react_1.default.createElement(ink_1.Box, { flexDirection: "row", flexGrow: 1 },
            react_1.default.createElement(ink_1.Box, { flexDirection: "column", borderStyle: "single", borderColor: "gray", width: 18 },
                react_1.default.createElement(Sidebar, { activeView: state.view, onNav: navigate })),
            react_1.default.createElement(ink_1.Box, { flexDirection: "column", flexGrow: 1, borderStyle: "single", borderColor: "gray", paddingY: 1 },
                state.view === 'home' && (react_1.default.createElement(HomeView, { onNavigate: navigate, stats: state.stats })),
                state.view === 'search' && (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 1 },
                    react_1.default.createElement(ink_1.Box, { paddingX: 2, gap: 2 },
                        react_1.default.createElement(ink_1.Text, { color: "green", bold: true }, "\u2315 Search:"),
                        react_1.default.createElement(ink_1.Box, { borderStyle: "single", borderColor: state.isSearchFocused ? 'green' : 'gray', paddingX: 1, minWidth: 30 },
                            react_1.default.createElement(ink_1.Text, { color: state.isSearchFocused ? 'white' : 'gray' },
                                state.searchQuery || (state.isSearchFocused ? '' : 'Press / to type…'),
                                state.isSearchFocused && react_1.default.createElement(ink_1.Text, { color: "green" }, "\u2588"))),
                        !state.isSearchFocused && react_1.default.createElement(ink_1.Text, { dimColor: true }, "[/] focus  [T] toggle mode  [Enter] search")),
                    react_1.default.createElement(ink_1.Box, { paddingX: 2, gap: 2 },
                        react_1.default.createElement(ink_1.Text, { color: state.searchMode === 'tracks' ? 'green' : 'gray', bold: state.searchMode === 'tracks', underline: state.searchMode === 'tracks' }, "Tracks"),
                        react_1.default.createElement(ink_1.Text, { color: state.searchMode === 'artists' ? 'green' : 'gray', bold: state.searchMode === 'artists', underline: state.searchMode === 'artists' }, "Artists"),
                        react_1.default.createElement(ink_1.Text, { dimColor: true }, "[T] to toggle")),
                    state.searchMode === 'tracks' ? (react_1.default.createElement(TrackList, { modules: state.searchResults, selectedIdx: state.selectedIdx, title: state.searchResults.length > 0 ? `Tracks (${state.searchResults.length})` : 'Enter a search term' })) : (react_1.default.createElement(ArtistList, { artists: state.searchArtistResults, selectedIdx: state.selectedIdx, title: state.searchArtistResults.length > 0 ? `Artists (${state.searchArtistResults.length})` : 'Enter a search term' })))),
                state.view === 'library' && (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 1 },
                    react_1.default.createElement(ink_1.Box, { paddingX: 2, gap: 3 },
                        react_1.default.createElement(ink_1.Text, { color: state.libraryTab === 'genres' ? 'green' : 'gray', bold: state.libraryTab === 'genres', underline: state.libraryTab === 'genres' }, "Genres"),
                        react_1.default.createElement(ink_1.Text, { color: state.libraryTab === 'artists' ? 'green' : 'gray', bold: state.libraryTab === 'artists', underline: state.libraryTab === 'artists' }, "Artists"),
                        react_1.default.createElement(ink_1.Text, { dimColor: true }, "[T] to toggle  [Enter] to open")),
                    state.libraryTab === 'genres' ? (react_1.default.createElement(GenreGrid, { genres: state.genres, selectedIdx: state.selectedIdx })) : (react_1.default.createElement(ArtistList, { artists: state.artists, selectedIdx: state.selectedIdx, title: `Artists (${state.artists.length})` })))),
                state.view === 'artist' && state.focusedArtist && (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 1 },
                    react_1.default.createElement(ink_1.Box, { paddingX: 2, flexDirection: "column" },
                        react_1.default.createElement(ink_1.Text, { color: "green", bold: true },
                            "\u25C9 ",
                            state.focusedArtist.name),
                        react_1.default.createElement(ink_1.Box, { gap: 3 },
                            react_1.default.createElement(ink_1.Text, { dimColor: true },
                                state.focusedArtist.module_count ?? '?',
                                " modules"),
                            react_1.default.createElement(Stars, { rating: state.focusedArtist.rating }),
                            react_1.default.createElement(ink_1.Text, { dimColor: true }, "[Esc] back  [Enter] play all from here  [Q] add to queue"))),
                    react_1.default.createElement(TrackList, { modules: state.artistModules, selectedIdx: state.selectedIdx, title: `Tracks (${state.artistModules.length})`, showArtist: false }))),
                state.view === 'genre' && state.focusedGenre && (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 1 },
                    react_1.default.createElement(ink_1.Box, { paddingX: 2, flexDirection: "column" },
                        react_1.default.createElement(ink_1.Text, { color: "green", bold: true },
                            "\u266A ",
                            state.focusedGenre.name.toUpperCase()),
                        react_1.default.createElement(ink_1.Text, { dimColor: true }, "[Esc] back  [Enter] play  [Q] add to queue")),
                    react_1.default.createElement(TrackList, { modules: state.genreModules, selectedIdx: state.selectedIdx, title: `Tracks in ${state.focusedGenre.name} (${state.genreModules.length})` }))),
                state.view === 'queue' && (react_1.default.createElement(ink_1.Box, { flexDirection: "column", gap: 1 },
                    react_1.default.createElement(ink_1.Box, { paddingX: 2, gap: 2 },
                        react_1.default.createElement(ink_1.Text, { color: "green", bold: true }, "\u2261 Play Queue"),
                        react_1.default.createElement(ink_1.Text, { dimColor: true },
                            "(",
                            state.playerState.queue.length,
                            " tracks)  [Enter] play from here")),
                    state.playerState.queue.length === 0 ? (react_1.default.createElement(ink_1.Box, { paddingX: 2, paddingY: 2 },
                        react_1.default.createElement(ink_1.Text, { dimColor: true }, "Queue is empty. Press [Q] on any track to add it."))) : (react_1.default.createElement(TrackList, { modules: state.playerState.queue, selectedIdx: state.selectedIdx, title: "" })))))),
        react_1.default.createElement(PlayerBar, { playerState: state.playerState })));
}
