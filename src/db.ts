import * as fs from "fs";
import * as path from "path";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Artist {
  id: string;
  name: string;
  module_count: number | null;
  rating: number | null;
  rating_count: number | null;
}

export interface Module {
  id: string;
  artist_id: string;
  file_name: string | null;
  module_name: string | null;
  md5: string | null;
  local_path: string | null;
  favorite: number; // 0 or 1
}

export interface Genre {
  id: number;
  name: string;
  module_count: number;
}

export interface ModuleWithArtist extends Module {
  artist_name: string;
  genres: string[];
}

// ─── Mock data ────────────────────────────────────────────────────────────────

let db: any = null;
let useMock = false;
let currentDbPath: string | null = null;

function saveDb(): void {
  if (!db || !currentDbPath) return;
  try {
    const data: Uint8Array = db.export();
    fs.writeFileSync(currentDbPath, Buffer.from(data));
  } catch (e) {
    console.error("[db] Failed to save:", e);
  }
}

const MOCK_ARTISTS: Artist[] = [
  { id: "1", name: "Jester", module_count: 12, rating: 4.8, rating_count: 340 },
  { id: "2", name: "Skaven", module_count: 8, rating: 4.9, rating_count: 520 },
  {
    id: "3",
    name: "Purple Motion",
    module_count: 15,
    rating: 4.7,
    rating_count: 280,
  },
  { id: "4", name: "Necros", module_count: 20, rating: 4.6, rating_count: 190 },
  {
    id: "5",
    name: "Basehead",
    module_count: 6,
    rating: 4.5,
    rating_count: 150,
  },
  { id: "6", name: "Elwood", module_count: 9, rating: 4.4, rating_count: 120 },
  {
    id: "7",
    name: "Lizardking",
    module_count: 11,
    rating: 4.8,
    rating_count: 420,
  },
  { id: "8", name: "Hunz", module_count: 7, rating: 4.3, rating_count: 90 },
  { id: "9", name: "Dune", module_count: 5, rating: 4.7, rating_count: 310 },
  { id: "10", name: "Nuke", module_count: 18, rating: 4.5, rating_count: 230 },
];

const MOCK_MODULES: ModuleWithArtist[] = [
  {
    id: "1",
    artist_id: "1",
    file_name: "space_debris.xm",
    module_name: "Space Debris",
    md5: "abc123",
    local_path: null,
    favorite: 0,
    artist_name: "Jester",
    genres: ["techno", "ambient"],
  },
  {
    id: "2",
    artist_id: "2",
    file_name: "2nd_reality.s3m",
    module_name: "2nd Reality",
    md5: "def456",
    local_path: null,
    favorite: 0,
    artist_name: "Skaven",
    genres: ["techno"],
  },
  {
    id: "3",
    artist_id: "3",
    file_name: "stargazer.xm",
    module_name: "Stargazer",
    md5: "ghi789",
    local_path: null,
    favorite: 0,
    artist_name: "Purple Motion",
    genres: ["trance", "ambient"],
  },
  {
    id: "4",
    artist_id: "4",
    file_name: "chronic.xm",
    module_name: "Chronic",
    md5: "jkl012",
    local_path: null,
    favorite: 0,
    artist_name: "Necros",
    genres: ["electronic"],
  },
  {
    id: "5",
    artist_id: "5",
    file_name: "believe.xm",
    module_name: "Believe",
    md5: "mno345",
    local_path: null,
    favorite: 0,
    artist_name: "Basehead",
    genres: ["trance"],
  },
  {
    id: "6",
    artist_id: "7",
    file_name: "elysium.xm",
    module_name: "Elysium",
    md5: "pqr678",
    local_path: null,
    favorite: 0,
    artist_name: "Lizardking",
    genres: ["ambient", "chiptune"],
  },
  {
    id: "7",
    artist_id: "1",
    file_name: "doomsday.xm",
    module_name: "Doomsday Zone",
    md5: "stu901",
    local_path: null,
    favorite: 0,
    artist_name: "Jester",
    genres: ["techno"],
  },
  {
    id: "8",
    artist_id: "9",
    file_name: "ocean.s3m",
    module_name: "Ocean Machine",
    md5: "vwx234",
    local_path: null,
    favorite: 0,
    artist_name: "Dune",
    genres: ["ambient"],
  },
  {
    id: "9",
    artist_id: "2",
    file_name: "catchme.s3m",
    module_name: "Catch Me",
    md5: "yza567",
    local_path: null,
    favorite: 0,
    artist_name: "Skaven",
    genres: ["techno", "electronic"],
  },
  {
    id: "10",
    artist_id: "3",
    file_name: "world_of.xm",
    module_name: "World of Dreams",
    md5: "bcd890",
    local_path: null,
    favorite: 0,
    artist_name: "Purple Motion",
    genres: ["trance"],
  },
  {
    id: "11",
    artist_id: "10",
    file_name: "hyperventilation.xm",
    module_name: "Hyperventilation",
    md5: "efg123",
    local_path: null,
    favorite: 0,
    artist_name: "Nuke",
    genres: ["techno", "trance"],
  },
  {
    id: "12",
    artist_id: "4",
    file_name: "thrill.xm",
    module_name: "The Thrill",
    md5: "hij456",
    local_path: null,
    favorite: 0,
    artist_name: "Necros",
    genres: ["electronic"],
  },
  {
    id: "13",
    artist_id: "7",
    file_name: "wonderland.xm",
    module_name: "Wonderland",
    md5: "klm789",
    local_path: null,
    favorite: 0,
    artist_name: "Lizardking",
    genres: ["ambient"],
  },
  {
    id: "14",
    artist_id: "5",
    file_name: "frantic.xm",
    module_name: "Frantic",
    md5: "nop012",
    local_path: null,
    favorite: 0,
    artist_name: "Basehead",
    genres: ["chiptune"],
  },
  {
    id: "15",
    artist_id: "6",
    file_name: "dawn.xm",
    module_name: "Dawn",
    md5: "qrs345",
    local_path: null,
    favorite: 0,
    artist_name: "Elwood",
    genres: ["ambient", "trance"],
  },
];

