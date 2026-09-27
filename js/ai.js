// Client for /api/ai (the serverless proxy that holds the AI Gateway key).
// Enforces daily limits locally, keeps chat memory and caches the overview analysis.
import { CONFIG } from './config.js';
import { db, readJSON, writeJSON, deviceId, currentUserId } from './store.js';
import { getLang, LANGUAGES } from './i18n.js';
import { todayISO } from './ui.js';

// ---------- Daily quotas ----------
// Counted per device AND per user; a request needs both to be under the limit.
// So signing into another account on the same device does not unlock more AI,
// and (with Excel sync on) the per-user count follows the user to other devices.
const DEVICE_USAGE_KEY = 'agro_ai_usage_device';

function deviceUsage() {
    const u = readJSON(DEVICE_USAGE_KEY, null);
    return u && u.date === todayISO() ? u : { date: todayISO(), chat: 0, analysis: 0, diagnosis: 0 };
}

function userUsage() {
    const u = db.one('ai_usage');
    return u && u.date === todayISO() ? u : { date: todayISO(), chat: 0, analysis: 0, diagnosis: 0 };
}

export const quota = {
    limit: (kind) => CONFIG.AI_LIMITS[kind],
    used(kind) {
        return Math.max(deviceUsage()[kind] || 0, userUsage()[kind] || 0);
    },
    remaining(kind) {
        return Math.max(0, CONFIG.AI_LIMITS[kind] - quota.used(kind));
    },
    consume(kind) {
        const d = deviceUsage();
        d[kind] = (d[kind] || 0) + 1;
        writeJSON(DEVICE_USAGE_KEY, d);
        const u = userUsage();
        db.setOne('ai_usage', { ...u, [kind]: (u[kind] || 0) + 1 });
    }
};

export class QuotaError extends Error {
    constructor(kind) {
        const what = { chat: 'AI chat messages', analysis: 'daily farm analyses', diagnosis: 'plant diagnosis' }[kind];
        super(`You've used today's ${what}. Check back tomorrow - everything else keeps working.`);
        this.kind = kind;
    }
}

async function callAI(task, payload) {
    const langName = LANGUAGES.find((l) => l.code === getLang())?.name || 'English';
    let res;
    try {
        res = await fetch(CONFIG.AI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, language: langName, userId: currentUserId(), deviceId: deviceId(), ...payload })
        });
    } catch {
        throw new Error('Could not reach the AI service. Check your connection.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `AI service error (${res.status})`);
    return json;
}

// ---------- Farm data bundle (sent as context) ----------
export function farmBundle({ compact = false } = {}) {
    const user = db.get(currentUserId()) || {};
    const profile = db.one('profile') || {};
    const farm = db.one('farm') || {};
    const records = db.list('record').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const perItem = compact ? 1 : 4;
    const latestFor = (id) => records.filter((r) => r.itemId === id).slice(0, perItem).map(stripRecord);

    return {
        farmer: { name: user.fullName },
        farm: {
            name: profile.farmName, location: farm.location?.address || [profile.city, profile.state, profile.country].filter(Boolean).join(', '),
            size: profile.farmSize ? `${profile.farmSize} ${profile.farmSizeUnit || ''}`.trim() : undefined,
            type: farm.farmType, goals: farm.goals, mainChallenge: farm.challenge, experience: profile.experience
        },
        today: todayISO(),
        crops: db.list('crop').map((c) => ({
            name: c.name, variety: c.variety, plot: c.plot, area: c.area && `${c.area} ${c.areaUnit || ''}`, plants: c.plantCount,
            sowDate: c.sowDate, harvestDate: c.harvestDate, stage: c.stage, health: c.health, irrigation: c.irrigation,
            lastDiagnosis: c.lastDiagnosis, recentReports: latestFor(c.id)
        })),
        livestock: db.list('livestock').map((l) => ({
            type: l.type, breed: l.breed, count: l.count, avgAgeMonths: l.avgAgeMonths, purpose: l.purpose, housing: l.housing,
            health: l.health, vaccinated: l.vaccinated, recentReports: latestFor(l.id)
        })),
        otherRecords: records.filter((r) => !r.itemId).slice(0, compact ? 3 : 8).map(stripRecord)
    };
}

function stripRecord(r) {
    const copy = { ...r };
    delete copy.id; delete copy.itemId; delete copy.createdAt; delete copy.updatedAt; delete copy.thumb;
    return copy;
}

// ---------- Chat (cheap model) ----------
export function chatMemory() {
    return db.one('chat_memory') || { messages: [], summary: '' };
}

export async function sendChat(text, { seedContext } = {}) {
    if (quota.remaining('chat') <= 0) throw new QuotaError('chat');
    const memory = chatMemory();
    const messages = [...memory.messages, { role: 'user', content: text, at: Date.now() }];
    const wantSummary = messages.length >= CONFIG.CHAT_MEMORY;

    const res = await callAI('chat', {
        messages: messages.map(({ role, content }) => ({ role, content })),
        summary: memory.summary,
        seedContext: seedContext || memory.seedContext || null,
        farm: farmBundle({ compact: true }),
        wantSummary
    });
    quota.consume('chat');

    const reply = { role: 'assistant', content: res.reply, at: Date.now() };
    const kept = [...messages, reply].slice(-CONFIG.CHAT_MEMORY); // older messages are dropped
    db.setOne('chat_memory', {
        messages: kept,
        summary: wantSummary && res.summary ? res.summary : memory.summary,
        seedContext: seedContext || memory.seedContext || null
    });
    return res.reply;
}

// Start a chat thread from the overview analysis (response + conversation starter + context).
export function seedChatFromAnalysis(analysis) {
    const memory = chatMemory();
    const starter = { role: 'assistant', content: `${analysis.response}\n\n${analysis.conversationStarter}`, at: Date.now() };
    db.setOne('chat_memory', {
        messages: [...memory.messages, starter].slice(-CONFIG.CHAT_MEMORY),
        summary: memory.summary,
        seedContext: analysis.context
    });
}

// ---------- Overview analysis (strong model) ----------
export function lastAnalysis() {
    return db.one('analysis');
}

export function analysisIsStale() {
    const last = lastAnalysis();
    return !last || last.dataVersion !== db.dataVersion();
}

export async function runAnalysis(weatherSummary) {
    if (quota.remaining('analysis') <= 0) throw new QuotaError('analysis');
    const version = db.dataVersion();
    const res = await callAI('analysis', { farm: farmBundle(), weather: weatherSummary });
    quota.consume('analysis');
    return db.setOne('analysis', {
        response: res.response,
        conversationStarter: res.conversationStarter,
        context: res.context,
        recommendations: (res.recommendations || []).map((r, i) => ({ ...r, id: `rec_${Date.now()}_${i}` })),
        dataVersion: version,
        analysedAt: new Date().toISOString()
    });
}

// ---------- Plant diagnosis (cheap vision model, 1/day) ----------
export async function diagnosePlant({ image, crop, context }) {
    if (quota.remaining('diagnosis') <= 0) throw new QuotaError('diagnosis');
    const res = await callAI('diagnose', {
        image,
        crop: { name: crop.name, variety: crop.variety, stage: crop.stage, sowDate: crop.sowDate, health: crop.health, irrigation: crop.irrigation },
        context
    });
    quota.consume('diagnosis');
    return res;
}
