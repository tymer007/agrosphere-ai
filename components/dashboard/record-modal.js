// "New Record" modal: first shows every record option, then the fields for the chosen one.
import { RECORD_KINDS } from '../../js/catalog.js';
import { db } from '../../js/store.js';
import { toast, esc } from '../../js/ui.js';
import { t } from '../../js/i18n.js';
import { itemSelect, kindFields, bindFormUI, saveRecord } from './fields.js';

// Record options per page: Crop Health and Livestock only offer their own kinds.
const SCOPES = {
    all: ['crop_review', 'livestock_review', 'fertilizer', 'treatment', 'harvest', 'observation'],
    crop: ['crop_review', 'fertilizer', 'treatment', 'harvest', 'observation'],
    livestock: ['livestock_review', 'treatment', 'harvest', 'observation']
};
const SCOPED_TEXT = {
    crop: { treatment: ['Spray / treatment', 'Pesticide, fungicide or other treatment on a crop'], harvest: ['Harvest', 'Record a crop harvest'], observation: ['Crop observation', 'Any other note about a crop'] },
    livestock: { treatment: ['Treatment / vaccination', 'Medicine, deworming or vaccination given'], harvest: ['Production / sales', 'Eggs, milk, animals sold...'], observation: ['Livestock observation', 'Any other note about your animals'] }
};
const DESCRIPTIONS = {
    crop_review: 'Weekly health, growth stage, issues and fertilizer for one crop',
    livestock_review: 'Weekly head count, health, feed and production for one group',
    fertilizer: 'Log a fertilizer or manure application',
    treatment: 'Spray, medicine or vaccination given',
    harvest: 'Record a harvest or production (eggs, milk...)',
    observation: 'Any other note about the farm'
};

let overlay;

function ensure() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3 class="modal-title"></h3><button class="modal-close" aria-label="Close"><i class="fas fa-times"></i></button></div><div class="modal-body"></div><div class="modal-footer"></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => e.target === overlay && close());
    overlay.querySelector('.modal-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    return overlay;
}

function close() {
    overlay?.classList.remove('active');
}

let scope = 'all';

export function openRecordModal({ kind = null, itemId = null, recordId = null, prefill = {}, onSaved, scope: pageScope = 'all' } = {}) {
    ensure();
    scope = SCOPES[pageScope] ? pageScope : 'all';
    const existing = recordId ? db.get(recordId) : null;
    if (existing) {
        kind = existing.kind;
        itemId = existing.itemId ? `${existing.itemType}:${existing.itemId}` : 'farm:';
    }
    if (kind === 'diagnosis') return;
    kind ? showForm(kind, itemId, existing || prefill, onSaved) : showPicker(onSaved);
    overlay.classList.add('active');
}

function showPicker(onSaved) {
    overlay.querySelector('.modal-title').textContent = scope === 'crop' ? 'New crop record' : scope === 'livestock' ? 'New livestock record' : t('new_record');
    overlay.querySelector('.modal-body').innerHTML = `
        <p class="modal-lead">What would you like to record?</p>
        <div class="kind-grid">
            ${SCOPES[scope].map((k) => {
                const [label, desc] = SCOPED_TEXT[scope]?.[k] || [RECORD_KINDS[k].label, DESCRIPTIONS[k]];
                return `
            <button type="button" class="kind-card" data-kind="${k}">
                <span class="kind-icon badge-${RECORD_KINDS[k].badge}"><i class="fas ${RECORD_KINDS[k].icon}"></i></span>
                <strong>${esc(label)}</strong>
                <small>${esc(desc)}</small>
            </button>`;
            }).join('')}
        </div>`;
    overlay.querySelector('.modal-footer').innerHTML = `<button class="btn btn-glass" data-close>${t('cancel')}</button>`;
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelectorAll('.kind-card').forEach((b) => b.addEventListener('click', () => showForm(b.dataset.kind, null, {}, onSaved, true)));
}

function showForm(kind, itemId, values, onSaved, fromPicker = false) {
    const meta = RECORD_KINDS[kind];
    const editing = !!values?.id;
    const label = SCOPED_TEXT[scope]?.[kind]?.[0] || meta.label;
    overlay.querySelector('.modal-title').innerHTML = `<i class="fas ${meta.icon}" style="color:var(--primary)"></i> ${editing ? 'Edit' : ''} ${esc(label)}`;
    overlay.querySelector('.modal-body').innerHTML = `<form class="record-form" novalidate>${itemSelect(kind, itemId || '', scope)}${kindFields(kind, values)}</form>`;
    overlay.querySelector('.modal-footer').innerHTML = `
        ${fromPicker ? `<button class="btn btn-glass" data-back style="margin-right:auto"><i class="fas fa-arrow-left"></i> Back</button>` : ''}
        <button class="btn btn-glass" data-close>${t('cancel')}</button>
        <button class="btn btn-primary" data-save><i class="fas fa-save"></i> ${t('save_record')}</button>`;
    const form = overlay.querySelector('form');
    bindFormUI(form);
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelector('[data-back]')?.addEventListener('click', () => showPicker(onSaved));
    overlay.querySelector('[data-save]').addEventListener('click', () => {
        const required = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
        if (required) {
            required.focus();
            return toast('Please fill in the required fields', 'warning');
        }
        try {
            saveRecord(kind, form, values?.id || null);
            toast(editing ? 'Record updated!' : 'Record added!');
            close();
            onSaved?.();
        } catch (err) {
            toast(err.message, 'error');
        }
    });
}
