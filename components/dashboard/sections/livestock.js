// Livestock: inventory + weekly health report.
import { t } from '../../../js/i18n.js';
import { livestockInsights } from '../../../js/insights.js';
import { renderInventoryPage } from '../inventory-page.js';
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
    insights: livestockInsights
};

export default {
    id: 'livestock',
    icon: 'fa-cow',
    titleKey: 'livestock',
    subKey: 'sub_livestock',

    render(root, app) {
        renderInventoryPage(root, app, cfg, `
        <div class="glass-card soon-strip" style="margin-top:24px" data-soon>
            <i class="fas fa-microscope"></i>
            <div><strong>AI Animal Diagnosis</strong><span>Upload a photo of a sick animal for AI advice.</span></div>
            <em class="soon-tag">${t('coming_soon')}</em>
        </div>`);
        root.querySelector('[data-soon]').addEventListener('click', () => toast('Animal diagnosis is coming soon', 'info'));
    }
};
