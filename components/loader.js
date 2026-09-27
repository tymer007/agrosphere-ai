// <agro-loader> - the professional loading screen. Only used when opening the dashboard.
class AgroLoader extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <div class="pro-loader" id="proLoader">
            <div class="pro-loader-bg">
                <div class="bg-image" style="background-image: url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1920&q=80');"></div>
                <div class="bg-overlay"></div>
            </div>
            <div class="pro-loader-content">
                <div class="pro-logo">
                    <div class="logo-mark"><i class="fas fa-leaf"></i></div>
                    <div class="logo-rings"><div class="ring ring-1"></div><div class="ring ring-2"></div></div>
                </div>
                <div class="pro-brand">
                    <h1 class="brand-name">AGROSPHERE</h1>
                    <p class="brand-tagline">AI-Powered Agricultural Intelligence</p>
                </div>
                <div class="pro-progress">
                    <div class="progress-line"><div class="progress-bar"></div></div>
                    <div class="progress-info">
                        <span class="progress-text">Initializing</span>
                        <span class="progress-percent">0%</span>
                    </div>
                </div>
                <div class="status-messages"><span class="status-item active">Connecting to farm database</span></div>
            </div>
        </div>`;
        this.run();
    }

    run() {
        const states = [
            [0, 'Initializing'], [15, 'Loading your farm'], [32, 'Syncing records'], [50, 'Checking crop health'],
            [68, 'Fetching local weather'], [85, 'Preparing AI insights'], [100, 'Welcome to Agrosphere']
        ];
        const messages = ['Connecting to farm database', 'Syncing weather data', 'Analyzing crop health', 'Preparing dashboard'];
        const bar = this.querySelector('.progress-bar');
        const pct = this.querySelector('.progress-percent');
        const text = this.querySelector('.progress-text');
        const status = this.querySelector('.status-messages');
        let i = 0, m = 0;
        const msgTimer = setInterval(() => {
            m = (m + 1) % messages.length;
            status.innerHTML = `<span class="status-item active">${messages[m]}</span>`;
        }, 900);
        const timer = setInterval(() => {
            if (i >= states.length) {
                clearInterval(timer);
                clearInterval(msgTimer);
                setTimeout(() => this.finish(), 350);
                return;
            }
            const [p, label] = states[i++];
            bar.style.width = p + '%';
            pct.textContent = p + '%';
            text.textContent = label;
        }, 260);
    }

    finish() {
        this.querySelector('.pro-loader').classList.add('hidden');
        window.dispatchEvent(new CustomEvent('agro:loaded'));
        setTimeout(() => this.remove(), 800);
    }
}
customElements.define('agro-loader', AgroLoader);
