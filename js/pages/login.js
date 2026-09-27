import { login, loginDemo, redirectIfSignedIn } from '../auth.js';
import { bindPasswordToggles, showError, busy } from './auth-common.js';

redirectIfSignedIn();
bindPasswordToggles();

const form = document.getElementById('loginForm');
const submit = form.querySelector('button[type=submit]');

function go(user) {
    location.href = user.onboarded ? '/dashboard' : '/onboarding';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const identifier = form.identifier.value.trim();
    const password = form.password.value;
    if (!identifier || !password) return showError('Enter your username/email and password.');
    busy(submit, true, 'Signing in...');
    try {
        go(await login(identifier, password));
    } catch (err) {
        showError(err.message);
        busy(submit, false);
    }
});

const demoBtn = document.getElementById('demoBtn');
async function demo() {
    busy(demoBtn, true, 'Opening demo...');
    try {
        go(await loginDemo());
    } catch (err) {
        showError(err.message);
        busy(demoBtn, false);
    }
}
demoBtn.addEventListener('click', demo);
if (new URLSearchParams(location.search).get('demo') === '1') demo();
