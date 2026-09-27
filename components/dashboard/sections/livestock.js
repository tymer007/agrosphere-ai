// Livestock: action bar + inventory & weekly health report.
// Each group's card shows its recent treatments and production records.
import { t } from '../../../js/i18n.js';
import { livestockInsights } from '../../../js/insights.js';
import { renderInventoryPage } from '../inventory-page.js';
import { db } from '../../../js/store.js';
import { toast } from '../../../js/ui.js';

const VAX = { yes: 'vaccinated', partial: 'partly vaccinated', no: 'not vaccinated' };

const cfg = {
    kind: 'livestock',
    reviewKind: 'livestock_review',
    icon: 'fa-cow',
    addLabel: 'Add Livestock',
    emptyText: 'Add your animal groups (e.g. 300 layers, 14 goats) to start tracking them.',
    label: (l) => l.type,
    meta: (l) => [`${l.count || 0} head`, l.avgAgeMonths && `~${l.avgAgeMonths} months`, l.purpose, l.housing, VAX[l.vaccinated]].filter(Boolean),
    insights: livestockInsights,
    logKinds: ['treatment', 'harvest']
};

export default {
    id: 'livestock',
    icon: 'fa-cow',
    titleKey: 'livestock',
    subKey: 'sub_livestock',
    recordScope: 'livestock',

    render(root, app) {
        renderInventoryPage(root, app, cfg, {
            top: `
            <div class="page-actions">
                <button class="action-tile disabled" data-action="soon" title="${t('coming_soon')}">
                    <span class="action-icon badge-danger"><i class="fas fa-microscope"></i></span>
                    <span><strong>AI Animal Diagnosis</strong><small>Photo diagnosis for sick animals</small></span>
                    <em class="soon-tag">${t('coming_soon')}</em>
                </button>
                <button class="action-tile" data-action="treatment">
                    <span class="action-icon badge-warning"><i class="fas fa-syringe"></i></span>
                    <span><strong>Log treatment</strong><small>Medicine, deworming or vaccination</small></span>
                </button>
            </div>`
        });
        root.querySelector('[data-action=soon]').addEventListener('click', () => toast('Animal diagnosis is coming soon', 'info'));
        root.querySelector('[data-action=treatment]').addEventListener('click', () => {
            if (!db.list('livestock').length) return toast('Add a livestock group first', 'warning');
            app.openRecord({ kind: 'treatment' });
        });
    }
};
