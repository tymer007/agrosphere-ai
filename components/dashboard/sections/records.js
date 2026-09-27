// Weekly Records: every entry from every page in one filterable, searchable table.
import { db } from '../../../js/store.js';
import { esc, fmtDate, toast } from '../../../js/ui.js';
import { t } from '../../../js/i18n.js';
import { RECORD_KINDS, healthBadge, healthLabel } from '../../../js/catalog.js';
import { kindLabel, describeRecord } from '../../../js/records.js';
import { showDiagnosis } from '../diagnosis-popup.js';

const filters = { q: '', kind: '', item: '', health: '', from: '', to: '', sort: 'newest' };

export default {
    id: 'records',
    icon: 'fa-clipboard-list',
    titleKey: 'weekly_records',
    subKey: 'sub_records',

    render(root, app) {
        const records = db.list('record');
        const items = [...new Map(records.filter((r) => r.itemName).map((r) => [r.itemId || 'farm', r.itemName])).entries()];

        root.innerHTML = `
        <div class="glass-card">
            <div class="records-toolbar">
                <div class="search-box"><i class="fas fa-search"></i><input type="text" id="recordSearch" placeholder="${t('search_records')}" value="${esc(filters.q)}"></div>
                <div class="filter-row">
                    <select class="form-select" data-filter="kind"><option value="">All types</option>${Object.entries(RECORD_KINDS).map(([k, v]) => `<option value="${k}" ${filters.kind === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
                    <select class="form-select" data-filter="item"><option value="">All items</option>${items.map(([id, name]) => `<option value="${esc(id)}" ${filters.item === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>
                    <select class="form-select" data-filter="health"><option value="">Any health</option>${['excellent', 'good', 'average', 'sick'].map((h) => `<option value="${h}" ${filters.health === h ? 'selected' : ''}>${t(h)}</option>`).join('')}</select>
                    <label class="date-filter"><span>From</span><input type="date" class="form-input" data-filter="from" value="${filters.from}"></label>
                    <label class="date-filter"><span>To</span><input type="date" class="form-input" data-filter="to" value="${filters.to}"></label>
                    <select class="form-select" data-filter="sort"><option value="newest">Newest first</option><option value="oldest" ${filters.sort === 'oldest' ? 'selected' : ''}>Oldest first</option></select>
                    <button class="btn btn-glass" id="clearFilters"><i class="fas fa-times"></i> Clear</button>
                </div>
                <div class="records-count" id="recordsCount"></div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>${t('date')}</th><th>${t('week')}</th><th>${t('type')}</th><th>${t('name')}</th><th>${t('health')}</th><th>${t('details')}</th><th>${t('actions')}</th></tr></thead>
                    <tbody id="recordsTableBody"></tbody>
                </table>
            </div>
            <div id="recordsEmpty" class="empty-state hidden">
                <i class="fas fa-clipboard-list"></i>
                <h3>${t('no_records')}</h3>
                <p id="emptyText">${t('start_tracking')}</p>
                <button class="btn btn-primary" id="emptyAdd"><i class="fas fa-plus"></i> ${t('add_record')}</button>
            </div>
        </div>`;

        const draw = () => {
            const q = filters.q.toLowerCase();
            let rows = records.filter((r) =>
                (!filters.kind || r.kind === filters.kind) &&
                (!filters.item || (r.itemId || 'farm') === filters.item) &&
                (!filters.health || r.health === filters.health) &&
                (!filters.from || r.date >= filters.from) &&
                (!filters.to || r.date <= filters.to) &&
                (!q || [r.itemName, kindLabel(r.kind), describeRecord(r), r.date, r.health, `week ${r.week}`].join(' ').toLowerCase().includes(q))
            );
            rows.sort((a, b) => (filters.sort === 'oldest' ? 1 : -1) * ((a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '')));

            root.querySelector('#recordsCount').textContent = `${rows.length} of ${records.length} record(s)`;
            root.querySelector('#recordsEmpty').classList.toggle('hidden', rows.length > 0);
            root.querySelector('.table-container').classList.toggle('hidden', rows.length === 0);
            root.querySelector('#emptyText').textContent = records.length ? 'No records match these filters.' : t('start_tracking');

            root.querySelector('#recordsTableBody').innerHTML = rows.map((r) => `
                <tr>
                    <td>${fmtDate(r.date)}</td>
                    <td>${t('week')} ${r.week || '-'}</td>
                    <td><span class="badge badge-${RECORD_KINDS[r.kind]?.badge || 'info'}"><i class="fas ${RECORD_KINDS[r.kind]?.icon || 'fa-file'}"></i> ${esc(kindLabel(r.kind))}</span></td>
                    <td>${esc(r.itemName || '-')}</td>
                    <td>${r.health ? `<span class="badge badge-${healthBadge(r.health)}">${esc(healthLabel(r.health))}</span>` : '-'}</td>
                    <td class="details-cell">${esc(describeRecord(r))}</td>
                    <td class="actions-cell">
                        ${r.kind === 'diagnosis'
                            ? `<button class="btn btn-primary btn-sm" data-view="${r.id}" title="View"><i class="fas fa-eye"></i></button>`
                            : `<button class="btn btn-primary btn-sm" data-edit="${r.id}" title="Edit"><i class="fas fa-edit"></i></button>`}
                        <button class="btn btn-danger btn-sm" data-del="${r.id}" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('');
        };

        root.querySelector('#recordSearch').addEventListener('input', (e) => { filters.q = e.target.value; draw(); });
        root.querySelectorAll('[data-filter]').forEach((el) => el.addEventListener('change', () => { filters[el.dataset.filter] = el.value; draw(); }));
        root.querySelector('#clearFilters').addEventListener('click', () => {
            Object.assign(filters, { q: '', kind: '', item: '', health: '', from: '', to: '', sort: 'newest' });
            app.refresh();
        });
        root.querySelector('#emptyAdd').addEventListener('click', () => app.openRecord({}));
        root.querySelector('#recordsTableBody').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.dataset.edit) app.openRecord({ recordId: btn.dataset.edit });
            if (btn.dataset.view) showDiagnosis(db.get(btn.dataset.view));
            if (btn.dataset.del && confirm('Delete this record?')) {
                db.remove(btn.dataset.del);
                toast('Record deleted');
                app.refresh();
            }
        });
        draw();
    }
};
