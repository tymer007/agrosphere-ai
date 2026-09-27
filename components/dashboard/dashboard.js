// <agro-dashboard> - the dashboard shell. Each menu entry is a separate section module
// in ./sections/ that gets called to render into the main area.
import '../brand-logo.js';
import '../theme-toggle.js';
import '../lang-switcher.js';
import '../ai-chatbot.js';
import '../loader.js';
import { currentUser, logout, requireAuth } from '../../js/auth.js';
import { db, onChange } from '../../js/store.js';
import { applyI18n, t } from '../../js/i18n.js';
import { applyTheme } from '../../js/theme.js';
import { esc, initials, toast } from '../../js/ui.js';
import { CONFIG } from '../../js/config.js';
import { sync } from '../../js/sync.js';
import { openRecordModal } from './record-modal.js';

import overview from './sections/overview.js';
import records from './sections/records.js';
import crops from './sections/crops.js';
import livestock from './sections/livestock.js';
import finance from './sections/finance.js';
import settings from './sections/settings.js';

const SECTIONS = [overview, records, crops, livestock, finance, settings];
const LAST_KEY = 'agro_last_section';

class AgroDashboard extends HTMLElement {
    connectedCallback() {
        applyTheme();
        this.user = requireAuth({ onboarded: true });
        if (!this.user) return;

        this.innerHTML = `
        <agro-loader></agro-loader>
        <agro-theme-toggle></agro-theme-toggle>
        <agro-lang-switcher variant="floating"></agro-lang-switcher>

        <div class="app" id="app">
            <header class="mobile-header">
                <button class="menu-toggle" aria-label="Open menu"><i class="fas fa-bars"></i></button>
                <div class="mobile-brand">
                    <agro-logo size="42"></agro-logo>
                    <div class="mobile-brand-text"><h1>Agrosphere</h1><span data-i18n="ai_powered"></span></div>
                </div>
                <span class="mobile-header-spacer"></span>
            </header>

            <div class="sidebar-overlay"></div>

            <aside class="sidebar">
                <div class="brand">
                    <agro-logo size="52" extra-class="brand-float"></agro-logo>
                    <div class="brand-text"><h1>Agrosphere</h1><span data-i18n="ai_powered"></span></div>
                </div>
                <ul class="nav-menu">
                    ${SECTIONS.map((s) => `
                    <li class="nav-item"><a class="nav-link" href="#${s.id}" data-section="${s.id}">
                        <i class="fas ${s.icon}"></i> <span data-i18n="${s.titleKey}"></span>
                        ${s.soon ? `<span class="nav-soon" data-i18n="coming_soon"></span>` : ''}
                        ${s.id === 'records' ? `<span class="nav-badge" id="recordsBadge">0</span>` : ''}
                    </a></li>`).join('')}
                </ul>
                <div class="sidebar-user"></div>
            </aside>

            <main class="main-content">
                <div class="top-bar">
                    <div class="page-title"><h1 id="pageTitle"></h1><p id="pageSubtitle"></p></div>
                    <div class="top-actions">
                        <div class="export-menu">
                            <button class="btn btn-glass" id="exportBtn"><i class="fas fa-file-export"></i> <span data-i18n="export_report"></span> <i class="fas fa-chevron-down" style="font-size:.7rem"></i></button>
                            <div class="export-dropdown">
                                <button data-export="pdf30"><i class="fas fa-file-pdf"></i> PDF report - last 30 days</button>
                                <button data-export="pdfall"><i class="fas fa-file-pdf"></i> PDF report - all time</button>
                                <button data-export="xlsx"><i class="fas fa-file-excel"></i> Excel workbook</button>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="newRecordBtn"><i class="fas fa-plus"></i> <span data-i18n="new_record"></span></button>
                    </div>
                </div>
                <div id="sectionRoot"></div>
            </main>

            <agro-chatbot></agro-chatbot>
        </div>`;

        this.app = {
            t, toast,
            user: () => currentUser(),
            navigate: (id) => (location.hash = id),
            refresh: () => this.show(this.current, true),
            // Crop Health / Livestock pages only offer their own record options; other pages show all.
            openRecord: (opts) => openRecordModal({
                scope: SECTIONS.find((s) => s.id === this.current)?.recordScope || 'all',
                ...opts,
                onSaved: () => this.app.refresh()
            }),
            setSubtitle: (text) => (this.querySelector('#pageSubtitle').textContent = text)
        };

        window.addEventListener('agro:loaded', () => this.querySelector('#app')?.classList.add('loaded'), { once: true });
        this.bind();
        this.renderUser();
        applyI18n(this);
        this.show(this.initialSection());
        this.updateBadge();
        // Pull newer rows from the Excel sheet (other devices) and re-render if anything changed.
        const pull = () => sync.pull().then((changed) => changed && this.show(this.current, true));
        pull();
        // Coming back to the tab picks up changes made on other devices.
        this.onVisible = () => document.visibilityState === 'visible' && pull();
        document.addEventListener('visibilitychange', this.onVisible);

        this.offChange = onChange(() => this.updateBadge());
        this.onLang = () => { applyI18n(this); this.show(this.current, true); };
        window.addEventListener('agro:lang', this.onLang);
        window.addEventListener('hashchange', () => this.show(location.hash.slice(1)));
    }

