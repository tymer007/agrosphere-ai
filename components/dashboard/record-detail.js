// Popup with the full details of one record (fertilizer, treatment, review...).
import { esc, fmtDate } from '../../js/ui.js';
import { RECORD_KINDS, healthBadge, healthLabel } from '../../js/catalog.js';
import { kindLabel } from '../../js/records.js';
import { showDiagnosis } from './diagnosis-popup.js';

const FIELDS = {
    crop_review: [['stage', 'Growth stage'], ['irrigation', 'Water / irrigation'], ['issues', 'Issues seen'], ['fertilizer', 'Fertilizer applied'], ['fertilizerQty', 'Quantity', 'fertilizerUnit']],
    livestock_review: [['headCount', 'Head count'], ['births', 'Births / new stock'], ['deaths', 'Deaths'], ['sold', 'Sold'], ['feed', 'Feed type'], ['feedKg', 'Feed per day (kg)'], ['production', 'Production', 'productionUnit'], ['symptoms', 'Symptoms'], ['treatment', 'Treatment given']],
    fertilizer: [['product', 'Product'], ['quantity', 'Quantity', 'unit'], ['method', 'Method']],
    treatment: [['product', 'Product / vaccine'], ['dose', 'Dose'], ['reason', 'Reason']],
    harvest: [['quantity', 'Quantity', 'unit'], ['quality', 'Quality']],
    observation: [['title', 'Title']]
};

export function showRecordDetail(record, { onEdit } = {}) {
    if (!record) return;
    if (record.kind === 'diagnosis') return showDiagnosis(record);
    const meta = RECORD_KINDS[record.kind] || {};
    const rows = (FIELDS[record.kind] || [])
        .map(([key, label, unitKey]) => {
            let v = record[key];
            if (Array.isArray(v)) v = v.join(', ');
            if (v === '' || v == null || (Array.isArray(record[key]) && !record[key].length)) return '';
            if (unitKey && record[unitKey]) v = `${v} ${record[unitKey]}`;
            return `<div class="rd-row"><span>${esc(label)}</span><strong>${esc(v)}</strong></div>`;
        })
        .join('');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
        <div class="modal-header">
            <h3 class="modal-title"><i class="fas ${meta.icon || 'fa-file'}" style="color:var(--primary)"></i> ${esc(kindLabel(record.kind))}</h3>
            <button class="modal-close" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <div class="rd-head">
                <strong>${esc(record.itemName || 'Whole farm')}</strong>
                <span>${fmtDate(record.date)} · Week ${esc(record.week || '-')}</span>
                ${record.health ? `<span class="badge badge-${healthBadge(record.health)}">${esc(healthLabel(record.health))}</span>` : ''}
            </div>
            ${rows || '<p class="muted">No extra details recorded.</p>'}
            ${record.notes ? `<h4 class="dx-h">Notes</h4><p>${esc(record.notes)}</p>` : ''}
        </div>
        <div class="modal-footer">
            ${onEdit ? '<button class="btn btn-glass" data-edit><i class="fas fa-edit"></i> Edit</button>' : ''}
            <button class="btn btn-primary" data-ok>Close</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => e.target === overlay && close());
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('[data-ok]').addEventListener('click', close);
    overlay.querySelector('[data-edit]')?.addEventListener('click', () => {
        close();
        onEdit(record);
    });
}
