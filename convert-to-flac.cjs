#!/usr/bin/env node
/**
 * convert-to-flac.cjs
 *
 * Scans ./Roaster for downloaded module files and converts them to FLAC.
 * Uses openmpt123 to render the module to raw PCM, then ffmpeg to encode FLAC.
 *
 * Requirements:
 *   - openmpt123  (https://lib.openmpt.org/libopenmpt/)
 *   - ffmpeg      (https://ffmpeg.org/)
 *
 * Usage:
 *   node convert-to-flac.cjs              # convert all not-yet-converted
 *   node convert-to-flac.cjs --force      # reconvert even if .flac exists
 *   node convert-to-flac.cjs --dry-run    # just list what would be converted
 */

const fs = require("fs");
const path = require("path");
const { spawnSync, spawn } = require("child_process");

const ROASTER_DIR = path.join(process.cwd(), "Roaster");
const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");
const SAMPLERATE = 44100;
const CHANNELS = 2;

const MODULE_EXTS = new Set([
  ".xm",
  ".mod",
  ".it",
  ".s3m",
  ".mptm",
  ".ahx",
  ".dbm",
  ".mtm",
  ".mt2",
  ".mo3",
  ".med",
  ".hvl",
  ".imf",
  ".stm",
  ".669",
  ".fmt",
  ".dsm",
  ".ult",
  ".gdm",
]);

// ─── Check dependencies ──────────────────────────────────────────────────────

function checkTool(name) {
  const result = spawnSync(name, ["--version"], { encoding: "utf8" });
  if (result.error) {
    console.error(`❌  '${name}' not found in PATH. Please install it first.`);
    if (name === "openmpt123")
      console.error("    → https://lib.openmpt.org/libopenmpt/");
    if (name === "ffmpeg")
      console.error("    → https://ffmpeg.org/download.html");
    process.exit(1);
  }
}

checkTool("openmpt123");
checkTool("ffmpeg");

// ─── Collect files ───────────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (MODULE_EXTS.has(path.extname(entry.name).toLowerCase()))
      results.push(full);
  }
  return results;
}

const files = walkDir(ROASTER_DIR);
const toConvert = files.filter((f) => {
  const flac = f.replace(/\.[^.]+$/, ".flac");
  return FORCE || !fs.existsSync(flac);
});

console.log(`📂  Roaster: ${ROASTER_DIR}`);
console.log(`🎵  Module files found : ${files.length}`);
console.log(`🔄  To convert        : ${toConvert.length}`);
if (FORCE) console.log("    (--force: reconverting existing FLACs)");
if (DRY_RUN) {
  console.log("\n[dry-run] Files that would be converted:");
  toConvert.forEach((f) => console.log("  ", f));
  process.exit(0);
}
if (toConvert.length === 0) {
  console.log("\n✅  Nothing to do.");
  process.exit(0);
}
console.log("");

// ─── Convert ─────────────────────────────────────────────────────────────────

let done = 0,
  failed = 0;

function formatTime(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

async function convertFile(srcPath) {
  const rel = path.relative(ROASTER_DIR, srcPath);
  const dest = srcPath.replace(/\.[^.]+$/, ".flac");
  const tmp = dest + ".part";

  process.stdout.write(`  ⬇  ${rel.padEnd(55)} `);

  return new Promise((resolve) => {
    // openmpt123 renders to raw signed 16-bit little-endian PCM on stdout
    const openmpt = spawn(
      "openmpt123",
      [
        "--render",
        "-",
        "--output-type",
        "raw",
        "--samplerate",
        String(SAMPLERATE),
        "--channels",
        String(CHANNELS),
        "--float",
        "0",
        srcPath,
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );

    // ffmpeg reads raw PCM from stdin, encodes to FLAC
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "s16le",
        "-ar",
        String(SAMPLERATE),
        "-ac",
        String(CHANNELS),
        "-i",
        "pipe:0",
        "-c:a",
        "flac",
        "-compression_level",
        "8",
        tmp,
      ],
      { stdio: ["pipe", "ignore", "ignore"] },
    );

    openmpt.stdout.pipe(ffmpeg.stdin);
    openmpt.on("exit", () => {
      try {
        ffmpeg.stdin.end();
      } catch (_) {}
    });

    const start = Date.now();
    ffmpeg.on("exit", (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0 && fs.existsSync(tmp)) {
        fs.renameSync(tmp, dest);
        const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
        console.log(`✔  ${sizeMB} MB  (${elapsed}s)`);
        done++;
      } else {
        try {
          fs.unlinkSync(tmp);
        } catch (_) {}
        console.log(`✖  failed (exit ${code})`);
        failed++;
      }
      resolve();
    });

    openmpt.on("error", (err) => {
      console.log(`✖  openmpt123 error: ${err.message}`);
      failed++;
      resolve();
    });
    ffmpeg.on("error", (err) => {
      console.log(`✖  ffmpeg error: ${err.message}`);
      failed++;
      resolve();
    });
  });
}

(async () => {
  const total = toConvert.length;
  for (let i = 0; i < total; i++) {
    process.stdout.write(
      `[${String(i + 1).padStart(String(total).length)}/${total}] `,
    );
    await convertFile(toConvert[i]);
  }
  console.log("");
  console.log(`✅  Done: ${done} converted, ${failed} failed`);
})();
