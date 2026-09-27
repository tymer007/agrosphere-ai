// Split page used by Crops and Livestock: inventory on one side, weekly report on the other.
import { db } from '../../js/store.js';
import { esc, fmtDate, toast, daysBetween, startOfWeek, todayISO } from '../../js/ui.js';
import { t } from '../../js/i18n.js';
import { healthBadge, healthLabel } from '../../js/catalog.js';
import { kindFields, bindFormUI, saveRecord } from './fields.js';
import { cropFormHTML, livestockFormHTML, bindItemForm, readItemForm } from './item-forms.js';
import { showRecordDetail } from './record-detail.js';
import { RECORD_KINDS } from '../../js/catalog.js';
import { describeRecord } from '../../js/records.js';

const selected = { crop: null, livestock: null };

// `top` = action bar HTML above the split layout. Each item card shows its recent log
// (cfg.logKinds, e.g. diagnoses + fertilizer for crops); clicking an entry shows its details.
export function renderInventoryPage(root, app, cfg, { top = '' } = {}) {
    const items = db.list(cfg.kind).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const records = db.list('record').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const reviewsFor = (id) => records.filter((r) => r.itemId === id && r.kind === cfg.reviewKind);
    const weekStart = startOfWeek().toISOString().slice(0, 10);
    const doneThisWeek = (id) => reviewsFor(id).some((r) => r.date >= weekStart);
    if (!items.find((i) => i.id === selected[cfg.kind])) selected[cfg.kind] = (items.find((i) => !doneThisWeek(i.id)) || items[0])?.id || null;
    const current = items.find((i) => i.id === selected[cfg.kind]);
    const done = items.filter((i) => doneThisWeek(i.id)).length;

    const logFor = (id) => records.filter((r) => r.itemId === id && (cfg.logKinds || []).includes(r.kind)).slice(0, 3);

    root.innerHTML = `
    ${top}
    <div class="split-grid">
        <div class="glass-card inventory-panel">
            <div class="panel-head">
                <h3 class="section-title"><i class="fas fa-warehouse"></i> ${t('inventory')} <span class="count-pill">${items.length}</span></h3>
                <button class="btn btn-primary btn-sm" data-add><i class="fas fa-plus"></i> ${cfg.addLabel}</button>
            </div>
            <div class="inventory-list">
                ${items.length ? items.map((i) => itemCard(i, cfg, reviewsFor(i.id)[0], doneThisWeek(i.id), logFor(i.id))).join('') : `
                <div class="empty-state small"><i class="fas ${cfg.icon}"></i><h3>Nothing here yet</h3><p>${cfg.emptyText}</p></div>`}
            </div>
        </div>

        <div class="glass-card report-panel">
            <div class="panel-head">
                <h3 class="section-title"><i class="fas fa-clipboard-check"></i> ${t('weekly_report')}</h3>
                <span class="week-progress ${items.length && done === items.length ? 'complete' : ''}">${done}/${items.length} reviewed this week</span>
            </div>
            ${items.length ? `
            <div class="item-pills">${items.map((i) => `
                <button class="item-pill ${i.id === selected[cfg.kind] ? 'active' : ''}" data-select="${i.id}">
                    <i class="fas ${doneThisWeek(i.id) ? 'fa-check-circle done' : 'fa-circle due'}"></i> ${esc(cfg.label(i))}
                </button>`).join('')}</div>
            <div class="report-body">
                <form class="report-form" novalidate>
                    ${reportIntro(current, reviewsFor(current.id)[0], doneThisWeek(current.id))}
                    ${kindFields(cfg.reviewKind, prefill(current, reviewsFor(current.id)[0], cfg))}
                    <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center"><i class="fas fa-save"></i> Save weekly review</button>
                </form>
                <aside class="insight-panel">
                    <h4><i class="fas fa-robot"></i> Agro AI insights</h4>
                    ${cfg.insights(current, reviewsFor(current.id)).map((tip) => `<div class="insight tone-${tip.tone}"><i class="fas ${tip.icon}"></i><span>${esc(tip.text)}</span></div>`).join('')}
                </aside>
            </div>` : `<div class="empty-state small"><i class="fas fa-clipboard"></i><h3>No ${cfg.kind} to review</h3><p>Add ${cfg.kind === 'crop' ? 'a crop' : 'a livestock group'} to your inventory to start weekly reporting.</p></div>`}
        </div>
    </div>`;

    root.querySelector('[data-add]').addEventListener('click', () => openItemModal(cfg, null, app));
    root.querySelectorAll('[data-select]').forEach((b) => b.addEventListener('click', () => {
        selected[cfg.kind] = b.dataset.select;
        app.refresh();
    }));
    root.querySelector('.inventory-list').addEventListener('click', (e) => {
        const logEntry = e.target.closest('[data-log]');
        if (logEntry) return showRecordDetail(db.get(logEntry.dataset.log), { onEdit: (r) => app.openRecord({ recordId: r.id }) });
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.edit) openItemModal(cfg, db.get(b.dataset.edit), app);
        if (b.dataset.review) {
            selected[cfg.kind] = b.dataset.review;
            app.refresh();
            requestAnimationFrame(() => root.querySelector('.report-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
        if (b.dataset.del && confirm(`Delete ${b.dataset.name}? Its past records stay in Weekly Records.`)) {
            db.remove(b.dataset.del);
            toast('Removed from inventory');
            app.refresh();
        }
    });

    const form = root.querySelector('.report-form');
    if (form) {
        bindFormUI(form);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.dataset.field = 'item';
            hidden.value = `${cfg.kind}:${current.id}`;
            form.appendChild(hidden);
            try {
                saveRecord(cfg.reviewKind, form);
                toast(`Weekly review saved for ${cfg.label(current)}`);
                const next = items.find((i) => i.id !== current.id && !doneThisWeek(i.id));
                if (next) selected[cfg.kind] = next.id;
                app.refresh();
            } catch (err) {
                hidden.remove();
                toast(err.message, 'error');
            }
        });
    }
}

