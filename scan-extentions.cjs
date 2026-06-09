#!/usr/bin/env node
/**
 * scan-extensions.js
 * Scans all modules in the DB and reports file extension stats.
 * Usage: node scan-extensions.js [path/to/scraper.db]
 */

const fs = require("fs");
const path = require("path");

async function main() {
  const dbPath = process.argv[2] ?? path.join(process.cwd(), "scraper.db");

  if (!fs.existsSync(dbPath)) {
    console.error(`❌  DB not found: ${dbPath}`);
    process.exit(1);
  }

  console.log(`📂  Scanning: ${dbPath}\n`);

  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const result = db.exec(
    `SELECT file_name FROM modules WHERE file_name IS NOT NULL`,
  );

  if (!result.length) {
    console.log("No modules found.");
    return;
  }

  const fileNames = result[0].values.map((row) => row[0]);
  const total = fileNames.length;

  const extCount = new Map();
  let noExt = 0;

  for (const name of fileNames) {
    const ext = path.extname(name).toLowerCase();
    if (!ext) {
      noExt++;
    } else {
      extCount.set(ext, (extCount.get(ext) ?? 0) + 1);
    }
  }

  const sorted = [...extCount.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`📊  Total modules scanned: ${total.toLocaleString()}\n`);
  console.log(
    `${"Extension".padEnd(12)} ${"Count".padStart(8)}  ${"Share".padStart(7)}`,
  );
  console.log("─".repeat(32));

  for (const [ext, count] of sorted) {
    const pct = ((count / total) * 100).toFixed(1).padStart(6);
    console.log(`${ext.padEnd(12)} ${String(count).padStart(8)}  ${pct}%`);
  }

  if (noExt > 0) {
    const pct = ((noExt / total) * 100).toFixed(1).padStart(6);
    console.log(
      `${"(no ext)".padEnd(12)} ${String(noExt).padStart(8)}  ${pct}%`,
    );
  }

  console.log("─".repeat(32));
  console.log(`${"TOTAL".padEnd(12)} ${String(total).padStart(8)}`);

  db.close();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
