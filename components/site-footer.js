// <agro-site-footer> - public site footer. Contact details here are the ones used on /contact.
import './brand-logo.js';

export const CONTACT = {
    email: 'info@agrosphere.ai',
    phone: '+234 800 123 4567',
    phoneHref: '+2348001234567',
    address: 'Lagos, Nigeria'
};

class AgroSiteFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer class="footer">
            <div class="footer-content">
                <div class="footer-section">
                    <div class="footer-brand"><agro-logo size="36"></agro-logo><h4>Agrosphere AI</h4></div>
                    <p style="color: rgba(255,255,255,0.7); line-height: 1.8;">Revolutionizing African agriculture through artificial intelligence and smart farming solutions.</p>
                </div>
                <div class="footer-section">
                    <h4>Quick Links</h4>
                    <a href="/home">Home</a>
                    <a href="/home#about">About</a>
                    <a href="/home#weather">Weather</a>
                    <a href="/home#map">Farm Map</a>
                    <a href="/home#pricing">Pricing</a>
                </div>
                <div class="footer-section">
                    <h4>Account</h4>
                    <a href="/signup">Create account</a>
                    <a href="/login">Log in</a>
                    <a href="/contact">Help & support</a>
                </div>
                <div class="footer-section footer-contact">
                    <h4>Contact</h4>
                    <a href="mailto:${CONTACT.email}"><i class="fas fa-envelope"></i>${CONTACT.email}</a>
                    <a href="tel:${CONTACT.phoneHref}"><i class="fas fa-phone"></i>${CONTACT.phone}</a>
                    <a href="/contact"><i class="fas fa-map-marker-alt"></i>${CONTACT.address}</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} Agrosphere AI. All rights reserved. | <a href="/contact" style="color: var(--accent-gold);">Privacy Policy</a> | <a href="/contact" style="color: var(--accent-gold);">Terms of Service</a></p>
            </div>
        </footer>`;
    }
}
customElements.define('agro-site-footer', AgroSiteFooter);