function itemCard(i, cfg, lastReview, done, log = []) {
    return `
    <div class="inv-card">
        <div class="inv-top">
            <div><h4>${esc(cfg.label(i))} ${i.variety || i.breed ? `<small>(${esc(i.variety || i.breed)})</small>` : ''}</h4>
                <p class="inv-meta">${cfg.meta(i).map(esc).join(' · ')}</p></div>
            <span class="badge badge-${healthBadge(i.health)}">${esc(healthLabel(i.health))}</span>
        </div>
        ${log.length ? `<ul class="inv-log">${log.map((r) => `
            <li data-log="${r.id}" title="View details"><i class="fas ${RECORD_KINDS[r.kind]?.icon || 'fa-file'} kind-${r.kind}"></i>
                <span>${esc(describeRecord(r))}</span><small>${fmtDate(r.date, { day: 'numeric', month: 'short' })}</small><i class="fas fa-chevron-right"></i></li>`).join('')}</ul>` : ''}
        <div class="inv-foot">
            <span class="${done ? 'ok' : 'due'}"><i class="fas ${done ? 'fa-check-circle' : 'fa-clock'}"></i> ${done ? 'Reviewed this week' : lastReview ? `Last review ${fmtDate(lastReview.date)}` : 'Never reviewed'}</span>
            <div class="inv-actions">
                <button class="btn btn-glass btn-sm" data-review="${i.id}" title="Weekly review"><i class="fas fa-clipboard-check"></i></button>
                <button class="btn btn-glass btn-sm" data-edit="${i.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" data-del="${i.id}" data-name="${esc(cfg.label(i))}" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    </div>`;
}

function reportIntro(item, last, done) {
    return `<div class="report-intro">
        <strong>${esc(item.name || item.type)}</strong>
        <span>${done ? '<i class="fas fa-check-circle"></i> Already reviewed this week - saving adds another entry.' : last ? `Last review ${fmtDate(last.date)}. Values are pre-filled from it - just update what changed.` : 'First review - takes under a minute.'}</span>
    </div>`;
}

// Pre-fill this week's form from last week's review so reporting is quick.
function prefill(item, last, cfg) {
    const base = { date: todayISO(), health: item.health };
    if (cfg.kind === 'crop') return { ...base, stage: last?.stage || item.stage, irrigation: last?.irrigation || item.irrigation, issues: last?.issues || [] };
    return { ...base, headCount: item.count, feed: last?.feed || '', feedKg: last?.feedKg ?? '', productionUnit: last?.productionUnit || (/layers/i.test(item.type) ? 'eggs/day' : 'none'), births: 0, deaths: 0, sold: 0 };
}

export function openItemModal(cfg, item, app) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
    <div class="modal">
        <div class="modal-header"><h3 class="modal-title"><i class="fas ${cfg.icon}" style="color:var(--primary)"></i> ${item ? 'Edit' : cfg.addLabel}</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>
        <div class="modal-body"><form novalidate>${cfg.kind === 'crop' ? cropFormHTML(item || {}) : livestockFormHTML(item || {})}
            <div class="form-group"><label class="form-label">${t('notes')}</label><textarea class="form-textarea" data-field="notes">${esc(item?.notes || '')}</textarea></div></form></div>
        <div class="modal-footer"><button class="btn btn-glass" data-close>${t('cancel')}</button><button class="btn btn-primary" data-save><i class="fas fa-save"></i> ${t('save')}</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form');
    bindItemForm(form);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => e.target === overlay && close());
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelector('[data-save]').addEventListener('click', () => {
        try {
            const data = readItemForm(form, cfg.kind);
            const saved = db.put(cfg.kind, { ...(item || {}), ...data }, { id: item?.id });
            selected[cfg.kind] = saved.id;
            toast(item ? 'Saved' : `${cfg.label(saved)} added to inventory`);
            close();
            app.refresh();
        } catch (err) {
            toast(err.message, 'error');
        }
    });
}

export function harvestText(c) {
    if (!c.harvestDate) return null;
    const d = daysBetween(c.harvestDate);
    return d > 0 ? `harvest in ${d}d` : d === 0 ? 'harvest today' : `harvest ${-d}d overdue`;
}
