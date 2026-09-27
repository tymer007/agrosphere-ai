import '../../components/site-nav.js';
import '../../components/site-footer.js';
import { readJSON, writeJSON } from '../store.js';
import { showToast } from '../site.js';

const form = document.getElementById('contactForm');
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.cName.value.trim();
    const email = form.cEmail.value.trim();
    const message = form.cMessage.value.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) return showToast('Please add your name, a valid email and a message', 'error');

    // Stored locally for now (Excel sync can pick these up as "contact" entries later).
    const inbox = readJSON('agro_contact_messages', []);
    inbox.push({ name, email, topic: form.cTopic.value, message, sentAt: new Date().toISOString() });
    writeJSON('agro_contact_messages', inbox);

    form.reset();
    showToast('Thanks! Your message has been received.');
});
