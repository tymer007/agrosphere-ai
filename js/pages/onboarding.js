// Onboarding: profile -> get started -> farm chat (preset "AI") -> map -> goals.
// The current step is saved on the user so a refresh resumes where they left off.
import '../../components/brand-logo.js';
import '../../components/theme-toggle.js';
import { currentUser, updateUser, logout } from '../auth.js';
import { db } from '../store.js';
import { esc, toast, fmtDate, daysBetween } from '../ui.js';
import { GOALS } from '../catalog.js';
import { geocode, browserLocation } from '../weather.js';
import { CONFIG } from '../config.js';
import { cropFormHTML, livestockFormHTML, bindItemForm, readItemForm } from '../../components/dashboard/item-forms.js';

const STEPS = [
    ['profile', 'Profile'],
    ['welcome', 'Get started'],
    ['farm', 'Your farm'],
    ['map', 'Farm map'],
    ['goals', 'Goals']
];

const user = currentUser();
const editMap = new URLSearchParams(location.search).get('edit') === 'map';
if (!user) location.replace('/login');
else if (user.onboarded && !editMap) location.replace('/dashboard');
else start();

function start() {
    document.getElementById('obLogout').addEventListener('click', logout);
    go(editMap ? 'map' : user.onboardingStep || 'profile');
}

function go(step) {
    if (!editMap) updateUser({ onboardingStep: step });
    const idx = STEPS.findIndex(([id]) => id === step);
    document.getElementById('obSteps').innerHTML = editMap ? '' : STEPS.map(([id, label], i) =>
        `<li class="${i === idx ? 'active' : i < idx ? 'done' : ''}"><span>${i < idx ? '<i class="fas fa-check"></i>' : i + 1}</span><em>${label}</em></li>`).join('');
    const main = document.getElementById('obMain');
    main.innerHTML = '';
    main.style.animation = 'none';
    void main.offsetWidth;
    main.style.animation = '';
    ({ profile, welcome, farm, map: mapStep, goals })[step](main);
    window.scrollTo({ top: 0 });
}

// ---------------- 1. Profile ----------------
function profile(main) {
    const p = db.one('profile') || {};
    const countries = ['Nigeria', 'Ghana', 'Kenya', 'Uganda', 'Tanzania', 'Ethiopia', 'Rwanda', 'Cameroon', 'South Africa', 'Senegal', "Côte d'Ivoire", 'Other'];
    const opt = (list, cur) => list.map((c) => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
    main.innerHTML = `
    <div class="ob-title ob-card"><h1>Hi ${esc(user.fullName.split(' ')[0])}, tell us about you</h1><p>A few details so Agro AI can give advice for your area.</p></div>
    <form class="glass-card ob-card" id="profileForm" novalidate>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Phone number</label><input class="form-input" name="phone" value="${esc(p.phone || '')}" placeholder="+234 ..." autocomplete="tel"></div>
            <div class="form-group"><label class="form-label">Your role</label><select class="form-select" name="role">${opt(['Owner', 'Farm manager', 'Farm worker', 'Cooperative member', 'Student / researcher'], p.role)}</select></div>
        </div>
        <div class="form-grid-3">
            <div class="form-group"><label class="form-label">Country *</label><select class="form-select" name="country">${opt(countries, p.country || 'Nigeria')}</select></div>
            <div class="form-group"><label class="form-label">State / region *</label><input class="form-input" name="state" value="${esc(p.state || '')}" placeholder="e.g. Oyo" required></div>
            <div class="form-group"><label class="form-label">Town / city *</label><input class="form-input" name="city" value="${esc(p.city || '')}" placeholder="e.g. Ibadan" required></div>
        </div>
        <div class="form-group"><label class="form-label">Farm address or nearest landmark</label><input class="form-input" name="address" value="${esc(p.address || '')}" placeholder="e.g. Akanran Road, Olorunsogo village"></div>
        <div class="form-grid-3">
            <div class="form-group"><label class="form-label">Farm name</label><input class="form-input" name="farmName" value="${esc(p.farmName || '')}" placeholder="e.g. Green Valley Farm"></div>
            <div class="form-group"><label class="form-label">Farm size</label><input class="form-input" type="number" min="0" step="any" name="farmSize" value="${esc(p.farmSize ?? '')}"></div>
            <div class="form-group"><label class="form-label">Unit</label><select class="form-select" name="farmSizeUnit">${opt(['hectares', 'acres', 'plots'], p.farmSizeUnit || 'hectares')}</select></div>
        </div>
        <div class="form-group"><label class="form-label">Farming experience</label>
            <div class="radio-group">${['Just starting', '1-2 years', '3-5 years', '6-10 years', '10+ years'].map((x) => `<label class="radio-label ${p.experience === x ? 'active' : ''}"><input type="radio" name="experience" value="${x}" ${p.experience === x ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>
        </div>
        <div class="ob-actions"><span></span><button class="btn btn-primary" type="submit">Continue <i class="fas fa-arrow-right"></i></button></div>
    </form>`;
    const form = main.querySelector('form');
    form.querySelectorAll('.radio-group').forEach((g) => g.addEventListener('change', () => g.querySelectorAll('.radio-label').forEach((l) => l.classList.toggle('active', l.querySelector('input').checked))));
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(form));
        if (!f.state?.trim() || !f.city?.trim()) return toast('Please add your state and town so we can find your farm', 'warning');
        db.setOne('profile', {
            phone: f.phone.trim(), role: f.role, country: f.country, state: f.state.trim(), city: f.city.trim(), address: f.address.trim(),
            farmName: f.farmName.trim() || `${user.fullName.split(' ')[0]}'s Farm`, farmSize: f.farmSize ? +f.farmSize : '', farmSizeUnit: f.farmSizeUnit,
            experience: f.experience || ''
        });
        go('welcome');
    });
}

