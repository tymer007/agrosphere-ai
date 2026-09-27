// <agro-lang-switcher variant="floating|inline"> - one language component used on the
// dashboard (floating, right side) and on the Settings page (inline).
import { LANGUAGES, getLang, setLang, t } from '../js/i18n.js';

class AgroLangSwitcher extends HTMLElement {
    connectedCallback() {
        const inline = this.getAttribute('variant') === 'inline';
        const options = LANGUAGES.map((l) => `
            <div class="lang-option" data-lang="${l.code}" role="button" tabindex="0">
                <span class="lang-flag ${l.code}">${l.code.toUpperCase()}</span>
                <span data-i18n="lang_${l.code}">${t('lang_' + l.code)}</span>
            </div>`).join('');

        this.innerHTML = inline
            ? `<div class="lang-inline">${options}</div>`
            : `<div class="lang-selector">
                   <button class="lang-btn" aria-label="Change language"><span class="current-lang">EN</span></button>
                   <div class="lang-dropdown">${options}</div>
               </div>`;

        const dropdown = this.querySelector('.lang-dropdown');
        this.querySelector('.lang-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        this.querySelectorAll('.lang-option').forEach((el) => {
            const pick = () => {
                setLang(el.dataset.lang);
                dropdown?.classList.remove('active');
            };
            el.addEventListener('click', pick);
            el.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
        });
        this.outside = (e) => { if (!this.contains(e.target)) dropdown?.classList.remove('active'); };
        document.addEventListener('click', this.outside);
        this.sync = () => {
            const lang = getLang();
            const cur = this.querySelector('.current-lang');
            if (cur) cur.textContent = lang.toUpperCase();
            this.querySelectorAll('.lang-option').forEach((el) => el.classList.toggle('active', el.dataset.lang === lang));
        };
        window.addEventListener('agro:lang', this.sync);
        this.sync();
    }
    disconnectedCallback() {
        document.removeEventListener('click', this.outside);
        window.removeEventListener('agro:lang', this.sync);
    }
}
customElements.define('agro-lang-switcher', AgroLangSwitcher);
