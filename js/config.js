// Central app configuration.
export const CONFIG = {
    APP_NAME: 'Agrosphere AI',
    SESSION_DAYS: 30,

    // Daily AI limits (shared per device AND per user - see js/ai.js)
    AI_LIMITS: { chat: 5, analysis: 3, diagnosis: 1 },
    AI_ENDPOINT: '/api/ai',
    CHAT_MEMORY: 5, // messages kept; on the 5th the AI also returns a running summary

    // Excel sync (docs/SETUP.md). Everything works locally while this is false.
    SYNC_ENABLED: false,
    SYNC_ENDPOINT: '/api/sheet',
    SYNC_DEBOUNCE_MS: 4000,

    DEFAULT_LOCATION: { lat: 6.5244, lng: 3.3792, label: 'Lagos, Nigeria' },

    PLANS: {
        free: { name: 'Free & Demo', price: 'Free' },
        demo: { name: 'Demo account', price: 'Free' },
        pro: { name: 'Pro', monthly: 4500, yearly: 45000 }
    }
};
