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
exports.initDb = initDb;
exports.getTopArtists = getTopArtists;
exports.getAllArtists = getAllArtists;
exports.searchArtists = searchArtists;
exports.getModulesByArtist = getModulesByArtist;
exports.getRecentModules = getRecentModules;
exports.searchModules = searchModules;
exports.getModulesByGenre = getModulesByGenre;
exports.getAllGenres = getAllGenres;
exports.getGenresForModule = getGenresForModule;
exports.getArtistById = getArtistById;
exports.getDbStats = getDbStats;
const fs = __importStar(require("fs"));
// We'll use a simple in-memory mock database if no scraper.db found,
// or load the real one with sql.js
let db = null;
let useMock = false;
const MOCK_ARTISTS = [
    { id: '1', name: 'Jester', module_count: 12, rating: 4.8, rating_count: 340 },
    { id: '2', name: 'Skaven', module_count: 8, rating: 4.9, rating_count: 520 },
    { id: '3', name: 'Purple Motion', module_count: 15, rating: 4.7, rating_count: 280 },
    { id: '4', name: 'Necros', module_count: 20, rating: 4.6, rating_count: 190 },
    { id: '5', name: 'Basehead', module_count: 6, rating: 4.5, rating_count: 150 },
    { id: '6', name: 'Elwood', module_count: 9, rating: 4.4, rating_count: 120 },
    { id: '7', name: 'Lizardking', module_count: 11, rating: 4.8, rating_count: 420 },
    { id: '8', name: 'Hunz', module_count: 7, rating: 4.3, rating_count: 90 },
    { id: '9', name: 'Dune', module_count: 5, rating: 4.7, rating_count: 310 },
    { id: '10', name: 'Nuke', module_count: 18, rating: 4.5, rating_count: 230 },
];
const MOCK_MODULES = [
    { id: '1', artist_id: '1', file_name: 'space_debris.xm', module_name: 'Space Debris', md5: 'abc123', artist_name: 'Jester', genres: ['techno', 'ambient'] },
    { id: '2', artist_id: '2', file_name: '2nd_reality.s3m', module_name: '2nd Reality', md5: 'def456', artist_name: 'Skaven', genres: ['techno'] },
    { id: '3', artist_id: '3', file_name: 'stargazer.xm', module_name: 'Stargazer', md5: 'ghi789', artist_name: 'Purple Motion', genres: ['trance', 'ambient'] },
    { id: '4', artist_id: '4', file_name: 'chronic.xm', module_name: 'Chronic', md5: 'jkl012', artist_name: 'Necros', genres: ['electronic'] },
    { id: '5', artist_id: '5', file_name: 'believe.xm', module_name: 'Believe', md5: 'mno345', artist_name: 'Basehead', genres: ['trance'] },
    { id: '6', artist_id: '7', file_name: 'elysium.xm', module_name: 'Elysium', md5: 'pqr678', artist_name: 'Lizardking', genres: ['ambient', 'chiptune'] },
    { id: '7', artist_id: '1', file_name: 'doomsday.xm', module_name: 'Doomsday Zone', md5: 'stu901', artist_name: 'Jester', genres: ['techno'] },
    { id: '8', artist_id: '9', file_name: 'ocean.s3m', module_name: 'Ocean Machine', md5: 'vwx234', artist_name: 'Dune', genres: ['ambient'] },
    { id: '9', artist_id: '2', file_name: 'catchme.s3m', module_name: 'Catch Me', md5: 'yza567', artist_name: 'Skaven', genres: ['techno', 'electronic'] },
    { id: '10', artist_id: '3', file_name: 'world_of.xm', module_name: 'World of Dreams', md5: 'bcd890', artist_name: 'Purple Motion', genres: ['trance'] },
    { id: '11', artist_id: '10', file_name: 'hyperventilation.xm', module_name: 'Hyperventilation', md5: 'efg123', artist_name: 'Nuke', genres: ['techno', 'trance'] },
    { id: '12', artist_id: '4', file_name: 'thrill.xm', module_name: 'The Thrill', md5: 'hij456', artist_name: 'Necros', genres: ['electronic'] },
    { id: '13', artist_id: '7', file_name: 'wonderland.xm', module_name: 'Wonderland', md5: 'klm789', artist_name: 'Lizardking', genres: ['ambient'] },
    { id: '14', artist_id: '5', file_name: 'frantic.xm', module_name: 'Frantic', md5: 'nop012', artist_name: 'Basehead', genres: ['chiptune'] },
    { id: '15', artist_id: '6', file_name: 'dawn.xm', module_name: 'Dawn', md5: 'qrs345', artist_name: 'Elwood', genres: ['ambient', 'trance'] },
];
const MOCK_GENRES = [
    { id: 1, name: 'techno' },
    { id: 2, name: 'ambient' },
    { id: 3, name: 'trance' },
    { id: 4, name: 'electronic' },
    { id: 5, name: 'chiptune' },
];
async function initDb(dbPath) {
    if (dbPath && fs.existsSync(dbPath)) {
        try {
            const initSqlJs = require('sql.js');
            const SQL = await initSqlJs();
            const fileBuffer = fs.readFileSync(dbPath);
            db = new SQL.Database(fileBuffer);
            useMock = false;
            return;
        }
        catch (e) {
            // Fall through to mock
        }
    }
    useMock = true;
}
function getTopArtists(limit = 20) {
    if (useMock)
        return MOCK_ARTISTS.slice(0, limit);
    const stmt = db.prepare(`
    SELECT id, name, module_count, rating, rating_count
    FROM artists
    WHERE rating IS NOT NULL
    ORDER BY rating DESC
    LIMIT ?
  `);
    stmt.bind([limit]);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows;
}
function getAllArtists(limit = 50) {
    if (useMock)
        return MOCK_ARTISTS;
    const stmt = db.prepare(`SELECT id, name, module_count, rating, rating_count FROM artists ORDER BY name LIMIT ?`);
    stmt.bind([limit]);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows;
}
function searchArtists(query, limit = 20) {
    if (useMock)
        return MOCK_ARTISTS.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));
    const stmt = db.prepare(`SELECT id, name, module_count, rating, rating_count FROM artists WHERE name LIKE ? LIMIT ?`);
    stmt.bind([`%${query}%`, limit]);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows;
}
function getModulesByArtist(artistId) {
    if (useMock)
        return MOCK_MODULES.filter(m => m.artist_id === artistId);
    const artist = getArtistById(artistId);
    const stmt = db.prepare(`SELECT id, artist_id, file_name, module_name, md5 FROM modules WHERE artist_id = ?`);
    stmt.bind([artistId]);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows.map(m => ({
        ...m,
        artist_name: artist?.name ?? '',
        genres: getGenresForModule(m.id),
    }));
}
function getRecentModules(limit = 20) {
    if (useMock)
        return MOCK_MODULES.slice(0, limit);
    const stmt = db.prepare(`
    SELECT m.id, m.artist_id, m.file_name, m.module_name, m.md5, a.name as artist_name
    FROM modules m
    JOIN artists a ON m.artist_id = a.id
    WHERE m.module_name IS NOT NULL
    LIMIT ?
  `);
    stmt.bind([limit]);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows.map(r => ({ ...r, genres: getGenresForModule(r.id) }));
}
function searchModules(query, limit = 30) {
    if (useMock) {
        const q = query.toLowerCase();
        return MOCK_MODULES.filter(m => m.module_name?.toLowerCase().includes(q) ||
            m.file_name?.toLowerCase().includes(q) ||
            m.artist_name.toLowerCase().includes(q));
    }
    const stmt = db.prepare(`
    SELECT m.id, m.artist_id, m.file_name, m.module_name, m.md5, a.name as artist_name
    FROM modules m
    JOIN artists a ON m.artist_id = a.id
    WHERE m.module_name LIKE ? OR m.file_name LIKE ? OR a.name LIKE ?
    LIMIT ?
  `);
    stmt.bind([`%${query}%`, `%${query}%`, `%${query}%`, limit]);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows.map(r => ({ ...r, genres: getGenresForModule(r.id) }));
}
function getModulesByGenre(genreName, limit = 30) {
    if (useMock)
        return MOCK_MODULES.filter(m => m.genres.includes(genreName)).slice(0, limit);
    const stmt = db.prepare(`
    SELECT m.id, m.artist_id, m.file_name, m.module_name, m.md5, a.name as artist_name
    FROM modules m
    JOIN artists a ON m.artist_id = a.id
    JOIN module_genres mg ON m.id = mg.module_id
    JOIN genres g ON mg.genre_id = g.id
    WHERE g.name = ?
    LIMIT ?
  `);
    stmt.bind([genreName, limit]);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows.map(r => ({ ...r, genres: getGenresForModule(r.id) }));
}
function getAllGenres() {
    if (useMock)
        return MOCK_GENRES;
    const stmt = db.prepare(`SELECT id, name FROM genres ORDER BY name`);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    return rows;
}
function getGenresForModule(moduleId) {
    if (useMock)
        return MOCK_MODULES.find(m => m.id === moduleId)?.genres ?? [];
    const stmt = db.prepare(`
    SELECT g.name FROM genres g
    JOIN module_genres mg ON g.id = mg.genre_id
    WHERE mg.module_id = ?
  `);
    stmt.bind([moduleId]);
    const names = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        names.push(row.name);
    }
    return names;
}
function getArtistById(id) {
    if (useMock)
        return MOCK_ARTISTS.find(a => a.id === id) ?? null;
    const stmt = db.prepare(`SELECT id, name, module_count, rating, rating_count FROM artists WHERE id = ?`);
    stmt.bind([id]);
    if (stmt.step())
        return stmt.getAsObject();
    return null;
}
function getDbStats() {
    if (useMock)
        return { artists: MOCK_ARTISTS.length, modules: MOCK_MODULES.length, genres: MOCK_GENRES.length };
    const a = db.exec('SELECT COUNT(*) FROM artists')[0]?.values[0][0] ?? 0;
    const m = db.exec('SELECT COUNT(*) FROM modules')[0]?.values[0][0] ?? 0;
    const g = db.exec('SELECT COUNT(*) FROM genres')[0]?.values[0][0] ?? 0;
    return { artists: Number(a), modules: Number(m), genres: Number(g) };
}
