// Shared form fields + save logic for every record kind.
import { db } from '../../js/store.js';
import { esc, todayISO, isoWeek } from '../../js/ui.js';
import { HEALTH, GROWTH_STAGES, CROP_ISSUES, LIVESTOCK_SYMPTOMS, IRRIGATION, RECORD_KINDS } from '../../js/catalog.js';
import { t } from '../../js/i18n.js';

let uidCounter = 0;

export function healthRadios(value = 'good') {
    const n = `health_${++uidCounter}`;
    return `<div class="form-group"><label class="form-label">${t('health_status')}</label><div class="radio-group">
        ${HEALTH.map((h) => `<label class="radio-label ${h.value === value ? 'active' : ''}"><input type="radio" name="${n}" data-field="health" value="${h.value}" ${h.value === value ? 'checked' : ''}><span>${t(h.value)}</span></label>`).join('')}
    </div></div>`;
}

export function chips(field, options, selected = [], label = '') {
    return `<div class="form-group">${label ? `<label class="form-label">${label}</label>` : ''}<div class="chip-group" data-chips="${field}">
        ${options.map((o) => `<button type="button" class="chip ${selected.includes(o) ? 'active' : ''}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}
    </div></div>`;
}

export function input(field, label, value = '', attrs = '') {
    return `<div class="form-group"><label class="form-label">${label}</label><input class="form-input" data-field="${field}" value="${esc(value)}" ${attrs}></div>`;
}

export function select(field, label, options, value = '', attrs = '') {
    return `<div class="form-group"><label class="form-label">${label}</label><select class="form-select" data-field="${field}" ${attrs}>
        ${options.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
        }).join('')}
    </select></div>`;
}

export function textarea(field, label, value = '', placeholder = '') {
    return `<div class="form-group"><label class="form-label">${label}</label><textarea class="form-textarea" data-field="${field}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
}

// Item picker for a record kind.
export function itemSelect(kind, itemId = '') {
    const type = RECORD_KINDS[kind]?.itemType;
    const crops = db.list('crop');
    const animals = db.list('livestock');
    const opt = (id, label) => `<option value="${id}" ${id === itemId ? 'selected' : ''}>${esc(label)}</option>`;
    let body = '';
    if (type === 'crop' || type === 'any') body += `<optgroup label="Crops">${crops.map((c) => opt(`crop:${c.id}`, `${c.name}${c.variety ? ` (${c.variety})` : ''}${c.plot ? ` - ${c.plot}` : ''}`)).join('')}</optgroup>`;
    if (type === 'livestock' || type === 'any') body += `<optgroup label="Livestock">${animals.map((l) => opt(`livestock:${l.id}`, `${l.type}${l.breed ? ` (${l.breed})` : ''} - ${l.count || 0} head`)).join('')}</optgroup>`;
    if (type === 'any') body += `<optgroup label="Other">${opt('farm:', 'Whole farm / general')}</optgroup>`;
    const empty = type === 'crop' ? !crops.length : type === 'livestock' ? !animals.length : false;
    return `<div class="form-group"><label class="form-label">${type === 'livestock' ? 'Livestock group' : type === 'crop' ? 'Crop' : 'Applies to'}</label>
        ${empty ? `<p class="field-hint"><i class="fas fa-info-circle"></i> Add a ${type} to your inventory first.</p>` : ''}
        <select class="form-select" data-field="item" ${empty ? 'disabled' : ''}>${body}</select></div>`;
}

