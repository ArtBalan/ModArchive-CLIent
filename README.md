# ModArchive-CLIent

A terminal-based music player for [The Mod Archive](https://modarchive.org/), built with Ink (React for the terminal). Browse artists and genres, download tracker modules, convert them to FLAC, and play them — all from the command line.

![screenshot](docs/screenshot.png)

---

## Features

- Browse artists, genres, and tracks from a local ModArchive database
- Search modules and artists
- Download modules directly from ModArchive
- Auto-convert downloaded modules to FLAC using openmpt123
- Play FLAC files via ffplay
- Queue management with shuffle support
- Volume control (applies on next track)
- Progress bar with elapsed / total time

---

## Requirements

### Node.js

**Node.js 18 or later** is required.

Download from https://nodejs.org/

### External binaries

Three executables are required. Place them in your project root **or** add them to your system PATH.

#### openmpt123

Used to convert tracker modules (.xm, .mod, .it, .s3m, etc.) to FLAC.

Download the Windows binary zip from:
```
https://lib.openmpt.org/files/libopenmpt/bin/libopenmpt-0.7.13+release.bin.windows.zip
```

Extract and copy `openmpt123.exe` and all `.dll` files from the `x86_64` folder into your project root.

#### ffmpeg / ffplay / ffprobe

Used to play FLAC files and probe audio duration.

Download a Windows build from https://ffmpeg.org/download.html (recommend the BtbN or Gyan builds).

Copy `ffmpeg.exe`, `ffplay.exe`, and `ffprobe.exe` into your project root.

Alternatively, add them to your system PATH via `winget`:
```powershell
winget install Gyan.FFmpeg
```

### ModArchive database

The app requires a `scraper.db` SQLite database file in the project root. This is a pre-scraped database of ModArchive metadata (artists, modules, genres).

Use the [ModArchive-Scraper](https://github.com/ArtBalan/ModArchive-Scraper) to generate the database.

The database schema expects these tables: `artists`, `modules`, `genres`, `module_genres`.

Place `scraper.db` in the project root before running. If no database is found, the app falls back to a small built-in mock dataset for testing.

---

## Installation

```powershell
# Clone the repository
git clone https://github.com/yourname/ModArchive-CLIent.git
cd ModArchive-CLIent

# Install Node dependencies
npm install

# Place required binaries in the project root:
#   openmpt123.exe + DLLs
#   ffmpeg.exe, ffplay.exe, ffprobe.exe
#   scraper.db

# Build and run
npm start
```

---

## Project structure

```
ModArchive-CLIent/
├── src/
│   ├── App.tsx          # Main UI — views, navigation, download logic
│   ├── player.ts        # Playback engine (ffplay + openmpt123)
│   ├── db.ts            # Database access (sql.js)
│   └── index.tsx        # Entry point
├── Roaster/             # Downloaded modules and converted FLACs (auto-created)
│   └── {ArtistName}/
│       ├── track.xm
│       └── track.flac
├── scraper.db           # ModArchive metadata database (you provide this)
├── openmpt123.exe       # Required binary
├── ffmpeg.exe           # Required binary
├── ffplay.exe           # Required binary
├── ffprobe.exe          # Required binary
├── download.log         # Download and conversion log (auto-created)
├── player.log           # Playback log (auto-created)
├── tsconfig.json
├── package.json
└── build.mjs
```

---

## Usage

```powershell
# Run with default database (scraper.db in current directory)
npm start

# Run with a custom database path
npm start -- path/to/your.db
```

### Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection |
| `←` / `→` | Move in genre grid |
| `Enter` | Open / play selected item |
| `Esc` | Go back |
| `1` | Home |
| `2` | Search |
| `3` | Library |
| `4` | Queue |
| `/` | Focus search bar |
| `T` | Toggle search mode (tracks / artists) |
| `Q` | Add selected track to queue |

### Playback

| Key | Action |
|-----|--------|
| `Space` | Pause / resume |
| `N` | Next track |
| `P` | Previous track |
| `S` | Toggle shuffle |
| `+` / `=` | Volume up |
| `-` | Volume down |

---

## How downloads and conversion work

When you press `Enter` on a module:

1. The module file is downloaded from `http://api.modarchive.org/downloads.php?moduleid={id}` and saved to `Roaster/{ArtistName}/{filename}`.
2. `openmpt123` converts it to FLAC: `openmpt123 --render --output-type flac --samplerate 44100 --channels 2 --force -- file.xm`
3. The FLAC file is played via `ffplay`.
4. The local path is stored in the database so subsequent plays skip the download and conversion steps.

The status bar above the player shows the current stage: `⬇ Downloading`, `⚙ Converting to FLAC`, `✔ Ready`, or `✖ Error`.

---

## Utility scripts

### scan-extensions.cjs

Scans your `Roaster` folder and reports a breakdown of module file extensions.

```powershell
node scan-extensions.cjs
```

### convert-to-flac.cjs

Batch-converts all downloaded modules in `Roaster` to FLAC.

```powershell
node convert-to-flac.cjs              # convert all not-yet-converted
node convert-to-flac.cjs --force      # reconvert even if .flac exists
node convert-to-flac.cjs --dry-run    # preview what would be converted
```

---

## Troubleshooting

**`openmpt123` not found**
Make sure `openmpt123.exe` and all its `.dll` files are in the project root or in your PATH. Run `.\openmpt123 --version` to verify.

**`ffplay` not found**
Make sure `ffplay.exe` is in the project root or in your PATH. Run `ffplay -version` to verify.

**`Error: no such column: m.local_path`**
The database migration runs automatically on startup. Make sure you are using the latest `db.ts` which runs `ALTER TABLE modules ADD COLUMN local_path TEXT` on init.

**HTTP 403 on download**
Some modules on ModArchive are restricted. Try a different module.

**Conversion failed**
Check `download.log` for details. Common causes: corrupted module file, unsupported format variant, or missing openmpt123 DLLs.

**Multiple tracks playing simultaneously**
Delete any stray `ffplay.exe` processes in Task Manager, then restart the app. This was a known issue fixed in recent versions.

---

## Tech stack

| Package | Purpose |
|---------|---------|
| [ink](https://github.com/vadimdemedes/ink) | React renderer for the terminal |
| [react](https://react.dev/) | UI framework |
| [sql.js](https://sql.js.org/) | SQLite in Node.js (WebAssembly) |
| [esbuild](https://esbuild.github.io/) | TypeScript bundler |
| openmpt123 | Tracker module renderer |
| ffplay | Audio playback |
| ffprobe | Audio metadata |

---

## License

MIT
