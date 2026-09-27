// Home page: live weather (defaults to the visitor's current location) + pricing toggle.
import '../../components/site-nav.js';
import '../../components/site-footer.js';
import { CONFIG } from '../config.js';
import { browserLocation, fetchWeather, reverseGeocode, geocode, describe, dayName, farmAlerts } from '../weather.js';
import { esc } from '../ui.js';
import { showToast } from '../site.js';

const $ = (id) => document.getElementById(id);

async function showWeather(lat, lng, label, note = '') {
    $('weatherStatus').textContent = 'Updating...';
    try {
        const [wx, place] = await Promise.all([fetchWeather(lat, lng), label ? Promise.resolve(label) : reverseGeocode(lat, lng)]);
        const now = describe(wx.current.code);
        $('cityName').textContent = place;
        $('coordsText').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
        $('temperature').innerHTML = `${wx.current.temp}<span>°C</span>`;
        $('conditionText').textContent = now.label;
        $('mainIcon').className = `fas ${now.icon}`;
        $('wxHumidity').textContent = `${wx.current.humidity}%`;
        $('wxWind').textContent = `${wx.current.wind} km/h`;
        $('wxFeels').textContent = `${wx.current.feels}°C`;
        $('wxPressure').textContent = `${wx.current.pressure} hPa`;
        $('weatherStatus').textContent = note;

        $('forecastGrid').innerHTML = wx.daily.map((d, i) => {
            const w = describe(d.code);
            return `<div class="forecast-card">
                <div style="font-size: 14px; font-weight: 600;">${dayName(d.date, i)}</div>
                <div class="forecast-icon"><i class="fas ${w.icon}"></i></div>
                <div style="font-size: 20px; font-weight: 700;">${d.max}°</div>
                <div style="font-size: 12px; opacity: 0.75;">${d.min}°</div>
                <div class="forecast-rain"><i class="fas fa-tint"></i> ${d.rainChance ?? 0}%</div>
            </div>`;
        }).join('');

        const tone = { danger: 'danger', warning: 'warning', success: 'success' };
        $('alertsList').innerHTML = farmAlerts(wx).map((a) => `
            <div class="alert-card" style="border-left-color: var(--${a.level === 'danger' ? 'danger' : a.level === 'warning' ? 'warning' : 'success'})">
                <div class="alert-icon ${tone[a.level]}"><i class="fas ${a.icon}"></i></div>
                <div style="flex: 1;">
                    <h4 style="color: var(--dark-earth); margin-bottom: 5px;">${esc(a.title)}</h4>
                    <p style="color: #666; font-size: 14px;">${esc(a.text)}</p>
                    <p style="color: #999; font-size: 12px; margin-top: 8px;"><i class="fas fa-clock"></i> Based on the latest forecast</p>
                </div>
            </div>`).join('');
    } catch {
        $('weatherStatus').textContent = 'Weather is unavailable right now. Please try again shortly.';
    }
}

async function useGps(silent = false) {
    const pos = await browserLocation();
    if (pos) return showWeather(pos.lat, pos.lng, null, 'Using your current location');
    if (!silent) showToast('Could not get your location - showing Lagos instead', 'error');
    const d = CONFIG.DEFAULT_LOCATION;
    return showWeather(d.lat, d.lng, d.label, 'Allow location access or search to see your own weather');
}

$('gpsBtn').addEventListener('click', () => useGps(false));

$('weatherSearch').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('locationInput').value.trim();
    const box = $('geoResults');
    if (!q) return;
    try {
        const results = await geocode(q);
        if (!results.length) return showToast('Location not found', 'error');
        if (results.length === 1) return pick(results[0]);
        box.innerHTML = results.map((r, i) => `<button type="button" data-i="${i}">${esc(r.label)}</button>`).join('');
        box.classList.remove('hidden');
        box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => pick(results[+b.dataset.i])));
    } catch {
        showToast('Search is unavailable right now', 'error');
    }
});

function pick(r) {
    $('geoResults').classList.add('hidden');
    $('locationInput').value = r.label.split(',').slice(0, 3).join(',');
    showWeather(r.lat, r.lng, r.label.split(',').slice(0, 3).join(','), '');
}

document.addEventListener('click', (e) => { if (!e.target.closest('.location-input-group')) $('geoResults').classList.add('hidden'); });

// Pricing toggle
const PRO = CONFIG.PLANS.pro;
document.querySelectorAll('[data-billing]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-billing]').forEach((x) => x.classList.toggle('active', x === b));
    const yearly = b.dataset.billing === 'yearly';
    $('proPrice').innerHTML = yearly ? `₦${PRO.yearly.toLocaleString()}<small> / year</small>` : `₦${PRO.monthly.toLocaleString()}<small> / month</small>`;
    $('proNote').textContent = yearly ? `Works out at ₦${Math.round(PRO.yearly / 12).toLocaleString()}/month - 2 months free` : 'Billed monthly';
}));

useGps(true);
