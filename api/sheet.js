// Vercel serverless function: /api/sheet
// Keeps ONE Excel workbook (agrosphere-ai-data.xlsx) in a PRIVATE Vercel Blob store.
// Sheet "Entries" holds every app entry as one row:
//   id | userId | entryType | data | createdAt | updatedAt | deleted
//
// POST actions: register | login | push | pull     (used by js/sync.js)
// GET  ?status                                     -> { enabled } (the app turns sync on automatically)
// GET  ?download&key=SHEET_ADMIN_KEY               -> downloads the .xlsx so you can open it in Excel
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import * as XLSX from 'xlsx';

const COLUMNS = ['id', 'userId', 'entryType', 'data', 'createdAt', 'updatedAt', 'deleted'];
const FILE = process.env.EXCEL_BLOB_PATH || 'agrosphere-ai-data.xlsx';
const SHEET = 'Entries';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Local development only (set by dev-server.mjs): keep the workbook as a real file on disk.
const LOCAL_PATH = process.env.EXCEL_LOCAL_PATH;
const configured = () => Boolean((LOCAL_PATH || process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) && process.env.SYNC_SECRET);

class LocalPreconditionError extends Error {}

// ---------- storage: Vercel Blob (production) or local file (dev) ----------
async function readFile() {
    if (LOCAL_PATH) {
        try {
            const [buffer, stat] = await Promise.all([fs.readFile(LOCAL_PATH), fs.stat(LOCAL_PATH)]);
            return { buffer, etag: `${stat.mtimeMs}-${stat.size}` };
        } catch {
            return null;
        }
    }
    const res = await get(FILE, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { buffer: Buffer.from(await new Response(res.stream).arrayBuffer()), etag: res.blob.etag };
}

async function writeFile(buffer, etag) {
    if (LOCAL_PATH) {
        const current = await readFile();
        if ((current?.etag || null) !== etag) throw new LocalPreconditionError();
        await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
        await fs.writeFile(LOCAL_PATH, buffer);
        return;
    }
    await put(FILE, buffer, {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: XLSX_TYPE,
        cacheControlMaxAge: 60, ...(etag ? { ifMatch: etag } : {})
    });
}

// ---------- workbook read / write ----------
async function load() {
    const file = await readFile();
    if (!file) return { rows: [], etag: null };
    const buffer = file.buffer;
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[SHEET] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        .filter((r) => r.id)
        .map((r) => {
            let data = {};
            try { data = JSON.parse(r.data || '{}'); } catch { /* keep empty */ }
            return {
                id: String(r.id), userId: String(r.userId), entryType: String(r.entryType), data,
                createdAt: String(r.createdAt), updatedAt: String(r.updatedAt),
                deleted: r.deleted === true || String(r.deleted).toUpperCase() === 'TRUE'
            };
        });
    return { rows, etag: file.etag };
}

function toValues(e) {
    const data = JSON.stringify(e.data || {});
    if (data.length > 32000) throw new Error(`Entry ${e.id} is too large for one Excel cell`);
    return [e.id, e.userId, e.entryType, data, e.createdAt, e.updatedAt, e.deleted ? 'TRUE' : 'FALSE'];
}

function buildWorkbook(rows) {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows.map(toValues)]);
    ws['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 80 }, { wch: 26 }, { wch: 26 }, { wch: 9 }];
    ws['!autofilter'] = { ref: `A1:G${rows.length + 1}` }; // filter by userId / entryType in Excel
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: 'Agrosphere AI - Data', Author: 'Agrosphere AI' };
    XLSX.utils.book_append_sheet(wb, ws, SHEET);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Read -> change -> write, retrying if another request saved the file in between (ETag check).
async function mutate(change) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const { rows, etag } = await load();
        const result = await change(rows);
        if (result?.skipWrite) return result;
        try {
            await writeFile(buildWorkbook(rows), etag);
            return result;
        } catch (err) {
            if (!(err instanceof BlobPreconditionFailedError || err instanceof LocalPreconditionError)) throw err;
            await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        }
    }
    throw new Error('The data file is busy. Please try again.');
}

