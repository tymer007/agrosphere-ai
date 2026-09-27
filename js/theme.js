// Theme preference: 'system' | 'light' | 'dark' (Settings -> Appearance).
// The floating toggle sets an explicit light/dark preference.
const KEY = 'agro_theme_pref';

export function getThemePref() {
    return localStorage.getItem(KEY) || localStorage.getItem('agro_theme') || 'system';
}

export function resolveTheme(pref = getThemePref()) {
    if (pref === 'light' || pref === 'dark') return pref;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme() {
    const theme = resolveTheme();
    document.documentElement.setAttribute('data-theme', theme);
    window.dispatchEvent(new CustomEvent('agro:theme', { detail: theme }));
    return theme;
}

export function setThemePref(pref) {
    localStorage.setItem(KEY, pref);
    localStorage.removeItem('agro_theme');
    return applyTheme();
}

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme();
});
