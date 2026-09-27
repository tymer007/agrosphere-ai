// Vercel serverless function: POST /api/ai
// Keeps the Vercel AI Gateway key on the server (never shipped to the browser)
// and picks the model per task. Tasks: chat | analysis | diagnose.

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

// All three are available on AI Gateway's free tier (newer models need paid credits - docs/SETUP.md).
const MODELS = {
    chat: process.env.AI_MODEL_CHAT || 'google/gemini-2.5-flash-lite',
    diagnose: process.env.AI_MODEL_VISION || 'google/gemini-2.5-flash-lite',
    analysis: process.env.AI_MODEL_ANALYSIS || 'openai/gpt-5-mini'
};

// Thinking models count their reasoning toward max_tokens, so leave generous room.
const MAX_TOKENS = { chat: 1500, diagnose: 3000, analysis: 8000 };
// Low reasoning effort keeps the analysis fast and cheap; the answer is still well-reasoned.
const REASONING = { analysis: { effort: 'low', exclude: true } };

// Best-effort per-IP throttle (resets when the function instance is recycled).
// The real daily limits are enforced per user + device in the app (js/ai.js).
const HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT_PER_IP || 40);
const hits = new Map();
function throttled(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > HOURLY_LIMIT;
}

const BASE_PERSONA = `You are Agro AI, the farming assistant inside Agrosphere AI, an app for smallholder and commercial farmers in Nigeria and across Africa.
Speak directly to the farmer ("your maize", "your goats"). Be practical, specific and brief. Prefer locally available, affordable inputs and name common local product types where helpful.
Only use the farm data you are given - never invent crops, animals, numbers or events. If data is missing, say what to record.
Do not give financial projections or profit figures (that feature is not available yet). For serious animal illness or suspected outbreaks, advise contacting a vet or extension officer.`;

const SCHEMAS = {
    chat: {
        name: 'chat_reply',
        schema: {
            type: 'object',
            properties: {
                reply: { type: 'string', description: 'The answer to the farmer. Plain text, short paragraphs or "- " bullet lines. Max ~150 words.' },
                summary: { type: 'string', description: 'If asked for a summary: a complete summary of the whole conversation so far (under 120 words). Otherwise an empty string.' }
            },
            required: ['reply', 'summary'],
            additionalProperties: false
        }
    },
    analysis: {
        name: 'farm_analysis',
        schema: {
            type: 'object',
            properties: {
                response: { type: 'string', description: 'A short chat-style analysis of the farm right now (3-6 sentences), mentioning the most important findings.' },
                conversationStarter: { type: 'string', description: 'One follow-up question inviting the farmer to reply, about the most important issue.' },
                context: { type: 'string', description: 'A compact factual summary of the farm state and your findings (under 150 words) that another assistant can use to continue the conversation.' },
                recommendations: {
                    type: 'array',
                    description: '3 to 6 prioritised, actionable recommendations.',
                    items: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Short action title (max 8 words). Do not include the priority.' },
                            detail: { type: 'string', description: 'What to do and why, 1-2 sentences.' },
                            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                            category: { type: 'string', enum: ['crops', 'livestock', 'weather', 'records', 'general'] }
                        },
                        required: ['title', 'detail', 'priority', 'category'],
                        additionalProperties: false
                    }
                }
            },
            required: ['response', 'conversationStarter', 'context', 'recommendations'],
            additionalProperties: false
        }
    },
    diagnose: {
        name: 'plant_diagnosis',
        schema: {
            type: 'object',
            properties: {
                isPlant: { type: 'boolean', description: 'False if the image does not show a plant.' },
                disease: { type: 'string', description: 'Most likely disease, pest or disorder, or "Healthy" / "Not a plant".' },
                confidence: { type: 'integer', description: '0-100 confidence in the diagnosis.' },
                severity: { type: 'string', enum: ['none', 'low', 'moderate', 'high'] },
                healthStatus: { type: 'string', enum: ['excellent', 'good', 'average', 'sick'] },
                summary: { type: 'string', description: '2-3 sentences explaining what is visible and why.' },
                symptoms: { type: 'array', items: { type: 'string' }, description: 'Visible signs in the photo.' },
                actions: { type: 'array', items: { type: 'string' }, description: '3-5 steps to take now.' },
                treatment: { type: 'string', description: 'Recommended treatment (organic option first, then chemical if needed), or empty if healthy.' },
                prevention: { type: 'array', items: { type: 'string' }, description: '2-4 ways to prevent it next season.' },
                followUpDays: { type: 'integer', description: 'Days until the farmer should re-check the plant.' }
            },
            required: ['isPlant', 'disease', 'confidence', 'severity', 'healthStatus', 'summary', 'symptoms', 'actions', 'treatment', 'prevention', 'followUpDays'],
            additionalProperties: false
        }
    }
};

function clip(value, max) {
    const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    return s.length > max ? s.slice(0, max) : s;
}

