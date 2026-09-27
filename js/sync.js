// Background sync of local rows to the Excel workbook (via /api/sheet).
// Local storage is always the source the UI reads from; this only pushes queued
// changes in the background and pulls a user's rows when they sign in on a new device.
import { CONFIG } from './config.js';
import { db, readJSON } from './store.js';

async function call(action, body) {
    const res = await fetch(CONFIG.SYNC_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Sync failed');
    return json;
}

function token() {
    return readJSON(db.KEYS.session, {})?.syncToken;
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
    register: (user) => call('register', { user }),
    login: (identifier, password) => call('login', { identifier, password }),

    schedule() {
        if (!CONFIG.SYNC_ENABLED) return;
        clearTimeout(timer);
        timer = setTimeout(() => sync.flush(), CONFIG.SYNC_DEBOUNCE_MS);
    },

    async flush() {
        if (!CONFIG.SYNC_ENABLED || flushing || !token()) return;
        const pending = db.takeQueue();
        if (!pending.length) return;
        flushing = true;
        try {
            await call('push', { token: token(), entries: pending.map(forSheet) });
            db.clearQueue(pending.map((r) => r.id));
        } catch (err) {
            console.warn('[sync] will retry later:', err.message);
        } finally {
            flushing = false;
        }
    },

    async pull() {
        if (!CONFIG.SYNC_ENABLED || !token()) return;
        try {
            const res = await call('pull', { token: token() });
            db.mergeRemote(res.entries);
        } catch (err) {
            console.warn('[sync] pull failed:', err.message);
        }
    }
};

if (CONFIG.SYNC_ENABLED) {
    import('./store.js').then(({ onChange }) => onChange(() => sync.schedule()));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') sync.flush();
    });
}