// ---------------- 2. Get started ----------------
function welcome(main) {
    main.innerHTML = `
    <div class="ob-welcome">
        <span class="agro-logo" style="--logo-size:90px"><i class="fas fa-leaf"></i></span>
        <h1>Let's set up <span>your farm</span></h1>
        <p>Agro AI will ask you a few quick questions about what you grow and raise. It takes about 2 minutes, and you can change everything later.</p>
        <div class="ob-welcome-grid">
            <div><i class="fas fa-seedling"></i><strong>Crops & livestock</strong><small>Tell us what you farm</small></div>
            <div><i class="fas fa-map-marked-alt"></i><strong>Map your farm</strong><small>Pin it for local weather</small></div>
            <div><i class="fas fa-bullseye"></i><strong>Your goals</strong><small>So advice fits your plans</small></div>
        </div>
        <button class="btn btn-primary" id="startChat" style="padding:16px 34px;font-size:1rem"><i class="fas fa-comments"></i> Get started with Agro AI</button>
        <div style="margin-top:18px"><button class="btn-link" id="backProfile" style="color:inherit;opacity:.7"><i class="fas fa-arrow-left"></i> Back to profile</button></div>
    </div>`;
    main.querySelector('#startChat').addEventListener('click', () => go('farm'));
    main.querySelector('#backProfile').addEventListener('click', () => go('profile'));
}

