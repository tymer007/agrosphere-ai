// Overview: key stats, AI analysis (chat + recommendations), weather, upcoming tasks.
import { db } from '../../../js/store.js';
import { currentUser } from '../../../js/auth.js';
import { esc, fmtDate, daysBetween, startOfWeek, timeAgo, greeting } from '../../../js/ui.js';
import { t } from '../../../js/i18n.js';
import { resolveCoords, fetchWeather, reverseGeocode, describe, dayName, summarize, farmAlerts } from '../../../js/weather.js';
import { quota, lastAnalysis, analysisIsStale, runAnalysis, seedChatFromAnalysis, QuotaError } from '../../../js/ai.js';

let running = null;
let weatherSummary = null;

const PRIORITY = { high: ['danger', 'exclamation-circle'], medium: ['warning', 'exclamation-triangle'], low: ['success', 'check-circle'] };
const CATEGORY_ICON = { crops: 'seedling', livestock: 'cow', weather: 'cloud-sun-rain', records: 'clipboard-list', general: 'lightbulb' };

export default {
    id: 'overview',
    icon: 'fa-th-large',
    titleKey: 'overview',
    subKey: 'sub_overview',

    render(root, app) {
        const user = currentUser();
        const profile = db.one('profile') || {};
        const crops = db.list('crop');
        const animals = db.list('livestock');
        const records = db.list('record');
        const items = [...crops, ...animals];
        const heads = animals.reduce((s, a) => s + (+a.count || 0), 0);
        const attention = items.filter((i) => i.health === 'sick' || i.health === 'average');
        const weekStart = startOfWeek().toISOString().slice(0, 10);
        const reviewedIds = new Set(records.filter((r) => r.kind?.endsWith('review') && r.date >= weekStart).map((r) => r.itemId));
        const reviewed = items.filter((i) => reviewedIds.has(i.id)).length;

        app.setSubtitle(`${greeting()}, ${(user.fullName || '').split(' ')[0]}${profile.farmName ? ` · ${profile.farmName}` : ''}`);

        root.innerHTML = `
        <div class="dashboard-grid">
            ${stat('green', 'fa-seedling', crops.length, t('crops_tracked'), crops.length ? `${new Set(crops.map((c) => c.plot).filter(Boolean)).size || 1} plot(s)` : 'Add crops', 'up')}
            ${stat('blue', 'fa-cow', heads, t('livestock_head'), `${animals.length} group(s)`, 'up')}
            ${stat('orange', 'fa-exclamation-triangle', attention.length, t('needs_attention'), attention.length ? attention.slice(0, 2).map((i) => i.name || i.type).join(', ') : 'All healthy', attention.length ? 'down' : 'up')}
            ${stat('red', 'fa-clipboard-check', `${reviewed}/${items.length}`, t('reviews_this_week'), items.length && reviewed === items.length ? 'All done' : `${items.length - reviewed} due`, reviewed === items.length ? 'up' : 'down')}
        </div>

        <div class="glass-card analysis-card">
            <div class="analysis-head">
                <h3 class="section-title"><i class="fas fa-robot"></i> <span>${t('ai_analysis')}</span></h3>
                <div class="analysis-meta" id="analysisMeta"></div>
            </div>
            <div class="analysis-grid">
                <div class="analysis-chat">
                    <div class="analysis-messages" id="analysisMessages"></div>
                    <form class="analysis-reply" id="analysisReply">
                        <input class="ai-input" placeholder="Reply to Agro AI..." maxlength="1000">
                        <button class="ai-send" type="submit" title="Continue in chat"><i class="fas fa-paper-plane"></i></button>
                    </form>
                </div>
                <div class="analysis-recs">
                    <h4><i class="fas fa-list-check"></i> ${t('ai_recommendations')}</h4>
                    <div id="aiRecommendations"></div>
                </div>
            </div>
        </div>

        <div class="content-grid" style="margin-top:24px">
            <div class="glass-card"><h3 class="section-title"><i class="fas fa-cloud-sun"></i> <span>${t('weather')}</span></h3><div id="weatherBox" class="weather-box"><div class="loading-line">Loading local weather...</div></div></div>
            <div class="glass-card"><h3 class="section-title"><i class="fas fa-chart-pie"></i> <span>${t('farm_overview')}</span></h3><div class="chart-container"><canvas id="overviewChart"></canvas></div></div>
        </div>

        <div class="content-grid" style="margin-top:24px">
            <div class="glass-card"><h3 class="section-title"><i class="fas fa-calendar-check"></i> <span>${t('upcoming')}</span></h3>${upcoming(crops, items, reviewedIds)}</div>
            <div class="glass-card coming-soon-card">
                <h3 class="section-title"><i class="fas fa-chart-line"></i> <span>${t('profit_loss')}</span></h3>
                <div class="soon-body"><i class="fas fa-hourglass-half"></i><strong>${t('coming_soon')}</strong><p>Revenue, expenses and profit tracking are being built. Your farm records are already being saved for it.</p></div>
            </div>
        </div>`;

        drawChart(crops, animals);
        renderAnalysis(root, app);
        loadWeather(root).then(() => maybeAnalyse(root, app));

        root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => app.navigate(b.dataset.go)));
        root.querySelector('#analysisReply').addEventListener('submit', (e) => {
            e.preventDefault();
            const inputEl = e.target.querySelector('input');
            const text = inputEl.value.trim();
            const analysis = lastAnalysis();
            if (!text || !analysis) return;
            if (localStorage.getItem('agro_chat_seeded') !== analysis.analysedAt) {
                seedChatFromAnalysis(analysis);
                localStorage.setItem('agro_chat_seeded', analysis.analysedAt);
            }
            inputEl.value = '';
            window.dispatchEvent(new CustomEvent('agro:chat-open', { detail: { text } }));
        });

        return () => window.__agroChart?.destroy();
    }
};

