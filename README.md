# ModPlayer 🎵

A Spotify-style **terminal music player** for [ModArchive](https://modarchive.org) built with [Ink](https://github.com/vadimdemedes/ink) (React for terminals) and TypeScript.

Works standalone with built-in demo data, or connects to a real `scraper.db` from the ModArchive scraper.

---

## Quick Start

```bash
# Install dependencies
npm install

# Run with demo data (no scraper.db needed)
npm start

# Run with your real scraper database
npm start /path/to/scraper.db

# Or if scraper.db is in the current directory
npm start
```

---

## Features

```
┌──────────────────┬─────────────────────────────────────────────┐
│  ♫ MODPLAYER     │                                             │
│                  │  Content area                               │
│  ⌂ Home          │                                             │
│  ⌕ Search        │                                             │
│  ▤ Library       │                                             │
│  ≡ Queue         │                                             │
│                  │                                             │
│  CONTROLS        │                                             │
│    1-4 Navigate  │                                             │
│    ↑↓  Move      │                                             │
│    Enter Select  │                                             │
│    Q   Add queue │                                             │
│    Esc Back      │                                             │
└──────────────────┴─────────────────────────────────────────────┘
│ ▶ Space Debris        Jester          ████████████░░░ 43%      │
│ ♪ techno · ambient                          Vol ▮▮▮▮▮▮▮░░ 70% │
└─────────────────────────────────────────────────────────────────┘
```

### Views

| View | Key | Description |
|------|-----|-------------|
| **Home** | `1` | Stats overview and quick tips |
| **Search** | `2` | Search tracks and artists |
| **Library** | `3` | Browse genres and artists |
| **Queue** | `4` | Current play queue |

### Controls

| Key | Action |
|-----|--------|
| `1` / `2` / `3` / `4` | Switch views |
| `↑` / `↓` | Navigate list |
| `Enter` | Play / open |
| `Space` | Play / pause |
| `N` | Next track |
| `P` | Previous track |
| `+` / `-` | Volume up / down |
| `Q` | Add to queue |
| `T` | Toggle tabs (genres↔artists, tracks↔artists) |
| `/` | Focus search input |
| `Esc` | Go back / unfocus |
| `Ctrl+C` | Quit |

---

## Database

If `scraper.db` exists (from the ModArchive scraper), ModPlayer loads it automatically. Otherwise it uses built-in demo data with classic demoscene tracks.

The player does **not** actually play audio — ModArchive modules require a tracker player (like [libxmp](https://xmp.sourceforge.net/) or [OpenMPT](https://openmpt.org/)). ModPlayer is a library browser and queue manager. Connect it to your player of choice!