const MOCK_GENRES: Genre[] = [
  { id: 1, name: "techno", module_count: 4 },
  { id: 2, name: "ambient", module_count: 5 },
  { id: 3, name: "trance", module_count: 4 },
  { id: 4, name: "electronic", module_count: 3 },
  { id: 5, name: "chiptune", module_count: 2 },
];

// ─── Init & migrations ────────────────────────────────────────────────────────

export async function initDb(dbPath?: string): Promise<void> {
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      const initSqlJs = require("sql.js");
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      currentDbPath = dbPath;
      // Migrations — idempotent
      try {
        db.run(`ALTER TABLE modules ADD COLUMN local_path TEXT`);
      } catch (_) {}
      try {
        db.run(
          `ALTER TABLE modules ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0`,
        );
      } catch (_) {}
      saveDb();
      useMock = false;
      return;
    } catch (e) {
      // Fall through to mock
    }
  }
  useMock = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEL_MODULE = `m.id, m.artist_id, m.file_name, m.module_name, m.md5, m.local_path, COALESCE(m.favorite, 0) as favorite`;

function rowToModule(r: any, artistName: string): ModuleWithArtist {
  return {
    ...r,
    favorite: Number(r.favorite ?? 0),
    artist_name: artistName,
    genres: getGenresForModule(r.id),
  };
}

// ─── Artists ─────────────────────────────────────────────────────────────────

export function getTopArtists(limit = 9999): Artist[] {
  if (useMock) return MOCK_ARTISTS.slice(0, limit);
  const stmt = db.prepare(
    `SELECT id, name, module_count, rating, rating_count FROM artists WHERE rating IS NOT NULL ORDER BY rating DESC LIMIT ?`,
  );
  stmt.bind([limit]);
  const rows: Artist[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as any);
  return rows;
}

export function getAllArtists(limit = 9999): Artist[] {
  if (useMock) return MOCK_ARTISTS;
  const stmt = db.prepare(
    `SELECT id, name, module_count, rating, rating_count FROM artists ORDER BY name LIMIT ?`,
  );
  stmt.bind([limit]);
  const rows: Artist[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as any);
  return rows;
}

export function searchArtists(query: string, limit = 9999): Artist[] {
  if (useMock)
    return MOCK_ARTISTS.filter((a) =>
      a.name.toLowerCase().includes(query.toLowerCase()),
    );
  const stmt = db.prepare(
    `SELECT id, name, module_count, rating, rating_count FROM artists WHERE name LIKE ? LIMIT ?`,
  );
  stmt.bind([`%${query}%`, limit]);
  const rows: Artist[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as any);
  return rows;
}

export function getArtistById(id: string): Artist | null {
  if (useMock) return MOCK_ARTISTS.find((a) => a.id === id) ?? null;
  const stmt = db.prepare(
    `SELECT id, name, module_count, rating, rating_count FROM artists WHERE id = ?`,
  );
  stmt.bind([id]);
  if (stmt.step()) return stmt.getAsObject() as any;
  return null;
}

// ─── Modules ─────────────────────────────────────────────────────────────────

