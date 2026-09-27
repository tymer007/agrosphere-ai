// Local-first data layer.
// Every row mirrors one row of the Excel "Entries" table (docs/SETUP.md):
//   { id, userId, entryType, data, createdAt, updatedAt, deleted }
// All app data - including user accounts - lives in localStorage under these keys.

const KEYS = {
    entries: 'agro_entries',
    session: 'agro_session',
    queue: 'agro_sync_queue',
    device: 'agro_device_id'
};

// Entry types that feed the AI overview analysis; changing any of them marks data "dirty".
const ANALYSED_TYPES = new Set(['profile', 'farm', 'crop', 'livestock', 'record']);

export function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function uid(prefix = 'e') {
    const rand = crypto.getRandomValues(new Uint32Array(2));
    return `${prefix}_${Date.now().toString(36)}${rand[0].toString(36)}${rand[1].toString(36).slice(0, 4)}`;
}

export function deviceId() {
    let id = localStorage.getItem(KEYS.device);
    if (!id) {
        id = uid('dev');
        localStorage.setItem(KEYS.device, id);
    }
    return id;
}

let cache = null;
function rows() {
    if (!cache) cache = readJSON(KEYS.entries, []);
    return cache;
}
function persist() {
    writeJSON(KEYS.entries, cache);
}

// Other tabs may write too; drop the in-memory cache when they do.
window.addEventListener('storage', (e) => {
    if (e.key === KEYS.entries) cache = null;
});

const listeners = new Set();
export function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
function emit(row) {
    listeners.forEach((fn) => fn(row));
}

function enqueue(row) {
    const queue = readJSON(KEYS.queue, []);
    const i = queue.indexOf(row.id);
    if (i === -1) queue.push(row.id);
    writeJSON(KEYS.queue, queue);
}

function toItem(row) {
    return { ...row.data, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function currentUserId() {
    const s = readJSON(KEYS.session, null);
    return s && s.expiresAt > Date.now() ? s.userId : null;
}

export const db = {
    KEYS,

    rawRows() {
        return rows();
    },

    // Raw row lookup (all users) - used by auth.
    findRows(predicate) {
        return rows().filter((r) => !r.deleted && predicate(r));
    },

    list(entryType, userId = currentUserId()) {
        return rows()
            .filter((r) => !r.deleted && r.userId === userId && r.entryType === entryType)
            .map(toItem);
    },

    get(id) {
        const row = rows().find((r) => r.id === id && !r.deleted);
        return row ? toItem(row) : null;
    },

    put(entryType, data, { id, userId = currentUserId() } = {}) {
        if (!userId) throw new Error('Not signed in');
        const now = new Date().toISOString();
        const clean = { ...data };
        delete clean.id;
        delete clean.createdAt;
        delete clean.updatedAt;
        const all = rows();
        let row = id ? all.find((r) => r.id === id) : null;
        if (row) {
            row.data = clean;
            row.updatedAt = now;
            row.deleted = false;
        } else {
            row = { id: id || uid(entryType.slice(0, 3)), userId, entryType, data: clean, createdAt: now, updatedAt: now, deleted: false };
            all.push(row);
        }
        persist();
        enqueue(row);
        if (ANALYSED_TYPES.has(entryType)) bumpVersion(userId);
        emit(row);
        return toItem(row);
    },

    patch(id, changes) {
        const row = rows().find((r) => r.id === id);
        if (!row) return null;
        return db.put(row.entryType, { ...row.data, ...changes }, { id, userId: row.userId });
    },

    remove(id) {
        const row = rows().find((r) => r.id === id);
        if (!row) return;
        row.deleted = true;
        row.updatedAt = new Date().toISOString();
        persist();
        enqueue(row);
        if (ANALYSED_TYPES.has(row.entryType)) bumpVersion(row.userId);
        emit(row);
    },

    // Singletons: one row per user for this type (profile, farm, settings...)
    one(entryType, userId = currentUserId()) {
        return db.list(entryType, userId)[0] || null;
    },

    setOne(entryType, data, userId = currentUserId()) {
        const existing = db.one(entryType, userId);
        return db.put(entryType, { ...(existing || {}), ...data }, { id: existing?.id, userId });
    },

    // Soft-delete every row of the given types for a user.
    clearTypes(types, userId = currentUserId()) {
        const now = new Date().toISOString();
        rows().forEach((r) => {
            if (r.userId === userId && types.includes(r.entryType) && !r.deleted) {
                r.deleted = true;
                r.updatedAt = now;
                enqueue(r);
            }
        });
        persist();
        bumpVersion(userId);
        emit(null);
    },

    // Merge rows pulled from the Excel sheet: newest updatedAt wins.
    mergeRemote(remoteRows) {
        const all = rows();
        const byId = new Map(all.map((r) => [r.id, r]));
        let changed = 0;
        remoteRows.forEach((remote) => {
            const local = byId.get(remote.id);
            if (!local) { all.push(remote); changed++; }
            else if (new Date(remote.updatedAt) > new Date(local.updatedAt)) { Object.assign(local, remote); changed++; }
        });
        if (!changed) return 0;
        persist();
        if (remoteRows.some((r) => ANALYSED_TYPES.has(r.entryType))) bumpVersion(remoteRows[0].userId);
        emit(null);
        return changed;
    },

    takeQueue() {
        const ids = readJSON(KEYS.queue, []);
        const set = new Set(ids);
        return rows().filter((r) => set.has(r.id));
    },

    clearQueue(ids) {
        const done = new Set(ids);
        writeJSON(KEYS.queue, readJSON(KEYS.queue, []).filter((id) => !done.has(id)));
    },

    dataVersion(userId = currentUserId()) {
        return localStorage.getItem(`agro_data_version_${userId}`) || '0';
    }
};

function bumpVersion(userId) {
    localStorage.setItem(`agro_data_version_${userId}`, String(Date.now()));
}
