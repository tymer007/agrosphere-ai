// Settings: profile & plan, appearance (theme + language), data export, clear data.
import { db } from '../../../js/store.js';
import { currentUser, updateUser, verifyPassword, logout } from '../../../js/auth.js';
import { esc, toast, initials, fmtDate } from '../../../js/ui.js';
import { t } from '../../../js/i18n.js';
import { getThemePref, setThemePref } from '../../../js/theme.js';
import { quota } from '../../../js/ai.js';
import { CONFIG } from '../../../js/config.js';

const FARM_DATA_TYPES = ['crop', 'livestock', 'record', 'analysis', 'chat_memory'];

export default {
    id: 'settings',
    icon: 'fa-cog',
    titleKey: 'settings',
    subKey: 'sub_settings',

    render(root, app) {
        const user = currentUser();
        const profile = db.one('profile') || {};
        const farm = db.one('farm') || {};
        const isDemo = user.plan === 'demo';
        const plan = CONFIG.PLANS[user.plan] || CONFIG.PLANS.free;
        const pref = getThemePref();
        const usage = ['chat', 'analysis', 'diagnosis'].map((k) => [k, quota.used(k), quota.limit(k)]);

        root.innerHTML = `
        <div class="settings-grid">
            <div class="glass-card">
                <h3 class="section-title"><i class="fas fa-user"></i> ${t('profile')}</h3>
                <div class="profile-head">
                    <div class="user-avatar lg">${esc(initials(user.fullName))}</div>
                    <div><strong>${esc(user.fullName)}</strong><span>${esc(user.email)}</span><span>@${esc(user.username)} · member since ${fmtDate(user.createdAt)}</span></div>
                </div>
                <form id="profileForm" novalidate>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Full name</label><input class="form-input" name="fullName" value="${esc(user.fullName)}" required></div>
                        <div class="form-group"><label class="form-label">Phone</label><input class="form-input" name="phone" value="${esc(profile.phone || '')}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Farm name</label><input class="form-input" name="farmName" value="${esc(profile.farmName || '')}"></div>
                        <div class="form-group"><label class="form-label">Farm location</label><input class="form-input" value="${esc(farm.location?.address || [profile.city, profile.state, profile.country].filter(Boolean).join(', '))}" disabled></div>
                    </div>
                    <div class="settings-actions">
                        <button class="btn btn-primary" type="submit"><i class="fas fa-save"></i> Save profile</button>
                        <a class="btn btn-glass" href="/onboarding?edit=map"><i class="fas fa-map-marked-alt"></i> Edit farm map</a>
                    </div>
                </form>
            </div>

            <div class="glass-card plan-card">
                <h3 class="section-title"><i class="fas fa-gem"></i> ${t('your_plan')}</h3>
                <div class="plan-current">
                    <span class="plan-pill big">${esc(plan.name)}</span>
                    <p>${isDemo ? 'You are using the demo account. Data stays on this device.' : 'Free while Agrosphere AI is in its testing phase.'}</p>
                </div>
                <h4 class="sub-h">AI usage today</h4>
                <div class="usage-list">${usage.map(([k, used, limit]) => `
                    <div class="usage-row"><span>${{ chat: 'AI chat messages', analysis: 'Overview analyses', diagnosis: 'Plant diagnosis' }[k]}</span>
                        <div class="usage-bar"><i style="width:${Math.min(100, (used / limit) * 100)}%"></i></div><em>${used}/${limit}</em></div>`).join('')}
                </div>
                <p class="muted small">Limits reset daily and apply to this device and account.</p>
                <button class="btn btn-primary btn-disabled" disabled title="${t('coming_soon')}"><i class="fas fa-arrow-up"></i> ${t('upgrade_plan')} · ${t('coming_soon')}</button>
            </div>

            <div class="glass-card">
                <h3 class="section-title"><i class="fas fa-palette"></i> ${t('appearance')}</h3>
                <div class="form-group">
                    <label class="form-label">Default ${t('theme').toLowerCase()}</label>
                    <div class="radio-group" id="themePref">
                        ${[['system', 'fa-desktop', 'System'], ['light', 'fa-sun', 'Light'], ['dark', 'fa-moon', 'Dark']].map(([v, i, l]) => `
                        <label class="radio-label ${pref === v ? 'active' : ''}"><input type="radio" name="themePref" value="${v}" ${pref === v ? 'checked' : ''}><i class="fas ${i}"></i> <span>${l}</span></label>`).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${t('language')}</label>
                    <agro-lang-switcher variant="inline"></agro-lang-switcher>
                </div>
            </div>

            <div class="glass-card">
                <h3 class="section-title"><i class="fas fa-database"></i> ${t('data_management')}</h3>
                <p class="muted">Download everything Agrosphere AI holds for your farm: an Excel workbook, a PDF report and the raw data, bundled in one ZIP.</p>
                <div class="settings-actions">
                    <button class="btn btn-primary" id="exportAll"><i class="fas fa-file-archive"></i> ${t('export_your_data')}</button>
                    <button class="btn btn-glass" id="exportPdf"><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="btn btn-glass" id="exportXlsx"><i class="fas fa-file-excel"></i> Excel</button>
                </div>
                <div class="danger-zone">
                    <label class="form-label">${t('danger_zone')}</label>
                    <p class="muted small">Deletes all crops, livestock, records, diagnoses and AI history. Your account and profile are kept.</p>
                    <button class="btn btn-danger" id="clearData"><i class="fas fa-trash"></i> ${t('clear_all_data')}</button>
                </div>
                <button class="btn btn-glass" id="logoutBtn" style="margin-top:18px"><i class="fas fa-sign-out-alt"></i> ${t('logout')}</button>
            </div>
        </div>`;

        root.querySelector('#profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = e.target;
            if (!f.fullName.value.trim()) return toast('Name cannot be empty', 'warning');
            updateUser({ fullName: f.fullName.value.trim() });
            db.setOne('profile', { phone: f.phone.value.trim(), farmName: f.farmName.value.trim() });
            toast('Profile saved');
            app.refresh();
        });

        root.querySelectorAll('#themePref input').forEach((r) => r.addEventListener('change', () => {
            setThemePref(r.value);
            root.querySelectorAll('#themePref .radio-label').forEach((l) => l.classList.toggle('active', l.querySelector('input').checked));
            toast(`Theme set to ${r.value}`);
        }));

        const runExport = (fn) => async (e) => {
            const btn = e.currentTarget;
            const html = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
            try {
                const mod = await import('../../../js/export.js');
                await mod[fn]();
                toast('Download started');
            } catch (err) {
                toast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = html;
            }
        };
        root.querySelector('#exportAll').addEventListener('click', runExport('exportAll'));
        root.querySelector('#exportPdf').addEventListener('click', runExport('exportPdf'));
        root.querySelector('#exportXlsx').addEventListener('click', runExport('exportExcel'));
        root.querySelector('#logoutBtn').addEventListener('click', logout);
        root.querySelector('#clearData').addEventListener('click', () => confirmClear(app));
    }
};

function confirmClear(app) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
    <div class="modal" style="max-width:460px">
        <div class="modal-header"><h3 class="modal-title" style="color:#ef4444"><i class="fas fa-exclamation-triangle"></i> ${t('clear_all_data')}</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>
        <div class="modal-body">
            <p style="margin-bottom:16px">This permanently deletes all your farm data. Consider using <strong>${t('export_your_data')}</strong> first.</p>
            <div class="form-group"><label class="form-label">Enter your password to confirm</label><input class="form-input" type="password" autocomplete="current-password"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-glass" data-close>${t('cancel')}</button><button class="btn btn-danger" data-confirm><i class="fas fa-trash"></i> Delete everything</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    const pw = overlay.querySelector('input');
    pw.focus();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelector('[data-confirm]').addEventListener('click', async () => {
        if (!(await verifyPassword(pw.value))) {
            pw.value = '';
            return toast('Incorrect password', 'error');
        }
        db.clearTypes(FARM_DATA_TYPES);
        localStorage.removeItem('agro_chat_seeded');
        close();
        toast('All farm data cleared');
        app.refresh();
    });
}