function upsert(rows, entries) {
    const byId = new Map(rows.map((r, i) => [r.id, i]));
    for (const e of entries) {
        const i = byId.get(e.id);
        if (i === undefined) {
            byId.set(e.id, rows.length);
            rows.push(e);
        } else if (rows[i].userId === e.userId && new Date(e.updatedAt) >= new Date(rows[i].updatedAt)) {
            rows[i] = e; // newest change wins
        }
    }
}

// ---------- sync tokens (HMAC of the userId) ----------
function sign(userId) {
    return `${userId}.${crypto.createHmac('sha256', process.env.SYNC_SECRET).update(userId).digest('hex')}`;
}
function verify(token) {
    const [userId, mac] = String(token || '').split('.');
    if (!userId || !mac) return null;
    const expected = crypto.createHmac('sha256', process.env.SYNC_SECRET).update(userId).digest('hex');
    return mac.length === expected.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? userId : null;
}

// Must match js/auth.js hashPassword()
function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function clean(e, userId) {
    return {
        id: String(e.id), userId, entryType: String(e.entryType), data: e.data || {},
        createdAt: String(e.createdAt), updatedAt: String(e.updatedAt), deleted: !!e.deleted
    };
}

export default async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET') {
        if (url.searchParams.has('status')) return res.status(200).json({ enabled: configured() });
        if (url.searchParams.has('download')) {
            const key = process.env.SHEET_ADMIN_KEY;
            if (!key || url.searchParams.get('key') !== key) return res.status(401).json({ error: 'Invalid key' });
            const file = await readFile();
            if (!file) return res.status(404).json({ error: 'No data file yet' });
            res.setHeader('Content-Type', XLSX_TYPE);
            res.setHeader('Content-Disposition', `attachment; filename="${FILE.split('/').pop()}"`);
            return res.status(200).end(file.buffer);
        }
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!configured()) return res.status(503).json({ error: 'Excel sync is not configured' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    try {
        if (body.action === 'register') {
            const { id, data } = body.user || {};
            if (!id || !data?.email || !data?.passwordHash || !data?.salt) return res.status(400).json({ error: 'Invalid user' });
            const result = await mutate((rows) => {
                const same = rows.find((r) => r.id === id && r.entryType === 'user');
                if (same) return same.data.passwordHash === data.passwordHash ? { ok: true, skipWrite: true } : { conflict: true, skipWrite: true };
                if (rows.some((r) => r.entryType === 'user' && !r.deleted && (r.data.email === data.email || r.data.username === data.username))) {
                    return { conflict: true, skipWrite: true };
                }
                const now = new Date().toISOString();
                rows.push({ id, userId: id, entryType: 'user', data, createdAt: now, updatedAt: now, deleted: false });
                return { ok: true };
            });
            if (result.conflict) return res.status(409).json({ error: 'An account with that email or username already exists.' });
            return res.json({ token: sign(id) });
        }

        if (body.action === 'login') {
            const ident = String(body.identifier || '').trim().toLowerCase();
            const { rows } = await load();
            const user = rows.find((r) => r.entryType === 'user' && !r.deleted && (r.data.email === ident || r.data.username === ident));
            if (!user || hashPassword(String(body.password || ''), user.data.salt) !== user.data.passwordHash) {
                return res.status(401).json({ error: 'Incorrect email/username or password.' });
            }
            return res.json({ token: sign(user.id), entries: rows.filter((r) => r.userId === user.id) });
        }

        const userId = verify(body.token);
        if (!userId) return res.status(401).json({ error: 'Invalid sync token' });

        if (body.action === 'pull') {
            const { rows } = await load();
            return res.json({ entries: rows.filter((r) => r.userId === userId) });
        }

        if (body.action === 'push') {
            const entries = Array.isArray(body.entries) ? body.entries.slice(0, 500) : [];
            if (entries.some((e) => e.userId !== userId)) return res.status(403).json({ error: 'Entries must belong to the signed-in user' });
            await mutate((rows) => upsert(rows, entries.map((e) => clean(e, userId))));
            return res.json({ ok: true, count: entries.length });
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('[sheet]', err);
        return res.status(500).json({ error: err.message });
    }
}
