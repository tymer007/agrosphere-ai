// Free, key-less weather: Open-Meteo forecast + OpenStreetMap Nominatim geocoding.
import { CONFIG } from './config.js';

const WMO = {
    0: ['Clear sky', 'fa-sun', '#f39c12'], 1: ['Mainly clear', 'fa-sun', '#f39c12'], 2: ['Partly cloudy', 'fa-cloud-sun', '#95a5a6'],
    3: ['Overcast', 'fa-cloud', '#7f8c8d'], 45: ['Fog', 'fa-smog', '#95a5a6'], 48: ['Rime fog', 'fa-smog', '#95a5a6'],
    51: ['Light drizzle', 'fa-cloud-rain', '#3498db'], 53: ['Drizzle', 'fa-cloud-rain', '#3498db'], 55: ['Heavy drizzle', 'fa-cloud-rain', '#3498db'],
    61: ['Light rain', 'fa-cloud-rain', '#3498db'], 63: ['Rain', 'fa-cloud-showers-heavy', '#2980b9'], 65: ['Heavy rain', 'fa-cloud-showers-heavy', '#2471a3'],
    66: ['Freezing rain', 'fa-cloud-rain', '#3498db'], 67: ['Freezing rain', 'fa-cloud-rain', '#3498db'],
    71: ['Light snow', 'fa-snowflake', '#5dade2'], 73: ['Snow', 'fa-snowflake', '#5dade2'], 75: ['Heavy snow', 'fa-snowflake', '#5dade2'],
    80: ['Rain showers', 'fa-cloud-sun-rain', '#3498db'], 81: ['Rain showers', 'fa-cloud-showers-heavy', '#2980b9'], 82: ['Violent showers', 'fa-cloud-showers-heavy', '#2471a3'],
    95: ['Thunderstorm', 'fa-bolt', '#9b59b6'], 96: ['Thunderstorm & hail', 'fa-bolt', '#9b59b6'], 99: ['Thunderstorm & hail', 'fa-bolt', '#9b59b6']
};

export function describe(code) {
    const [label, icon, color] = WMO[code] || ['Unknown', 'fa-cloud', '#95a5a6'];
    return { label, icon, color };
}

export function browserLocation(timeout = 8000) {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve(null),
            { timeout, maximumAge: 30 * 60 * 1000 }
        );
    });
}

export async function reverseGeocode(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } });
        const json = await res.json();
        const a = json.address || {};
        return [a.city || a.town || a.village || a.county || a.state_district, a.state, a.country].filter(Boolean).join(', ') || json.display_name;
    } catch {
        return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    }
}

export async function geocode(query, limit = 5) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'en' } });
    const json = await res.json();
    return json.map((r) => ({ lat: +r.lat, lng: +r.lon, label: r.display_name }));
}

export async function fetchWeather(lat, lng) {
    const cacheKey = `agro_wx_${lat.toFixed(2)}_${lng.toFixed(2)}`;
    try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.data;
    } catch { /* ignore */ }

    const params = new URLSearchParams({
        latitude: lat, longitude: lng, timezone: 'auto', forecast_days: 7,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max'
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error('Weather service unavailable');
    const j = await res.json();
    const data = {
        current: {
            temp: Math.round(j.current.temperature_2m), feels: Math.round(j.current.apparent_temperature),
            humidity: j.current.relative_humidity_2m, wind: Math.round(j.current.wind_speed_10m),
            pressure: Math.round(j.current.surface_pressure), precip: j.current.precipitation, code: j.current.weather_code
        },
        daily: j.daily.time.map((date, i) => ({
            date, code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]),
            rain: j.daily.precipitation_sum[i], rainChance: j.daily.precipitation_probability_max[i], uv: j.daily.uv_index_max[i]
        }))
    };
    sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data }));
    return data;
}

// Rule-based farm alerts derived from the forecast.
export function farmAlerts(wx) {
    const alerts = [];
    const d = wx.daily;
    const hot = d.find((x) => x.max >= 35);
    if (hot) alerts.push({ level: 'warning', icon: 'fa-sun', title: 'High temperature ahead', text: `Up to ${hot.max}°C on ${dayName(hot.date)}. Irrigate early morning or late evening and shade seedlings.` });
    const heavy = d.find((x) => x.rain >= 20);
    if (heavy) alerts.push({ level: 'danger', icon: 'fa-cloud-showers-heavy', title: 'Heavy rain expected', text: `${Math.round(heavy.rain)} mm on ${dayName(heavy.date)}. Clear drainage channels and delay fertilizer to avoid run-off.` });
    const lightRain = d.slice(0, 4).find((x) => x.rain >= 3 && x.rain < 20);
    if (lightRain && !heavy) alerts.push({ level: 'success', icon: 'fa-cloud-rain', title: 'Good window for fertilizer', text: `Light rain (${Math.round(lightRain.rain)} mm) on ${dayName(lightRain.date)} will help nutrients soak in.` });
    const dry = d.every((x) => (x.rainChance ?? 0) < 20);
    if (dry) alerts.push({ level: 'warning', icon: 'fa-tint-slash', title: 'Dry week', text: 'Little chance of rain for 7 days. Plan irrigation and mulch to hold soil moisture.' });
    const uv = d.slice(0, 3).find((x) => x.uv >= 10);
    if (uv) alerts.push({ level: 'warning', icon: 'fa-radiation-alt', title: 'Very high UV', text: 'Protect workers and animals during midday hours; provide shade and water for livestock.' });
    if (wx.current.wind >= 35) alerts.push({ level: 'warning', icon: 'fa-wind', title: 'Strong winds', text: 'Avoid spraying today - chemicals will drift. Stake tall crops.' });
    if (!alerts.length) alerts.push({ level: 'success', icon: 'fa-seedling', title: 'Favourable conditions', text: 'No weather risks flagged for the week. A good time for routine field work.' });
    return alerts;
}

export function dayName(date, i = null) {
    if (i === 0) return 'Today';
    return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

// Resolve the best coordinates: saved farm location -> device GPS -> default.
export async function resolveCoords(saved) {
    if (saved?.lat && saved?.lng) return { lat: saved.lat, lng: saved.lng, label: saved.address || null, source: 'farm' };
    const gps = await browserLocation();
    if (gps) return { ...gps, label: null, source: 'gps' };
    return { ...CONFIG.DEFAULT_LOCATION, source: 'default' };
}

export function summarize(wx) {
    if (!wx) return null;
    return {
        now: `${wx.current.temp}°C, ${describe(wx.current.code).label}, humidity ${wx.current.humidity}%`,
        next7: wx.daily.map((d) => `${d.date}: ${d.min}-${d.max}°C, rain ${Math.round(d.rain)}mm (${d.rainChance ?? '?'}%)`)
    };
}
