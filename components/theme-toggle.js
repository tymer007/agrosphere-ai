// <agro-theme-toggle> - floating dark/light switch (original design).
import { applyTheme, resolveTheme, setThemePref } from '../js/theme.js';

class AgroThemeToggle extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<button class="theme-toggle" title="Toggle Dark/Light Mode" aria-label="Toggle dark or light mode"><i class="fas fa-moon"></i></button>`;
        this.icon = this.querySelector('i');
        this.querySelector('button').addEventListener('click', () => {
            setThemePref(resolveTheme() === 'dark' ? 'light' : 'dark');
        });
        this.sync = () => (this.icon.className = resolveTheme() === 'dark' ? 'fas fa-moon' : 'fas fa-sun');
        window.addEventListener('agro:theme', this.sync);
        applyTheme();
        this.sync();
    }
    disconnectedCallback() {
        window.removeEventListener('agro:theme', this.sync);
    }
}
customElements.define('agro-theme-toggle', AgroThemeToggle);