function stat(color, icon, value, label, trend, dir) {
    return `<div class="stat-card"><div class="stat-header"><div class="stat-icon ${color}"><i class="fas ${icon}"></i></div><span class="stat-trend ${dir}">${esc(trend)}</span></div>
        <div class="stat-value">${esc(value)}</div><div class="stat-label">${esc(label)}</div></div>`;
}

function upcoming(crops, items, reviewedIds) {
    const rows = [];
    crops.filter((c) => c.harvestDate && c.stage !== 'Harvested').forEach((c) => {
        const d = daysBetween(c.harvestDate);
        if (d <= 30) rows.push({ sort: d, icon: 'fa-shopping-basket', tone: d < 0 ? 'danger' : 'success', text: `${c.name}${c.plot ? ` (${c.plot})` : ''} harvest ${d < 0 ? `was due ${-d} day(s) ago` : d === 0 ? 'is due today' : `in ${d} day(s)`}`, go: 'crops' });
    });
    items.filter((i) => !reviewedIds.has(i.id)).forEach((i) => rows.push({ sort: 100, icon: 'fa-clipboard-list', tone: 'warning', text: `Weekly review due: ${i.name || i.type}`, go: i.name ? 'crops' : 'livestock' }));
    if (!rows.length) return `<div class="empty-state small"><i class="fas fa-check-circle"></i><h3>You're all caught up</h3><p>No harvests or reviews due.</p></div>`;
    return `<ul class="task-list">${rows.sort((a, b) => a.sort - b.sort).slice(0, 7).map((r) => `
        <li><span class="task-icon badge-${r.tone}"><i class="fas ${r.icon}"></i></span><span>${esc(r.text)}</span><button class="btn-link" data-go="${r.go}">Open</button></li>`).join('')}</ul>`;
}

function drawChart(crops, animals) {
    const ctx = document.getElementById('overviewChart');
    if (!ctx || !window.Chart) return;
    const items = [...crops, ...animals];
    const counts = ['excellent', 'good', 'average', 'sick'].map((h) => items.filter((i) => i.health === h).length);
    window.__agroChart?.destroy();
    window.__agroChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [t('excellent'), t('good'), t('average'), t('sick')],
            datasets: [{ data: items.length ? counts : [1, 0, 0, 0], backgroundColor: items.length ? ['#10b981', '#34d399', '#f59e0b', '#ef4444'] : ['#e5e7eb'], borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '62%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 18, usePointStyle: true, color: '#374151' } },
                tooltip: { enabled: items.length > 0 }
            }
        }
    });
}

async function loadWeather(root) {
    const box = root.querySelector('#weatherBox');
    try {
        const farm = db.one('farm');
        const coords = await resolveCoords(farm?.location);
        const [wx, label] = await Promise.all([fetchWeather(coords.lat, coords.lng), coords.label ? coords.label : reverseGeocode(coords.lat, coords.lng)]);
        weatherSummary = { location: label, ...summarize(wx) };
        if (!box.isConnected) return;
        const now = describe(wx.current.code);
        const alert = farmAlerts(wx)[0];
        box.innerHTML = `
            <div class="wx-now">
                <div><div class="wx-place"><i class="fas fa-map-marker-alt"></i> ${esc(label)}${coords.source === 'default' ? ' <small>(default - allow location or map your farm)</small>' : ''}</div>
                    <div class="wx-temp">${wx.current.temp}<span>°C</span></div><div class="wx-label">${now.label} · feels ${wx.current.feels}°C</div></div>
                <i class="fas ${now.icon} wx-icon" style="color:${now.color}"></i>
            </div>
            <div class="wx-details">
                <span><i class="fas fa-tint"></i> ${wx.current.humidity}%</span>
                <span><i class="fas fa-wind"></i> ${wx.current.wind} km/h</span>
                <span><i class="fas fa-compress-arrows-alt"></i> ${wx.current.pressure} hPa</span>
                <span><i class="fas fa-cloud-rain"></i> ${wx.current.precip} mm</span>
            </div>
            <div class="wx-week">${wx.daily.map((d, i) => {
                const w = describe(d.code);
                return `<div class="wx-day"><small>${dayName(d.date, i)}</small><i class="fas ${w.icon}" style="color:${w.color}"></i><strong>${d.max}°</strong><small>${d.min}°</small><em>${d.rainChance ?? 0}%</em></div>`;
            }).join('')}</div>
            <div class="wx-alert badge-${alert.level}"><i class="fas ${alert.icon}"></i> <span><strong>${esc(alert.title)}:</strong> ${esc(alert.text)}</span></div>`;
    } catch {
        if (box.isConnected) box.innerHTML = `<div class="empty-state small"><i class="fas fa-cloud"></i><p>Weather is unavailable right now.</p></div>`;
    }
}

