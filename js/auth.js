// Accounts & sessions - stored locally as "user" entries (same shape as the Excel rows).
import { CONFIG } from './config.js';
import { db, readJSON, writeJSON, uid } from './store.js';
import { sync } from './sync.js';

const SESSION_KEY = db.KEYS.session;

export async function hashPassword(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function findUserRow(identifier) {
    const id = identifier.trim().toLowerCase();
    return db.findRows((r) => r.entryType === 'user' && (r.data.email === id || r.data.username === id))[0] || null;
}

function startSession(userId, syncToken = null) {
    const session = { userId, syncToken, createdAt: Date.now(), expiresAt: Date.now() + CONFIG.SESSION_DAYS * 864e5 };
    writeJSON(SESSION_KEY, session);
    return session;
}

export function getSession() {
    const s = readJSON(SESSION_KEY, null);
    if (!s) return null;
    if (s.expiresAt <= Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
    return s;
}

export function currentUser() {
    const s = getSession();
    if (!s) return null;
    const user = db.get(s.userId);
    return user ? { ...user, id: s.userId } : null;
}

export async function signup({ fullName, email, username, password }) {
    email = email.trim().toLowerCase();
    username = username.trim().toLowerCase();
    if (findUserRow(email) || findUserRow(username)) throw new Error('An account with that email or username already exists.');

    const salt = uid('salt');
    const passwordHash = await hashPassword(password, salt);
    const userId = uid('usr');
    const data = { fullName: fullName.trim(), email, username, salt, passwordHash, plan: 'free', onboarded: false, onboardingStep: 'profile' };

    // With Excel sync on, the sheet is checked for duplicates across all devices first.
    let token = null;
    if (await sync.enabled()) {
        const res = await sync.register({ id: userId, data });
        token = res.token;
    }
    db.put('user', data, { id: userId, userId });
    startSession(userId, token);
    return currentUser();
}

export async function login(identifier, password, { localOnly = false } = {}) {
    let row = findUserRow(identifier);
    let token = null;

    // With Excel sync on: check the sheet and pull this user's rows into local storage
    // (this is how an account appears on a new device).
    if (!localOnly && (await sync.enabled())) {
        try {
            const res = await sync.login(identifier, password);
            db.mergeRemote(res.entries);
            token = res.token;
            row = findUserRow(identifier);
        } catch (err) {
            if (!row) throw err;
        }
    }

    if (!row) throw new Error('No account found with that email or username.');
    const hash = await hashPassword(password, row.data.salt);
    if (hash !== row.data.passwordHash) throw new Error('Incorrect password.');
    startSession(row.id, token);
    if (!token && !localOnly) sync.ensureToken().then(() => sync.flush()); // local account not in the sheet yet
    return currentUser();
}

export async function verifyPassword(password) {
    const user = currentUser();
    if (!user) return false;
    return (await hashPassword(password, user.salt)) === user.passwordHash;
}

export function updateUser(changes) {
    const user = currentUser();
    if (!user) return null;
    return db.patch(user.id, changes);
}

export function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.href = '/login';
}

// Page guards
export function requireAuth({ onboarded } = {}) {
    const user = currentUser();
    if (!user) {
        location.replace('/login');
        return null;
    }
    if (onboarded === true && !user.onboarded) {
        location.replace('/onboarding');
        return null;
    }
    if (onboarded === false && user.onboarded) {
        location.replace('/dashboard');
        return null;
    }
    return user;
}

export function redirectIfSignedIn() {
    const user = currentUser();
    if (user) location.replace(user.onboarded ? '/dashboard' : '/onboarding');
}

export const DEMO = { email: 'demo@agrosphere.ai', password: 'demo1234' };

export async function loginDemo() {
    if (!findUserRow(DEMO.email)) {
        const { seedDemo } = await import('./demo.js');
        const salt = uid('salt');
        const userId = uid('usr');
        db.put('user', {
            fullName: 'Demo Farmer', email: DEMO.email, username: 'demo',
            salt, passwordHash: await hashPassword(DEMO.password, salt),
            plan: 'demo', onboarded: true
        }, { id: userId, userId });
        seedDemo(userId);
    }
    return login(DEMO.email, DEMO.password, { localOnly: true }); // demo data stays on this device
}