export function getModulesByArtist(artistId: string): ModuleWithArtist[] {
  if (useMock) return MOCK_MODULES.filter((m) => m.artist_id === artistId);
  const artist = getArtistById(artistId);
  const stmt = db.prepare(
    `SELECT id, artist_id, file_name, module_name, md5, local_path, COALESCE(favorite, 0) as favorite FROM modules WHERE artist_id = ?`,
  );
  stmt.bind([artistId]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows.map((r) => rowToModule(r, artist?.name ?? ""));
}

export function getRecentModules(limit = 9999): ModuleWithArtist[] {
  if (useMock) return MOCK_MODULES.slice(0, limit);
  const stmt = db.prepare(
    `SELECT ${SEL_MODULE}, a.name as artist_name FROM modules m JOIN artists a ON m.artist_id = a.id WHERE m.module_name IS NOT NULL LIMIT ?`,
  );
  stmt.bind([limit]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows.map((r) => rowToModule(r, r.artist_name));
}

export function searchModules(query: string, limit = 9999): ModuleWithArtist[] {
  if (useMock) {
    const q = query.toLowerCase();
    return MOCK_MODULES.filter(
      (m) =>
        m.module_name?.toLowerCase().includes(q) ||
        m.file_name?.toLowerCase().includes(q) ||
        m.artist_name.toLowerCase().includes(q),
    );
  }
  const stmt = db.prepare(
    `SELECT ${SEL_MODULE}, a.name as artist_name FROM modules m JOIN artists a ON m.artist_id = a.id WHERE m.module_name LIKE ? OR m.file_name LIKE ? OR a.name LIKE ? LIMIT ?`,
  );
  stmt.bind([`%${query}%`, `%${query}%`, `%${query}%`, limit]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows.map((r) => rowToModule(r, r.artist_name));
}

export function getModulesByGenre(
  genreName: string,
  limit = 9999,
): ModuleWithArtist[] {
  if (useMock)
    return MOCK_MODULES.filter((m) => m.genres.includes(genreName)).slice(
      0,
      limit,
    );
  const stmt = db.prepare(
    `SELECT ${SEL_MODULE}, a.name as artist_name FROM modules m JOIN artists a ON m.artist_id = a.id JOIN module_genres mg ON m.id = mg.module_id JOIN genres g ON mg.genre_id = g.id WHERE g.name = ? LIMIT ?`,
  );
  stmt.bind([genreName, limit]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows.map((r) => rowToModule(r, r.artist_name));
}

export function setModuleLocalPath(moduleId: string, localPath: string): void {
  if (useMock) {
    const m = MOCK_MODULES.find((m) => m.id === moduleId);
    if (m) m.local_path = localPath;
    return;
  }
  db.run(`UPDATE modules SET local_path = ? WHERE id = ?`, [
    localPath,
    moduleId,
  ]);
  saveDb();
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export function setModuleFavorite(moduleId: string, favorite: boolean): void {
  if (useMock) {
    const m = MOCK_MODULES.find((m) => m.id === moduleId);
    if (m) m.favorite = favorite ? 1 : 0;
    return;
  }
  db.run(`UPDATE modules SET favorite = ? WHERE id = ?`, [
    favorite ? 1 : 0,
    moduleId,
  ]);
  saveDb();
}

export function getFavorites(): ModuleWithArtist[] {
  if (useMock) return MOCK_MODULES.filter((m) => m.favorite === 1);
  const stmt = db.prepare(
    `SELECT ${SEL_MODULE}, a.name as artist_name FROM modules m JOIN artists a ON m.artist_id = a.id WHERE m.favorite = 1 ORDER BY a.name, m.module_name`,
  );
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows.map((r) => rowToModule(r, r.artist_name));
}

// ─── Downloaded playlist ──────────────────────────────────────────────────────

export function getDownloadedModules(): ModuleWithArtist[] {
  if (useMock) return MOCK_MODULES.filter((m) => m.local_path !== null);
  const stmt = db.prepare(
    `SELECT ${SEL_MODULE}, a.name as artist_name FROM modules m JOIN artists a ON m.artist_id = a.id WHERE m.local_path IS NOT NULL ORDER BY a.name, m.module_name`,
  );
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows.map((r) => rowToModule(r, r.artist_name));
}

// ─── Genres ───────────────────────────────────────────────────────────────────

export function getAllGenres(): Genre[] {
  if (useMock) return MOCK_GENRES;
  const stmt = db.prepare(
    `SELECT g.id, g.name, COUNT(mg.module_id) as module_count FROM genres g LEFT JOIN module_genres mg ON g.id = mg.genre_id GROUP BY g.id, g.name ORDER BY g.name`,
  );
  const rows: Genre[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as any);
  return rows;
}

export function getGenresForModule(moduleId: string): string[] {
  if (useMock) return MOCK_MODULES.find((m) => m.id === moduleId)?.genres ?? [];
  const stmt = db.prepare(
    `SELECT g.name FROM genres g JOIN module_genres mg ON g.id = mg.genre_id WHERE mg.module_id = ?`,
  );
  stmt.bind([moduleId]);
  const names: string[] = [];
  while (stmt.step()) names.push((stmt.getAsObject() as any).name);
  return names;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getDbStats(): {
  artists: number;
  modules: number;
  genres: number;
} {
  if (useMock)
    return {
      artists: MOCK_ARTISTS.length,
      modules: MOCK_MODULES.length,
      genres: MOCK_GENRES.length,
    };
  const a = db.exec("SELECT COUNT(*) FROM artists")[0]?.values[0][0] ?? 0;
  const m = db.exec("SELECT COUNT(*) FROM modules")[0]?.values[0][0] ?? 0;
  const g = db.exec("SELECT COUNT(*) FROM genres")[0]?.values[0][0] ?? 0;
  return { artists: Number(a), modules: Number(m), genres: Number(g) };
}
