// Crop / livestock item forms - shared by the dashboard inventory and onboarding.
import { CROPS, LIVESTOCK, GROWTH_STAGES, IRRIGATION, PURPOSES, cropDays } from '../../js/catalog.js';
import { esc, todayISO } from '../../js/ui.js';
import { healthRadios, bindFormUI, readForm } from './fields.js';

const opt = (v, cur, label = v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;

function nameSelect(field, list, value, placeholder) {
    const known = list.includes(value);
    return `<select class="form-select" data-name-select>
            <option value="">${placeholder}</option>
            ${list.map((n) => opt(n, value)).join('')}
            <option value="__other" ${value && !known ? 'selected' : ''}>Other (type it)</option>
        </select>
        <input class="form-input other-input ${value && !known ? '' : 'hidden'}" data-field="${field}" value="${esc(value || '')}" placeholder="Type the name">`;
}

export function cropFormHTML(c = {}) {
    return `
    <div class="form-row">
        <div class="form-group"><label class="form-label">Crop *</label>${nameSelect('name', CROPS.map((x) => x.name), c.name, 'Select a crop')}</div>
        <div class="form-group"><label class="form-label">Variety</label><input class="form-input" data-field="variety" value="${esc(c.variety || '')}" placeholder="e.g. Oba Super 2"></div>
    </div>
    <div class="form-grid-3">
        <div class="form-group"><label class="form-label">Plot / field name</label><input class="form-input" data-field="plot" value="${esc(c.plot || '')}" placeholder="e.g. North field"></div>
        <div class="form-group"><label class="form-label">Area</label><input class="form-input" type="number" min="0" step="any" data-field="area" value="${esc(c.area ?? '')}"></div>
        <div class="form-group"><label class="form-label">Unit</label><select class="form-select" data-field="areaUnit">${['hectares', 'acres', 'plots', 'm²'].map((u) => opt(u, c.areaUnit || 'hectares')).join('')}</select></div>
    </div>
    <div class="form-grid-3">
        <div class="form-group"><label class="form-label">Number of plants / stands</label><input class="form-input" type="number" min="0" data-field="plantCount" value="${esc(c.plantCount ?? '')}"></div>
        <div class="form-group"><label class="form-label">Sow / plant date</label><input class="form-input" type="date" data-field="sowDate" value="${esc(c.sowDate || todayISO())}"></div>
        <div class="form-group"><label class="form-label">Expected harvest</label><input class="form-input" type="date" data-field="harvestDate" value="${esc(c.harvestDate || '')}"><small class="field-hint harvest-hint"></small></div>
    </div>
    <div class="form-row">
        <div class="form-group"><label class="form-label">Growth stage</label><select class="form-select" data-field="stage">${GROWTH_STAGES.map((s) => opt(s, c.stage || 'Seedling')).join('')}</select></div>
        <div class="form-group"><label class="form-label">Water source</label><select class="form-select" data-field="irrigation">${IRRIGATION.map((s) => opt(s, c.irrigation || 'Rain-fed')).join('')}</select></div>
    </div>
    ${healthRadios(c.health || 'good')}`;
}

export function livestockFormHTML(l = {}) {
    return `
    <div class="form-row">
        <div class="form-group"><label class="form-label">Animal type *</label>${nameSelect('type', LIVESTOCK, l.type, 'Select animal type')}</div>
        <div class="form-group"><label class="form-label">Breed</label><input class="form-input" data-field="breed" value="${esc(l.breed || '')}" placeholder="e.g. Isa Brown"></div>
    </div>
    <div class="form-grid-3">
        <div class="form-group"><label class="form-label">Number of animals *</label><input class="form-input" type="number" min="1" data-field="count" value="${esc(l.count ?? '')}"></div>
        <div class="form-group"><label class="form-label">Average age (months)</label><input class="form-input" type="number" min="0" step="any" data-field="avgAgeMonths" value="${esc(l.avgAgeMonths ?? '')}"></div>
        <div class="form-group"><label class="form-label">Purpose</label><select class="form-select" data-field="purpose">${PURPOSES.map((p) => opt(p, l.purpose || 'Meat')).join('')}</select></div>
    </div>
    <div class="form-row">
        <div class="form-group"><label class="form-label">Housing</label><select class="form-select" data-field="housing">${['Deep litter', 'Battery cage', 'Pen', 'Free range', 'Pond / tank', 'Paddock'].map((h) => opt(h, l.housing || 'Pen')).join('')}</select></div>
        <div class="form-group"><label class="form-label">Vaccinations up to date?</label><select class="form-select" data-field="vaccinated">${[['yes', 'Yes'], ['partial', 'Partly'], ['no', 'No'], ['unknown', 'Not sure']].map(([v, lbl]) => opt(v, l.vaccinated || 'unknown', lbl)).join('')}</select></div>
    </div>
    ${healthRadios(l.health || 'good')}`;
}

export function bindItemForm(root) {
    bindFormUI(root);
    root.querySelectorAll('[data-name-select]').forEach((sel) => {
        const other = sel.nextElementSibling;
        sel.addEventListener('change', () => {
            const isOther = sel.value === '__other';
            other.classList.toggle('hidden', !isOther);
            other.value = isOther ? '' : sel.value;
            if (isOther) other.focus();
            suggestHarvest(root, true);
        });
    });
    root.querySelector('[data-field="sowDate"]')?.addEventListener('change', () => suggestHarvest(root, true));
    suggestHarvest(root, false);
}

// Suggest an expected harvest date from the crop's typical days to maturity.
function suggestHarvest(root, overwrite) {
    const name = root.querySelector('[data-field="name"]')?.value;
    const sow = root.querySelector('[data-field="sowDate"]')?.value;
    const harvest = root.querySelector('[data-field="harvestDate"]');
    const hint = root.querySelector('.harvest-hint');
    if (!harvest || !hint) return;
    const days = cropDays(name);
    hint.textContent = days ? `${name} usually matures in ~${days} days` : '';
    if (days && sow && (overwrite || !harvest.value)) {
        const d = new Date(sow);
        d.setDate(d.getDate() + days);
        harvest.value = d.toISOString().slice(0, 10);
    }
}

export function readItemForm(root, kind) {
    const data = readForm(root);
    const key = kind === 'crop' ? 'name' : 'type';
    if (!data[key]) throw new Error(kind === 'crop' ? 'Please choose a crop.' : 'Please choose an animal type.');
    if (kind === 'livestock' && !(+data.count > 0)) throw new Error('Please enter how many animals you have.');
    return data;
}