// ---------------- 3. Farm chat ----------------
function farm(main) {
    main.innerHTML = `
    <div class="glass-card ob-chat">
        <div class="ai-header">
            <div class="ai-avatar"><i class="fas fa-robot"></i></div>
            <div><h3>Agro AI</h3><div class="ai-status"><span>Setting up your farm</span></div></div>
        </div>
        <div class="ob-chat-body" id="chat"></div>
    </div>`;
    const chat = main.querySelector('#chat');
    const first = user.fullName.split(' ')[0];
    const scroll = () => chat.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });

    const bot = (html, delay = 650) => new Promise((resolve) => {
        const typing = document.createElement('div');
        typing.className = 'message ai typing';
        typing.innerHTML = `<div class="avatar"><i class="fas fa-robot"></i></div><div class="message-content"><span class="dots"><i></i><i></i><i></i></span></div>`;
        chat.appendChild(typing);
        scroll();
        setTimeout(() => {
            typing.classList.remove('typing');
            typing.querySelector('.message-content').innerHTML = html;
            scroll();
            resolve();
        }, delay);
    });
    const me = (text) => {
        chat.insertAdjacentHTML('beforeend', `<div class="message user"><div class="message-content">${esc(text)}</div></div>`);
        scroll();
    };
    const ask = (options) => new Promise((resolve) => {
        const wrap = document.createElement('div');
        wrap.className = 'chat-options';
        wrap.innerHTML = options.map(([value, label, icon, primary]) => `<button class="chat-option ${primary ? 'primary' : ''}" data-v="${value}">${icon ? `<i class="fas ${icon}"></i>` : ''}${esc(label)}</button>`).join('');
        chat.appendChild(wrap);
        scroll();
        wrap.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
            wrap.remove();
            me(b.textContent.trim());
            resolve(b.dataset.v);
        }));
    });
    const itemForm = (kind) => new Promise((resolve) => {
        const wrap = document.createElement('form');
        wrap.className = 'chat-form';
        wrap.noValidate = true;
        wrap.innerHTML = `${kind === 'crop' ? cropFormHTML({}) : livestockFormHTML({})}
            <div class="chat-form-actions"><button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Add ${kind === 'crop' ? 'crop' : 'animals'}</button></div>`;
        chat.appendChild(wrap);
        bindItemForm(wrap);
        scroll();
        wrap.addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                const data = readItemForm(wrap, kind);
                wrap.remove();
                resolve(data);
            } catch (err) {
                toast(err.message, 'warning');
            }
        });
    });

    const cropReply = (c) => {
        const days = c.harvestDate ? daysBetween(c.harvestDate) : null;
        const harvest = days != null && days >= 0 ? `Expected harvest is around <strong>${fmtDate(c.harvestDate)}</strong> - about ${days} days away.` : '';
        const health = c.health === 'sick' ? "I'm sorry it's unwell. Once you're in, upload a photo to <strong>AI Plant Diagnosis</strong> and I'll suggest treatment."
            : c.health === 'average' ? "It's doing okay - I'll help you watch it closely in your weekly reviews."
            : "Great - it's in good shape.";
        return `<strong>${esc(c.name)}</strong>${c.variety ? ` (${esc(c.variety)})` : ''} added${c.area ? ` on ${esc(c.area)} ${esc(c.areaUnit)}` : ''}. ${harvest} ${health} I'll remind you to review it each week.`;
    };
    const animalReply = (l) => {
        const vax = l.vaccinated === 'no' ? " Their vaccinations aren't up to date - I'll flag that on your dashboard." : l.vaccinated === 'partial' ? " Some still need vaccinating - I'll remind you." : '';
        const health = l.health === 'sick' ? ' Since they are sick, isolate the affected animals and check with a vet soon.' : '';
        return `<strong>${esc(l.count)} ${esc(l.type)}</strong>${l.breed ? ` (${esc(l.breed)})` : ''} added.${vax}${health} Weekly reviews will track head count, feed and health.`;
    };

    const collect = async (kind) => {
        const noun = kind === 'crop' ? 'crop' : 'livestock group';
        let count = db.list(kind).length;
        if (count) await bot(`You already have ${count} ${noun}(s) saved: ${db.list(kind).map((i) => esc(i.name || i.type)).join(', ')}.`, 400);
        else {
            await bot(kind === 'crop'
                ? "Which crops are you growing? Pick one from the list (or choose <em>Other</em>) and add its details - you can add as many as you like."
                : "Now your animals. Add each group (for example <em>300 layers</em> or <em>12 goats</em>) - pick from the list or choose <em>Other</em>.");
            const item = db.put(kind, await itemForm(kind));
            me(kind === 'crop' ? `${item.name}${item.variety ? ` (${item.variety})` : ''}` : `${item.count} × ${item.type}`);
            await bot(kind === 'crop' ? cropReply(item) : animalReply(item));
            count = 1;
        }
        for (;;) {
            const next = await ask([['more', `Add another ${noun}`, 'fa-plus'], ['done', `Done with ${kind === 'crop' ? 'crops' : 'livestock'}`, 'fa-check', true]]);
            if (next === 'done') break;
            await bot(`Sure - add the next ${noun}.`, 350);
            const item = db.put(kind, await itemForm(kind));
            me(kind === 'crop' ? `${item.name}${item.variety ? ` (${item.variety})` : ''}` : `${item.count} × ${item.type}`);
            await bot(kind === 'crop' ? cropReply(item) : animalReply(item));
        }
    };

    (async () => {
        await bot(`Hello ${esc(first)}! I'm <strong>Agro AI</strong>. Let's set up your farm so I can give you advice that actually fits it.`, 500);
        await bot('First - what do you farm?');
        const type = await ask([['crops', 'Crops', 'fa-seedling'], ['livestock', 'Livestock', 'fa-cow'], ['both', 'Crops & Livestock', 'fa-tractor']]);
        db.setOne('farm', { farmType: type });
        await bot(type === 'both' ? "A mixed farm - great. Let's start with your crops, then your animals." : type === 'crops' ? "Crops it is." : "Livestock it is.", 450);
        if (type !== 'livestock') await collect('crop');
        if (type !== 'crops') await collect('livestock');
        const crops = db.list('crop').length, animals = db.list('livestock');
        const heads = animals.reduce((s, a) => s + (+a.count || 0), 0);
        await bot(`Perfect! You've added ${[crops && `<strong>${crops} crop(s)</strong>`, animals.length && `<strong>${animals.length} livestock group(s)</strong> (${heads} animals)`].filter(Boolean).join(' and ')}. Next, let's put your farm on the map so your weather and alerts are for your exact location.`);
        await ask([['next', 'Continue to farm map', 'fa-map-marked-alt', true]]);
        go('map');
    })();
}

