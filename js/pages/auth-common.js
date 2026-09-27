import '../../components/brand-logo.js';

export function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle]').forEach((icon) => icon.addEventListener('click', () => {
        const input = document.getElementById(icon.dataset.toggle);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        icon.classList.toggle('fa-eye', !show);
        icon.classList.toggle('fa-eye-slash', show);
    }));
}

export function showError(message) {
    const el = document.getElementById('formError');
    el.textContent = message;
    el.classList.toggle('show', !!message);
}

export function busy(button, on, label) {
    if (on) {
        button.dataset.html = button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${label}`;
    } else if (button.dataset.html) button.innerHTML = button.dataset.html;
    button.disabled = on;
}
