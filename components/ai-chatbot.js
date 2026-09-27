// <agro-chatbot> - floating Agro AI assistant (original widget design).
// First message is a local greeting (no AI call). User messages go to the cheap chat
// model via js/ai.js, limited to 5 per day, with rolling 5-message memory + summary.
import { sendChat, chatMemory, quota, QuotaError } from '../js/ai.js';
import { currentUser } from '../js/auth.js';
import { db } from '../js/store.js';
import { esc } from '../js/ui.js';
import { t } from '../js/i18n.js';

function format(text) {
    return esc(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^[-•]\s+/gm, '• ')
        .replace(/\n/g, '<br>');
}

class AgroChatbot extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <div class="ai-widget">
            <div class="ai-panel">
                <div class="ai-header">
                    <div class="ai-avatar"><i class="fas fa-robot"></i></div>
                    <div style="flex:1">
                        <h3>Agro AI</h3>
                        <div class="ai-status"><span data-i18n="online">${t('online')}</span></div>
                    </div>
                    <span class="ai-quota" title="AI messages left today"></span>
                </div>
                <div class="ai-messages"></div>
                <div class="ai-input-area">
                    <input type="text" class="ai-input" data-i18n-placeholder="type_question" placeholder="${t('type_question')}" maxlength="1000">
                    <button class="ai-voice" title="Voice Input"><i class="fas fa-microphone"></i></button>
                    <button class="ai-send" title="Send"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
            <button class="ai-button" aria-label="Open Agro AI"><i class="fas fa-robot"></i></button>
        </div>`;

        this.panel = this.querySelector('.ai-panel');
        this.list = this.querySelector('.ai-messages');
        this.input = this.querySelector('.ai-input');
        this.quotaEl = this.querySelector('.ai-quota');

        this.querySelector('.ai-button').addEventListener('click', () => this.toggle());
        this.querySelector('.ai-send').addEventListener('click', () => this.send());
        this.input.addEventListener('keydown', (e) => e.key === 'Enter' && this.send());
        this.initVoice();

        // Other parts of the app (e.g. the overview analysis) can open the chat and send a message.
        this.onOpen = (e) => {
            this.open();
            if (e.detail?.text) this.send(e.detail.text);
        };
        window.addEventListener('agro:chat-open', this.onOpen);
        this.render();
    }

    disconnectedCallback() {
        window.removeEventListener('agro:chat-open', this.onOpen);
    }

    toggle() {
        this.panel.classList.toggle('active');
        if (this.panel.classList.contains('active')) this.render();
    }

    open() {
        this.panel.classList.add('active');
        this.render();
    }

    greeting() {
        const user = currentUser();
        const first = (user?.fullName || 'there').split(' ')[0];
        const crops = db.list('crop');
        const sick = [...crops, ...db.list('livestock')].filter((i) => i.health === 'sick');
        let starter = 'What would you like help with on your farm today?';
        if (sick.length) starter = `I see ${sick.length} item(s) marked sick (${sick.map((s) => s.name || s.type).join(', ')}). Want advice on what to check first?`;
        else if (crops.length) starter = `How is your ${crops[0].name} doing this week? Ask me anything about crops, livestock, pests or weather.`;
        return `Hello ${first}! I'm Agro AI, your farming assistant. I can help with:\n• Crop disease and pest advice\n• Fertilizer recommendations\n• Livestock health\n• Planning around the weather\n\n${starter}`;
    }

    bubble(role, html) {
        return role === 'user'
            ? `<div class="message user"><div class="message-content">${html}</div></div>`
            : `<div class="message ai"><div class="avatar"><i class="fas fa-robot"></i></div><div class="message-content">${html}</div></div>`;
    }

    render() {
        const memory = chatMemory();
        let html = this.bubble('ai', format(this.greeting()));
        if (memory.summary) html += `<div class="ai-summary-note"><i class="fas fa-history"></i> Earlier conversation summarised: ${esc(memory.summary)}</div>`;
        html += memory.messages.map((m) => this.bubble(m.role, format(m.content))).join('');
        this.list.innerHTML = html;
        this.updateQuota();
        this.list.scrollTop = this.list.scrollHeight;
    }

    updateQuota() {
        const left = quota.remaining('chat');
        this.quotaEl.textContent = `${left}/${quota.limit('chat')}`;
        this.quotaEl.classList.toggle('empty', left === 0);
        this.input.disabled = left === 0;
        this.input.placeholder = left === 0 ? 'Daily AI limit reached - check back tomorrow' : t('type_question');
    }

    async send(preset) {
        const text = (preset ?? this.input.value).trim();
        if (!text || this.busy) return;
        if (quota.remaining('chat') <= 0) {
            this.list.insertAdjacentHTML('beforeend', this.bubble('ai', esc(new QuotaError('chat').message)));
            this.list.scrollTop = this.list.scrollHeight;
            return;
        }
        this.busy = true;
        this.input.value = '';
        this.list.insertAdjacentHTML('beforeend', this.bubble('user', esc(text)));
        this.list.insertAdjacentHTML('beforeend', `<div class="message ai typing"><div class="avatar"><i class="fas fa-robot"></i></div><div class="message-content"><span class="dots"><i></i><i></i><i></i></span></div></div>`);
        this.list.scrollTop = this.list.scrollHeight;
        try {
            const reply = await sendChat(text);
            this.render();
            if (this.spoken) this.speak(reply);
        } catch (err) {
            this.list.querySelector('.typing')?.remove();
            this.list.insertAdjacentHTML('beforeend', this.bubble('ai', `<span style="color:#ef4444">${esc(err.message)}</span>`));
            this.updateQuota();
        } finally {
            this.busy = false;
            this.spoken = false;
            this.list.scrollTop = this.list.scrollHeight;
        }
    }

    initVoice() {
        const btn = this.querySelector('.ai-voice');
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            btn.addEventListener('click', () => alert('Voice input is not supported in this browser.'));
            return;
        }
        const rec = new SR();
        rec.lang = 'en-US';
        rec.onresult = (e) => {
            this.spoken = true;
            this.send(e.results[0][0].transcript);
        };
        rec.onend = () => btn.classList.remove('recording');
        rec.onerror = () => btn.classList.remove('recording');
        btn.addEventListener('click', () => {
            if (btn.classList.contains('recording')) return rec.stop();
            btn.classList.add('recording');
            rec.start();
        });
    }

    speak(text) {
        if (!('speechSynthesis' in window)) return;
        const u = new SpeechSynthesisUtterance(text.replace(/[*#]/g, ''));
        u.rate = 0.95;
        speechSynthesis.speak(u);
    }
}
customElements.define('agro-chatbot', AgroChatbot);
