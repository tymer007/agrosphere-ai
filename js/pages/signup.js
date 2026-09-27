import { signup, redirectIfSignedIn } from '../auth.js';
import { bindPasswordToggles, showError, busy } from './auth-common.js';

redirectIfSignedIn();
bindPasswordToggles();

const form = document.getElementById('signupForm');
const submit = form.querySelector('button[type=submit]');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const v = (id) => form[id].value.trim();
    if (!v('fullName') || !v('email') || !v('username') || !form.password.value) return showError('Please fill in every field.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return showError('Please enter a valid email address.');
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(v('username'))) return showError('Username must be 3-20 letters, numbers, dots or underscores.');
    if (form.password.value.length < 8) return showError('Password must be at least 8 characters.');
    if (form.password.value !== form.confirmPassword.value) return showError('Passwords do not match.');
    if (!form.terms.checked) return showError('Please accept the Terms of Service to continue.');

    busy(submit, true, 'Creating account...');
    try {
        await signup({ fullName: v('fullName'), email: v('email'), username: v('username'), password: form.password.value });
        location.href = '/onboarding';
    } catch (err) {
        showError(err.message);
        busy(submit, false);
    }
});
