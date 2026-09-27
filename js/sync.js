// Background sync of local rows to the Excel workbook (via /api/sheet).
// Local storage is always what the UI reads from; this only pushes queued changes in the
// background and pulls a user's rows when they sign in on a new device.
// Sync turns itself on when the server reports the Blob store is connected (CONFIG.SYNC_ENABLED = 'auto').
import { CONFIG } from './config.js';
import { db, readJSON, writeJSON, onChange, currentUserId } from './store.js';

class SyncError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function call(action, body) {
    const res = await fetch(CONFIG.SYNC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new SyncError(json.error || 'Sync failed', res.status);
    return json;
}

let enabledPromise = null;
function enabled() {
    if (CONFIG.SYNC_ENABLED !== 'auto') return Promise.resolve(!!CONFIG.SYNC_ENABLED);
    if (!enabledPromise) {
        const cached = sessionStorage.getItem('agro_sync_enabled');
        enabledPromise = cached !== null
            ? Promise.resolve(cached === '1')
            : fetch(`${CONFIG.SYNC_ENDPOINT}?status`)
                .then((r) => (r.ok ? r.json() : { enabled: false }))
                .catch(() => ({ enabled: false }))
                .then((j) => {
                    sessionStorage.setItem('agro_sync_enabled', j.enabled ? '1' : '0');
                    return !!j.enabled;
                });
    }
    return enabledPromise;
}

function session() {
    return readJSON(db.KEYS.session, null);
}

function setToken(token) {
    const s = session();
    if (s) writeJSON(db.KEYS.session, { ...s, syncToken: token });
}

// Large local-only fields (e.g. image thumbnails) are not sent to Excel (32k chars per cell limit).
function forSheet(row) {
    const data = { ...row.data };
    delete data.thumb;
    return { ...row, data };
}

let timer = null;
let flushing = false;

export const sync = {
    SyncError,
    enabled,
    register: (user) => call('register', { user }),
    login: (identifier, password) => call('login', { identifier, password }),

    // Accounts created before sync was switched on: register them in the sheet so their
    // queued rows can be pushed. (409 = already in the sheet; they'll sync after their next login.)
    async ensureToken() {
        const s = session();
        if (!s || s.syncToken || !(await enabled())) return s?.syncToken || null;
        const user = db.findRows((r) => r.id === s.userId && r.entryType === 'user')[0];
        if (!user || user.data.plan === 'demo') return null; // demo account is never synced
        try {
            const { token } = await sync.register({ id: user.id, data: user.data });
            setToken(token);
            return token;
        } catch {
            return null;
        }
    },

    schedule() {
        clearTimeout(timer);
        timer = setTimeout(() => sync.flush(), CONFIG.SYNC_DEBOUNCE_MS);
    },

    async flush() {
        if (flushing || !currentUserId() || !(await enabled())) return;
        const token = await sync.ensureToken();
        if (!token) return;
        const uid = currentUserId();
        const pending = db.takeQueue().filter((r) => r.userId === uid);
        if (!pending.length) return;
        flushing = true;
        try {
            await call('push', { token, entries: pending.map(forSheet) });
            db.clearQueue(pending.map((r) => r.id));
        } catch (err) {
            console.warn('[sync] will retry later:', err.message);
        } finally {
            flushing = false;
        }
    },

    async pull() {
        if (!currentUserId() || !(await enabled())) return 0;
        const token = await sync.ensureToken();
        if (!token) return 0;
        let changed = 0;
        try {
            const res = await call('pull', { token });
            changed = db.mergeRemote(res.entries);
        } catch (err) {
            console.warn('[sync] pull failed:', err.message);
        }
        sync.flush();
        return changed;
    }
};

onChange(() => sync.schedule());
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sync.flush();
});