// ---------------- 4. Map ----------------
async function mapStep(main) {
    const profileData = db.one('profile') || {};
    const saved = db.one('farm')?.location || {};
    const addressText = [profileData.address, profileData.city, profileData.state, profileData.country].filter(Boolean).join(', ');

    main.innerHTML = `
    <div class="ob-title"><h1>${editMap ? 'Edit your farm map' : 'Map your farm'}</h1><p>Search, drop a pin on your farm, then draw its boundary or mark important points. You can also skip and just use your address.</p></div>
    <div class="ob-map-layout">
        <div class="glass-card ob-map-panel">
            <div class="tool-grid">
                <button class="tool-btn active" data-mode="pin"><i class="fas fa-map-pin"></i> Farm pin</button>
                <button class="tool-btn" data-mode="boundary"><i class="fas fa-draw-polygon"></i> Boundary</button>
                <button class="tool-btn" data-mode="radius"><i class="fas fa-bullseye"></i> Radius</button>
                <button class="tool-btn" data-mode="points"><i class="fas fa-map-marker-alt"></i> Mark points</button>
            </div>
            <div class="tool-hint" id="toolHint"></div>
            <div id="toolExtra"></div>
            <ul class="map-stats" id="mapStats"></ul>
            <ul class="points-list" id="pointsList"></ul>
            <div class="ob-actions" style="flex-direction:column">
                <button class="btn btn-primary" id="saveMap" style="justify-content:center"><i class="fas fa-check"></i> Save farm map</button>
                <button class="btn btn-glass" id="skipMap" style="justify-content:center">${editMap ? 'Cancel' : 'Skip - just use my address'}</button>
                ${editMap ? '' : `<button class="btn-link" id="backFarm"><i class="fas fa-arrow-left"></i> Back</button>`}
            </div>
        </div>
        <div class="ob-map-wrap">
            <div id="farmMap"></div>
            <div class="map-search"><i class="fas fa-search"></i><input id="mapSearch" placeholder="Search a place or address" value="${esc(saved.address || addressText)}"><div class="map-search-results" id="mapResults"></div></div>
            <div class="map-layer-toggle"><button class="active" data-layer="sat">Satellite</button><button data-layer="street">Map</button></div>
        </div>
    </div>`;

    await waitFor(() => window.L);
    const L = window.L;
    const state = {
        mode: 'pin', pin: saved.lat ? { lat: saved.lat, lng: saved.lng } : null, address: saved.address || addressText,
        boundary: saved.boundary || [], radius: saved.radius || 0, points: saved.points || []
    };

    const map = L.map('farmMap', { zoomControl: true }).setView([CONFIG.DEFAULT_LOCATION.lat, CONFIG.DEFAULT_LOCATION.lng], 6);
    const layers = {
        sat: L.layerGroup([
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' }),
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
        ]),
        street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' })
    };
    layers.sat.addTo(map);
    main.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => {
        main.querySelectorAll('[data-layer]').forEach((x) => x.classList.toggle('active', x === b));
        Object.values(layers).forEach((l) => map.removeLayer(l));
        layers[b.dataset.layer].addTo(map);
    }));

    const drawn = L.layerGroup().addTo(map);
    const pinIcon = L.divIcon({ className: '', html: '<i class="fas fa-map-marker-alt" style="font-size:36px;color:#ef4444;filter:drop-shadow(0 3px 3px rgba(0,0,0,.4))"></i>', iconSize: [28, 36], iconAnchor: [14, 36] });
    const pointIcon = L.divIcon({ className: '', html: '<i class="fas fa-circle" style="font-size:14px;color:#3b82f6;border:3px solid #fff;border-radius:50%"></i>', iconSize: [20, 20], iconAnchor: [10, 10] });

    const HINTS = {
        pin: 'Click on the map to place your farm pin. Weather and alerts will use this spot.',
        boundary: 'Click around the edge of your farm to draw its boundary. Each click adds a corner.',
        radius: 'Set a radius around your pin to show the rough size of your farm.',
        points: 'Click to mark important spots - water source, pen, store, borehole...'
    };

    function drawShapes() {
        drawn.clearLayers();
        if (state.boundary.length >= 2) L.polygon(state.boundary, { color: '#fbbf24', weight: 3, fillColor: '#fbbf24', fillOpacity: 0.2 }).addTo(drawn);
        state.boundary.forEach((p) => L.circleMarker(p, { radius: 5, color: '#fbbf24', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(drawn));
        if (state.pin) {
            L.marker([state.pin.lat, state.pin.lng], { icon: pinIcon, draggable: true }).addTo(drawn).on('dragend', (e) => {
                const ll = e.target.getLatLng();
                state.pin = { lat: ll.lat, lng: ll.lng };
                drawShapes();
                renderStats();
            });
            if (state.radius) L.circle([state.pin.lat, state.pin.lng], { radius: state.radius, color: '#34d399', weight: 2, fillOpacity: 0.12, dashArray: '6 6' }).addTo(drawn);
        }
        state.points.forEach((p) => L.marker([p.lat, p.lng], { icon: pointIcon }).bindTooltip(esc(p.label), { permanent: true, direction: 'top', offset: [0, -8] }).addTo(drawn));
    }

    function renderStats() {
        const area = polygonAreaHa(state.boundary);
        main.querySelector('#mapStats').innerHTML = `
            <li><span>Pin</span><strong>${state.pin ? `${state.pin.lat.toFixed(5)}, ${state.pin.lng.toFixed(5)}` : 'not set'}</strong></li>
            <li><span>Boundary</span><strong>${state.boundary.length >= 3 ? `${area.toFixed(2)} ha (${(area * 2.471).toFixed(2)} acres)` : `${state.boundary.length} corner(s)`}</strong></li>
            <li><span>Radius</span><strong>${state.radius ? `${state.radius} m` : 'off'}</strong></li>`;
        main.querySelector('#pointsList').innerHTML = state.points.map((p, i) => `<li><span><i class="fas fa-circle" style="color:#3b82f6;font-size:.6rem"></i> ${esc(p.label)}</span><button data-rm="${i}" aria-label="Remove"><i class="fas fa-times"></i></button></li>`).join('');
        main.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { state.points.splice(+b.dataset.rm, 1); render(); }));
    }

    function renderTool() {
        main.querySelector('#toolHint').textContent = HINTS[state.mode];
        const extra = main.querySelector('#toolExtra');
        if (state.mode === 'boundary') {
            extra.innerHTML = `<div class="tool-sub"><button class="btn btn-glass btn-sm" id="undoPt"><i class="fas fa-undo"></i> Undo</button><button class="btn btn-glass btn-sm" id="clearB"><i class="fas fa-trash"></i> Clear</button></div>`;
            extra.querySelector('#undoPt').onclick = () => { state.boundary.pop(); render(); };
            extra.querySelector('#clearB').onclick = () => { state.boundary = []; render(); };
        } else if (state.mode === 'radius') {
            extra.innerHTML = state.pin
                ? `<div class="range-row"><span>Radius</span><input type="range" min="0" max="3000" step="50" value="${state.radius}" id="radiusIn"><span id="radiusVal">${state.radius ? `${state.radius} m` : 'off'}</span></div>`
                : '<p class="tool-hint" style="background:#fee2e2;color:#b91c1c">Place your farm pin first (click the map).</p>';
            extra.querySelector('#radiusIn')?.addEventListener('input', (e) => {
                state.radius = +e.target.value;
                extra.querySelector('#radiusVal').textContent = state.radius ? `${state.radius} m` : 'off';
                drawShapes();
                renderStats();
            });
        } else extra.innerHTML = '';
    }

    function render() {
        drawShapes();
        renderTool();
        renderStats();
    }

    main.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
        state.mode = b.dataset.mode;
        main.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
        render();
    }));

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (state.mode === 'pin') state.pin = { lat, lng };
        if (state.mode === 'boundary') state.boundary.push([lat, lng]);
        if (state.mode === 'radius' && !state.pin) state.pin = { lat, lng };
        if (state.mode === 'points') {
            const label = prompt('Name this point (e.g. Water source, Goat pen):', `Point ${state.points.length + 1}`);
            if (label === null) return;
            state.points.push({ lat, lng, label: label.trim().slice(0, 40) || `Point ${state.points.length + 1}` });
        }
        render();
    });

    // Search (Nominatim)
    const input = main.querySelector('#mapSearch');
    const results = main.querySelector('#mapResults');
    const flyTo = (r, zoom = 15) => {
        map.setView([r.lat, r.lng], zoom);
        state.address = r.label;
        input.value = r.label;
        results.innerHTML = '';
    };
    input.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        try {
            const found = await geocode(input.value.trim());
            if (!found.length) return toast('No match found - try a nearby town', 'warning');
            results.innerHTML = found.map((r, i) => `<button data-i="${i}">${esc(r.label)}</button>`).join('');
            results.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => flyTo(found[+b.dataset.i])));
        } catch {
            toast('Search is unavailable right now', 'error');
        }
    });

    // Initial view: saved location -> profile address -> GPS -> default
    render();
    if (state.pin) {
        const bounds = L.latLngBounds([[state.pin.lat, state.pin.lng], ...state.boundary, ...state.points.map((p) => [p.lat, p.lng])]);
        map.fitBounds(bounds.pad(0.4), { maxZoom: 17 });
    } else {
        let found = null;
        for (const q of [addressText, [profileData.city, profileData.state, profileData.country].filter(Boolean).join(', ')]) {
            if (!q) continue;
            try { found = (await geocode(q, 1))[0]; } catch { /* offline */ }
            if (found) break;
        }
        if (found) {
            map.setView([found.lat, found.lng], 14);
            state.address = found.label;
            toast('Found your area - now click your exact farm spot', 'info');
        } else {
            const gps = await browserLocation();
            if (gps) map.setView([gps.lat, gps.lng], 15);
        }
    }
    setTimeout(() => map.invalidateSize(), 200);

    main.querySelector('#saveMap').addEventListener('click', () => {
        if (!state.pin && state.boundary.length < 3) return toast('Place your farm pin (or draw a boundary) first', 'warning');
        const center = state.pin || centroid(state.boundary);
        db.setOne('farm', {
            location: {
                lat: center.lat, lng: center.lng, address: state.address || addressText, boundary: state.boundary,
                radius: state.radius, points: state.points, areaHa: +polygonAreaHa(state.boundary).toFixed(3), mapped: true
            }
        });
        toast('Farm map saved');
        editMap ? (location.href = '/dashboard#settings') : go('goals');
    });
    main.querySelector('#skipMap').addEventListener('click', async () => {
        if (editMap) return (location.href = '/dashboard#settings');
        let geo = null;
        try { geo = (await geocode(addressText || profileData.city || '', 1))[0]; } catch { /* ignore */ }
        db.setOne('farm', { location: { address: addressText, lat: geo?.lat ?? null, lng: geo?.lng ?? null, boundary: [], radius: 0, points: [], mapped: false } });
        go('goals');
    });
    main.querySelector('#backFarm')?.addEventListener('click', () => go('farm'));
}