    disconnectedCallback() {
        this.offChange?.();
        window.removeEventListener('agro:lang', this.onLang);
        document.removeEventListener('visibilitychange', this.onVisible);
    }

    initialSection() {
        const fromHash = location.hash.slice(1);
        if (SECTIONS.some((s) => s.id === fromHash)) return fromHash;
        return localStorage.getItem(LAST_KEY) || 'overview';
    }

    bind() {
        const sidebar = this.querySelector('.sidebar');
        const overlay = this.querySelector('.sidebar-overlay');
        const icon = this.querySelector('.menu-toggle i');
        const setOpen = (open) => {
            sidebar.classList.toggle('open', open);
            overlay.classList.toggle('active', open);
            icon.className = open ? 'fas fa-times' : 'fas fa-bars';
        };
        this.closeMenu = () => setOpen(false);
        this.querySelector('.menu-toggle').addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
        overlay.addEventListener('click', () => setOpen(false));

        this.querySelector('#newRecordBtn').addEventListener('click', () => this.app.openRecord({}));

        const menu = this.querySelector('.export-menu');
        this.querySelector('#exportBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('open');
        });
        document.addEventListener('click', () => menu.classList.remove('open'));
        menu.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', async () => {
            menu.classList.remove('open');
            const { exportPdf, exportExcel } = await import('../../js/export.js');
            try {
                toast('Preparing your export...', 'info');
                if (b.dataset.export === 'pdf30') await exportPdf(30);
                if (b.dataset.export === 'pdfall') await exportPdf(null);
                if (b.dataset.export === 'xlsx') await exportExcel(null);
                toast('Export downloaded');
            } catch (err) {
                toast(err.message, 'error');
            }
        }));
    }

    renderUser() {
        const u = currentUser();
        const plan = CONFIG.PLANS[u.plan]?.name || 'Free & Demo';
        this.querySelector('.sidebar-user').innerHTML = `
            <div class="user-card">
                <div class="user-avatar">${esc(initials(u.fullName))}</div>
                <div class="user-meta">
                    <strong>${esc(u.fullName)}</strong>
                    <span>${esc(u.email)}</span>
                    <em class="plan-pill">${esc(plan)}</em>
                </div>
            </div>
            <button class="nav-link logout-link"><i class="fas fa-sign-out-alt"></i> <span data-i18n="logout">${t('logout')}</span></button>`;
        this.querySelector('.logout-link').addEventListener('click', logout);
    }

    updateBadge() {
        const el = this.querySelector('#recordsBadge');
        if (el) el.textContent = db.list('record').length;
    }

    show(id, force = false) {
        const section = SECTIONS.find((s) => s.id === id) || SECTIONS[0];
        if (!force && this.current === section.id) return;
        this.cleanup?.();
        this.current = section.id;
        localStorage.setItem(LAST_KEY, section.id);
        if (location.hash.slice(1) !== section.id) history.replaceState(null, '', `#${section.id}`);

        this.querySelectorAll('.nav-link[data-section]').forEach((a) => a.classList.toggle('active', a.dataset.section === section.id));
        this.querySelector('#pageTitle').textContent = t(section.titleKey);
        this.querySelector('#pageSubtitle').textContent = t(section.subKey);
        const root = this.querySelector('#sectionRoot');
        root.innerHTML = '';
        root.className = `section-content section-${section.id}`;
        this.cleanup = section.render(root, this.app) || null;
        this.renderUser();
        this.closeMenu?.();
        if (!force) window.scrollTo({ top: 0 });
    }
}
customElements.define('agro-dashboard', AgroDashboard);
