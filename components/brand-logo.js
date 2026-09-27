// <agro-logo size="44"></agro-logo> - the one Agrosphere brand mark (same as the loading screen).
class AgroLogo extends HTMLElement {
    connectedCallback() {
        const size = this.getAttribute('size') || 44;
        this.style.display = 'inline-flex';
        this.innerHTML = `<span class="agro-logo ${this.getAttribute('extra-class') || ''}" style="--logo-size:${size}px" aria-hidden="true"><i class="fas fa-leaf"></i></span>`;
    }
}
customElements.define('agro-logo', AgroLogo);