function buildMessages(task, body) {
    const language = ['English', 'Hausa', 'Yoruba', 'Igbo'].includes(body.language) ? body.language : 'English';
    const langRule = `Write all text for the farmer in ${language}.`;

    if (task === 'chat') {
        const history = (Array.isArray(body.messages) ? body.messages : [])
            .slice(-6)
            .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({ role: m.role, content: clip(m.content, 2000) }));
        if (!history.length || history[history.length - 1].role !== 'user') throw new Error('The last message must be from the user.');
        const system = [
            BASE_PERSONA, langRule,
            `Farm data (JSON): ${clip(body.farm, 12000)}`,
            body.summary ? `Summary of the earlier conversation: ${clip(body.summary, 1500)}` : '',
            body.seedContext ? `Context from today's farm analysis: ${clip(body.seedContext, 2000)}` : '',
            body.wantSummary ? 'Also fill "summary" with a complete summary of the whole conversation, including the earlier summary.' : 'Set "summary" to an empty string.'
        ].filter(Boolean).join('\n\n');
        return [{ role: 'system', content: system }, ...history];
    }

    if (task === 'analysis') {
        return [
            { role: 'system', content: `${BASE_PERSONA}\n\n${langRule}\nYou analyse the farmer's complete, up-to-date farm records and weather, then return a chat-style analysis, a follow-up question and prioritised recommendations. Prioritise: sick or at-risk crops/animals, overdue weekly reviews, upcoming harvests, weather risks, and the farmer's goals.` },
            { role: 'user', content: `Farm data (JSON):\n${clip(body.farm, 40000)}\n\nWeather (JSON):\n${clip(body.weather || 'not available', 4000)}` }
        ];
    }

    if (task === 'diagnose') {
        const image = String(body.image || '');
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) throw new Error('Please upload a JPG, PNG or WEBP image.');
        if (image.length > 4_000_000) throw new Error('Image is too large.');
        return [
            { role: 'system', content: `You are an experienced plant pathologist helping African farmers. Talk directly to the farmer. Diagnose only from what is visible plus the notes given; if the image is unclear, say so and lower confidence. ${langRule}` },
            {
                role: 'user',
                content: [
                    { type: 'text', text: `Crop details (JSON): ${clip(body.crop, 1500)}\nFarmer's notes: ${clip(body.context || 'none', 600)}\nDiagnose this plant.` },
                    { type: 'image_url', image_url: { url: image, detail: 'auto' } }
                ]
            }
        ];
    }
    throw new Error('Unknown task');
}

function parseJSON(text) {
    try {
        return JSON.parse(text);
    } catch {
        const match = String(text).match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error('The AI returned an unreadable answer. Please try again.');
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = req.headers.origin || '';
    if (allowed.length && origin && !allowed.includes(origin)) return res.status(403).json({ error: 'Origin not allowed' });

    // API key first; otherwise Vercel's built-in OIDC token (available on Vercel deployments).
    const apiKey = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
    if (!apiKey) return res.status(503).json({ error: 'AI is not configured yet. Add AI_GATEWAY_API_KEY in your Vercel project settings.' });

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (throttled(ip)) return res.status(429).json({ error: 'Too many AI requests. Please wait a while and try again.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const task = body.task;
    if (!MODELS[task]) return res.status(400).json({ error: 'Unknown AI task' });

    let messages;
    try {
        messages = buildMessages(task, body);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    try {
        const upstream = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODELS[task],
                messages,
                max_tokens: MAX_TOKENS[task],
                ...(REASONING[task] ? { reasoning: REASONING[task] } : {}),
                temperature: task === 'chat' ? 0.6 : 0.3,
                stream: false,
                response_format: { type: 'json_schema', json_schema: SCHEMAS[task] }
            })
        });
        const json = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
            console.error('[ai] gateway error', upstream.status, json?.error);
            const detail = String(json?.error?.message || '');
            const msg = upstream.status === 401 ? 'AI key is invalid - check AI_GATEWAY_API_KEY.'
                : /free tier/i.test(detail) ? `The model ${MODELS[task]} needs paid AI Gateway credits. Choose a free-tier model (see docs/SETUP.md).`
                : upstream.status === 402 || upstream.status === 403 ? 'AI credits are exhausted or not enabled for this key.'
                : upstream.status === 429 ? 'The AI service is busy. Try again in a minute.'
                : 'The AI service had a problem. Please try again.';
            return res.status(502).json({ error: msg });
        }
        const choice = json.choices?.[0];
        if (choice?.finish_reason === 'length') {
            console.error('[ai] answer cut off at max_tokens', task, json.usage);
            return res.status(502).json({ error: 'The AI answer was too long and got cut off. Please try again.' });
        }
        const data = parseJSON(choice?.message?.content || '');
        if (task === 'diagnose' && data.isPlant === false) {
            return res.status(422).json({ error: "That photo doesn't look like a plant. Please upload a clear photo of the affected leaves, stem or fruit." });
        }
        return res.status(200).json({ ...data, model: MODELS[task] });
    } catch (err) {
        console.error('[ai] failed', err);
        return res.status(500).json({ error: err.message || 'AI request failed' });
    }
}