// Kind-specific fields. `r` = existing record or prefill values.
export function kindFields(kind, r = {}) {
    const date = input('date', t('date'), r.date || todayISO(), `type="date" required max="${todayISO()}"`);
    switch (kind) {
        case 'crop_review':
            return `${date}${healthRadios(r.health)}
                <div class="form-row">${select('stage', 'Growth stage', GROWTH_STAGES, r.stage || 'Vegetative')}${select('irrigation', 'Water / irrigation', IRRIGATION, r.irrigation || 'Rain-fed')}</div>
                ${chips('issues', CROP_ISSUES, r.issues || [], 'Issues seen this week')}
                <div class="form-grid-3">${input('fertilizer', 'Fertilizer applied (optional)', r.fertilizer || '', 'placeholder="e.g. NPK 15:15:15"')}${input('fertilizerQty', 'Quantity', r.fertilizerQty || '', 'type="number" min="0" step="any"')}${select('fertilizerUnit', 'Unit', ['kg', 'bags (50kg)', 'litres', 'g'], r.fertilizerUnit || 'kg')}</div>
                ${textarea('notes', t('notes'), r.notes, 'What did you notice this week?')}`;
        case 'livestock_review':
            return `${date}${healthRadios(r.health)}
                <div class="form-grid-3">${input('headCount', 'Head count now', r.headCount ?? '', 'type="number" min="0"')}${input('births', 'Births / new stock', r.births ?? 0, 'type="number" min="0"')}${input('deaths', 'Deaths', r.deaths ?? 0, 'type="number" min="0"')}</div>
                <div class="form-grid-3">${input('sold', 'Sold', r.sold ?? 0, 'type="number" min="0"')}${input('feed', 'Feed type', r.feed || '', 'placeholder="e.g. Layer mash"')}${input('feedKg', 'Feed per day (kg)', r.feedKg ?? '', 'type="number" min="0" step="any"')}</div>
                <div class="form-row">${input('production', 'Production (optional)', r.production ?? '', 'type="number" min="0" step="any" placeholder="eggs, litres..."')}${select('productionUnit', 'Unit', ['eggs/day', 'litres/day', 'kg', 'none'], r.productionUnit || 'eggs/day')}</div>
                ${chips('symptoms', LIVESTOCK_SYMPTOMS, r.symptoms || [], 'Symptoms seen this week')}
                ${input('treatment', 'Treatment / vaccination given (optional)', r.treatment || '')}
                ${textarea('notes', t('notes'), r.notes, 'Anything else worth recording?')}`;
        case 'fertilizer':
            return `${date}<div class="form-grid-3">${input('product', 'Fertilizer / product', r.product || '', 'required placeholder="e.g. Urea"')}${input('quantity', 'Quantity', r.quantity || '', 'type="number" min="0" step="any"')}${select('unit', 'Unit', ['kg', 'bags (50kg)', 'litres', 'g'], r.unit || 'kg')}</div>
                ${select('method', 'Method', ['Broadcast', 'Side dressing', 'Foliar spray', 'Fertigation', 'Basal (at planting)'], r.method || 'Side dressing')}
                ${textarea('notes', t('notes'), r.notes)}`;
        case 'treatment':
            return `${date}<div class="form-row">${input('product', 'Product / vaccine', r.product || '', 'required')}${input('dose', 'Dose', r.dose || '')}</div>
                ${input('reason', 'Reason', r.reason || '', 'placeholder="e.g. Newcastle vaccine, fungicide for blight"')}
                ${textarea('notes', t('notes'), r.notes)}`;
        case 'harvest':
            return `${date}<div class="form-grid-3">${input('quantity', 'Quantity', r.quantity || '', 'type="number" min="0" step="any" required')}${select('unit', 'Unit', ['kg', 'bags', 'tonnes', 'crates', 'eggs', 'litres', 'heads'], r.unit || 'kg')}${select('quality', 'Quality', ['Excellent', 'Good', 'Fair', 'Poor'], r.quality || 'Good')}</div>
                ${textarea('notes', t('notes'), r.notes)}`;
        case 'observation':
            return `${date}${input('title', 'Title', r.title || '', 'required placeholder="e.g. Fence repaired, new borehole"')}${textarea('notes', t('notes'), r.notes)}`;
        default:
            return date;
    }
}

export function bindFormUI(root) {
    root.querySelectorAll('.radio-group').forEach((group) => {
        group.addEventListener('change', () => group.querySelectorAll('.radio-label').forEach((l) => l.classList.toggle('active', l.querySelector('input').checked)));
    });
    root.querySelectorAll('[data-chips] .chip').forEach((chip) => chip.addEventListener('click', () => chip.classList.toggle('active')));
}

export function readForm(root) {
    const data = {};
    root.querySelectorAll('[data-field]').forEach((el) => {
        if (el.type === 'radio') {
            if (el.checked) data[el.dataset.field] = el.value;
        } else data[el.dataset.field] = el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value.trim();
    });
    root.querySelectorAll('[data-chips]').forEach((g) => {
        data[g.dataset.chips] = [...g.querySelectorAll('.chip.active')].map((c) => c.dataset.value);
    });
    return data;
}

// Persist a record and roll relevant values up to the crop / livestock item.
export function saveRecord(kind, form, existingId = null) {
    const data = readForm(form);
    let itemType = 'farm', itemId = null, itemName = 'Whole farm';
    const pick = data.item ?? '';
    delete data.item;
    if (pick) {
        [itemType, itemId] = pick.split(':');
        itemId = itemId || null;
        const item = itemId ? db.get(itemId) : null;
        itemName = item ? (item.name || item.type) : 'Whole farm';
    } else if (RECORD_KINDS[kind].itemType !== 'any') {
        throw new Error(`Please add a ${RECORD_KINDS[kind].itemType} first.`);
    }
    if (!data.date) throw new Error('Please choose a date.');

    const record = db.put('record', { ...data, kind, itemType, itemId, itemName, week: isoWeek(data.date) }, { id: existingId || undefined });

    if (itemId && kind === 'crop_review') db.patch(itemId, { health: data.health, stage: data.stage, irrigation: data.irrigation });
    if (itemId && kind === 'livestock_review') {
        const changes = { health: data.health };
        if (data.headCount !== '' && data.headCount != null) changes.count = data.headCount;
        db.patch(itemId, changes);
    }
    if (itemId && kind === 'harvest' && itemType === 'crop') db.patch(itemId, { stage: 'Harvested' });
    return record;
}
