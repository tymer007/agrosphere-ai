// <agro-site-nav active="home"> - public site navbar (original design, hamburger top-left on mobile).
import './brand-logo.js';
import { currentUser } from '../js/auth.js';

const LINKS = [
    ['home', '/home', 'fa-home', 'Home'],
    ['about', '/home#about', 'fa-info-circle', 'About'],
    ['weather', '/home#weather', 'fa-cloud-sun', 'Weather'],
    ['map', '/home#map', 'fa-map-marked-alt', 'Farm Map'],
    ['pricing', '/home#pricing', 'fa-tags', 'Pricing'],
    ['contact', '/contact', 'fa-envelope', 'Contact']
];

class AgroSiteNav extends HTMLElement {
    connectedCallback() {
        const active = this.getAttribute('active');
        const user = currentUser();
        this.innerHTML = `
        <nav class="navbar" id="navbar">
            <button class="mobile-menu-btn" aria-label="Open menu"><i class="fas fa-bars"></i></button>
            <a href="/home" class="nav-brand"><agro-logo size="38"></agro-logo><span>Agrosphere</span></a>
            <div class="nav-links">
                ${LINKS.map(([id, href, icon, label]) => `<a href="${href}" class="${id === active ? 'active' : ''}"><i class="fas ${icon}"></i> ${label}</a>`).join('')}
            </div>
            <div class="nav-actions">
                ${user
                    ? `<a href="${user.onboarded ? '/dashboard' : '/onboarding'}"><button class="nav-btn">Dashboard</button></a>`
                    : `<a href="/login" class="nav-login">Log in</a><a href="/signup"><button class="nav-btn">Get Started</button></a>`}
            </div>
        </nav>`;
        const links = this.querySelector('.nav-links');
        const btn = this.querySelector('.mobile-menu-btn');
        btn.addEventListener('click', () => {
            links.classList.toggle('active');
            btn.querySelector('i').className = links.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
        });
        links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
            links.classList.remove('active');
            btn.querySelector('i').className = 'fas fa-bars';
        }));
        const nav = this.querySelector('.navbar');
        const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }
}
customElements.define('agro-site-nav', AgroSiteNav);
