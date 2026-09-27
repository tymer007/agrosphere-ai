// Profit & Loss - coming soon (revenue/profit is removed across the app for now).
import { t } from '../../../js/i18n.js';

export default {
    id: 'finance',
    icon: 'fa-chart-line',
    titleKey: 'profit_loss',
    subKey: 'sub_finance',
    soon: true,

    render(root) {
        root.innerHTML = `
        <div class="glass-card coming-soon-card large">
            <div class="soon-body">
                <i class="fas fa-chart-line"></i>
                <strong>${t('profit_loss')} - ${t('coming_soon')}</strong>
                <p>We're building revenue, expenses and profit tracking for your farm. Keep recording harvests and inputs - they will feed straight into it.</p>
                <ul class="soon-list">
                    <li><i class="fas fa-check"></i> Income from harvest & produce sales</li>
                    <li><i class="fas fa-check"></i> Input costs: seed, fertilizer, feed, labour</li>
                    <li><i class="fas fa-check"></i> Profit per crop and per livestock group</li>
                </ul>
            </div>
        </div>`;
    }
};