function waitFor(check, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const t0 = Date.now();
        (function poll() {
            if (check()) return resolve();
            if (Date.now() - t0 > timeout) return reject(new Error('Map failed to load'));
            setTimeout(poll, 50);
        })();
    });
}

// Spherical polygon area in hectares.
function polygonAreaHa(points) {
    if (points.length < 3) return 0;
    const R = 6378137, rad = Math.PI / 180;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const [lat1, lng1] = points[i];
        const [lat2, lng2] = points[(i + 1) % points.length];
        sum += (lng2 - lng1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
    }
    return Math.abs((sum * R * R) / 2) / 10000;
}

function centroid(points) {
    const n = points.length;
    return { lat: points.reduce((s, p) => s + p[0], 0) / n, lng: points.reduce((s, p) => s + p[1], 0) / n };
}

// ---------------- 5. Goals ----------------
function goals(main) {
    const f = db.one('farm') || {};
    const chosen = new Set(f.goals || []);
    main.innerHTML = `
    <div class="ob-title ob-card"><h1>What are your goals?</h1><p>Pick everything that matters to you - Agro AI will focus its recommendations on these.</p></div>
    <div class="glass-card ob-card">
        <div class="goal-grid">${GOALS.map((g) => `<button class="goal-card ${chosen.has(g.id) ? 'active' : ''}" data-goal="${g.id}"><i class="fas ${g.icon}"></i> ${esc(g.label)}</button>`).join('')}</div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Your biggest challenge right now</label>
                <select class="form-select" id="challenge">${['Pests and plant disease', 'Unpredictable weather', 'Low yields', 'Sick animals', 'Keeping records', 'Cost of fertilizer & feed', 'Finding buyers', 'Other'].map((c) => `<option ${c === f.challenge ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Best day for your weekly review</label>
                <select class="form-select" id="reviewDay">${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => `<option ${d === (f.reviewDay || 'Saturday') ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        </div>
        <div class="ob-actions">
            <button class="btn btn-glass" id="backMap"><i class="fas fa-arrow-left"></i> Back</button>
            <button class="btn btn-primary" id="finish"><i class="fas fa-rocket"></i> Finish & open my dashboard</button>
        </div>
    </div>`;
    main.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => {
        chosen.has(b.dataset.goal) ? chosen.delete(b.dataset.goal) : chosen.add(b.dataset.goal);
        b.classList.toggle('active');
    }));
    main.querySelector('#backMap').addEventListener('click', () => go('map'));
    main.querySelector('#finish').addEventListener('click', () => {
        if (!chosen.size) return toast('Pick at least one goal', 'warning');
        db.setOne('farm', { goals: [...chosen], challenge: main.querySelector('#challenge').value, reviewDay: main.querySelector('#reviewDay').value });
        updateUser({ onboarded: true, onboardingStep: 'done' });
        localStorage.setItem('agro_last_section', 'overview');
        location.href = '/dashboard#overview';
    });
}
