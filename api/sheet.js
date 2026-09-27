// Vercel serverless function: POST /api/sheet
// Stores every app entry as one row of a single Excel table (Microsoft Graph Excel API).
//
// Table "Entries" (starting at cell A1 of sheet "Entries"), columns in this order:
//   id | userId | entryType | data | createdAt | updatedAt | deleted
//
// Actions: register | login | push | pull   (see docs/SETUP.md)
import crypto from 'node:crypto';

const COLUMNS = ['id', 'userId', 'entryType', 'data', 'createdAt', 'updatedAt', 'deleted'];
const TABLE = process.env.EXCEL_TABLE || 'Entries';
const SHEET = process.env.EXCEL_SHEET || 'Entries';
const BASE = (process.env.EXCEL_WORKBOOK_URL || '').replace(/\/$/, '');

// ---------- auth to Microsoft Graph ----------
let cachedToken = null;
async function graphToken() {
    if (cachedToken && cachedToken.expires > Date.now() + 60e3) return cachedToken.value;
    const tenant = process.env.MS_TENANT_ID || 'consumers';
    const params = new URLSearchParams({ client_id: process.env.MS_CLIENT_ID });
    if (process.env.MS_CLIENT_SECRET) params.set('client_secret', process.env.MS_CLIENT_SECRET);
    if (process.env.MS_REFRESH_TOKEN) {
        // Personal OneDrive (or delegated work account): refresh-token flow.
        params.set('grant_type', 'refresh_token');
        params.set('refresh_token', process.env.MS_REFRESH_TOKEN);
        params.set('scope', 'Files.ReadWrite offline_access');
    } else {
        // Work/school OneDrive or SharePoint: app-only client credentials.
        params.set('grant_type', 'client_credentials');
        params.set('scope', 'https://graph.microsoft.com/.default');
    }
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: 'POST', body: params });
    const json = await res.json();
    if (!res.ok) throw new Error(`Microsoft sign-in failed: ${json.error_description || json.error}`);
    cachedToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return cachedToken.value;
}

async function graph(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${await graphToken()}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Excel error ${res.status}: ${json.error?.message || 'unknown'}`);
    return json;
}

// ---------- table helpers ----------
async function readRows() {
    const json = await graph(`/tables/${TABLE}/rows`);
    return (json.value || []).filter((r) => r.values?.[0]?.[0]).map((r) => {
        const v = r.values[0];
        const row = Object.fromEntries(COLUMNS.map((c, i) => [c, v[i]]));
        let data = {};
        try { data = JSON.parse(row.data || '{}'); } catch { /* keep empty */ }
        return { index: r.index, id: String(row.id), userId: String(row.userId), entryType: String(row.entryType), data,
            createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), deleted: row.deleted === true || row.deleted === 'TRUE' || row.deleted === 'true' };
    });
}

function toValues(e) {
    const data = JSON.stringify(e.data || {});
    if (data.length > 32000) throw new Error(`Entry ${e.id} is too large for one Excel cell`);
    return [e.id, e.userId, e.entryType, data, e.createdAt, e.updatedAt, e.deleted ? 'TRUE' : 'FALSE'];
}

async function upsert(entries) {
    const existing = await readRows();
    const byId = new Map(existing.map((r) => [r.id, r]));
    const toAdd = [];
    for (const e of entries) {
        const row = byId.get(e.id);
        if (!row) toAdd.push(toValues(e));
        else if (new Date(e.updatedAt) >= new Date(row.updatedAt)) {
            // Table starts at A1 with a header row, so table row index N lives on sheet row N + 2.
            const r = row.index + 2;
            await graph(`/worksheets/${SHEET}/range(address='A${r}:G${r}')`, { method: 'PATCH', body: JSON.stringify({ values: [toValues(e)] }) });
        }
    }
    if (toAdd.length) await graph(`/tables/${TABLE}/rows`, { method: 'POST', body: JSON.stringify({ values: toAdd }) });
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

const publicRow = ({ index, ...row }) => row;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!BASE || !process.env.MS_CLIENT_ID || !process.env.SYNC_SECRET) return res.status(503).json({ error: 'Excel sync is not configured' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    try {
        if (body.action === 'register') {
            const { id, data } = body.user || {};
            if (!id || !data?.email || !data?.passwordHash) return res.status(400).json({ error: 'Invalid user' });
            const rows = await readRows();
            if (rows.some((r) => r.entryType === 'user' && !r.deleted && (r.data.email === data.email || r.data.username === data.username))) {
                return res.status(409).json({ error: 'An account with that email or username already exists.' });
            }
            const now = new Date().toISOString();
            await upsert([{ id, userId: id, entryType: 'user', data, createdAt: now, updatedAt: now, deleted: false }]);
            return res.json({ token: sign(id) });
        }

        if (body.action === 'login') {
            const ident = String(body.identifier || '').trim().toLowerCase();
            const rows = await readRows();
            const user = rows.find((r) => r.entryType === 'user' && !r.deleted && (r.data.email === ident || r.data.username === ident));
            if (!user || hashPassword(String(body.password || ''), user.data.salt) !== user.data.passwordHash) {
                return res.status(401).json({ error: 'Incorrect email/username or password.' });
            }
            return res.json({ token: sign(user.id), entries: rows.filter((r) => r.userId === user.id).map(publicRow) });
        }

        const userId = verify(body.token);
        if (!userId) return res.status(401).json({ error: 'Invalid sync token' });

        if (body.action === 'pull') {
            const rows = await readRows();
            return res.json({ entries: rows.filter((r) => r.userId === userId).map(publicRow) });
        }

        if (body.action === 'push') {
            const entries = Array.isArray(body.entries) ? body.entries.slice(0, 500) : [];
            if (entries.some((e) => e.userId !== userId)) return res.status(403).json({ error: 'Entries must belong to the signed-in user' });
            await upsert(entries);
            return res.json({ ok: true, count: entries.length });
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('[sheet]', err);
        return res.status(500).json({ error: err.message });
    }
}