function renderAnalysis(root, app, state = {}) {
    const msgBox = root.querySelector('#analysisMessages');
    const recBox = root.querySelector('#aiRecommendations');
    const meta = root.querySelector('#analysisMeta');
    if (!msgBox) return;
    const analysis = lastAnalysis();
    const left = quota.remaining('analysis');
    const hasData = db.list('crop').length + db.list('livestock').length > 0;
    const stale = analysisIsStale();

    meta.innerHTML = `
        ${analysis ? `<span><i class="fas fa-clock"></i> Analysed ${timeAgo(analysis.analysedAt)}</span>` : ''}
        <span class="quota-pill ${left ? '' : 'empty'}">${left}/${quota.limit('analysis')} analyses left today</span>
        ${stale && left && hasData && !state.loading ? `<button class="btn-link" id="reanalyse"><i class="fas fa-sync"></i> ${analysis ? 'Update' : 'Run'} analysis</button>` : ''}`;
    meta.querySelector('#reanalyse')?.addEventListener('click', () => maybeAnalyse(root, app, true));

    const bubble = (html) => `<div class="message ai"><div class="avatar"><i class="fas fa-robot"></i></div><div class="message-content">${html}</div></div>`;
    const notes = [];
    if (state.loading) notes.push(bubble(`<span class="dots"><i></i><i></i><i></i></span> Analysing your latest farm data...`));
    if (state.error) notes.push(bubble(`<span style="color:#ef4444">${esc(state.error)}</span>`));
    if (!hasData && !analysis) notes.push(bubble('Add your crops or livestock and do a weekly review - I will analyse your farm and give you recommendations here.'));
    else if (stale && !left && !state.loading) notes.push(bubble(`Your farm data has changed since the last analysis, but you've used today's ${quota.limit('analysis')} analyses. Check back tomorrow for your daily analysis.`));

    msgBox.innerHTML = (analysis ? bubble(`${fmt(analysis.response)}<br><br><strong>${fmt(analysis.conversationStarter)}</strong>`) : '') + notes.join('');
    root.querySelector('#analysisReply').classList.toggle('hidden', !analysis);

    const recs = analysis?.recommendations || [];
    recBox.innerHTML = recs.length
        ? recs.map((r) => {
            const [tone, icon] = PRIORITY[r.priority] || PRIORITY.medium;
            return `<div class="message ai rec-item"><div class="avatar" style="background:var(--${tone})"><i class="fas fa-${CATEGORY_ICON[r.category] || icon}"></i></div>
                <div class="message-content" style="border-left:4px solid var(--${tone})"><strong style="color:var(--${tone});display:block;margin-bottom:4px;">${esc(String(r.title).replace(/\s*[(\[](high|medium|low)[)\]]\s*$/i, ''))}</strong>${esc(r.detail)}</div></div>`;
        }).join('')
        : `<div class="empty-state small"><i class="fas fa-lightbulb"></i><p>Recommendations will appear after your first analysis.</p></div>`;
}

function fmt(text) {
    return esc(text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

// Runs only when data changed since the last analysis and the user opens the overview.
async function maybeAnalyse(root, app, manual = false) {
    const hasData = db.list('crop').length + db.list('livestock').length > 0;
    if (!hasData || !analysisIsStale() || quota.remaining('analysis') <= 0) return renderAnalysis(root, app);
    if (!manual && running) return;
    const failedAt = +sessionStorage.getItem('agro_analysis_failed_at') || 0;
    if (!manual && Date.now() - failedAt < 10 * 60 * 1000) {
        return renderAnalysis(root, app, { error: 'The last analysis attempt failed. Use "Update analysis" to try again.' });
    }
    renderAnalysis(root, app, { loading: true });
    running = runAnalysis(weatherSummary);
    try {
        await running;
        sessionStorage.removeItem('agro_analysis_failed_at');
        renderAnalysis(root, app);
    } catch (err) {
        if (!(err instanceof QuotaError)) sessionStorage.setItem('agro_analysis_failed_at', String(Date.now()));
        renderAnalysis(root, app, { error: err instanceof QuotaError ? err.message : `Analysis failed: ${err.message}` });
    } finally {
        running = null;
    }
}
