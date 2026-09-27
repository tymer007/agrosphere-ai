// Popup showing an AI plant diagnosis (after analysis, or when viewing a saved one).
import { esc, fmtDate } from '../../js/ui.js';
import { healthBadge, healthLabel } from '../../js/catalog.js';

export function showDiagnosis(d, { onClose } = {}) {
    if (!d) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    const list = (items) => (items?.length ? `<ul class="dx-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">-</p>');
    const sevTone = { none: 'success', low: 'success', moderate: 'warning', high: 'danger' }[d.severity] || 'warning';

    overlay.innerHTML = `
    <div class="modal dx-modal">
        <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-microscope" style="color:var(--primary)"></i> AI Plant Diagnosis</h3>
            <button class="modal-close" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <div class="dx-top">
                ${d.thumb ? `<img class="dx-thumb" src="${d.thumb}" alt="Uploaded plant photo">` : ''}
                <div>
                    <div class="dx-crop">${esc(d.itemName || '')} · ${fmtDate(d.date)}</div>
                    <h2 class="dx-disease">${esc(d.disease || 'Unknown')}</h2>
                    <div class="dx-badges">
                        <span class="badge badge-${sevTone}">Severity: ${esc(d.severity || '-')}</span>
                        ${d.confidence != null ? `<span class="badge badge-info">Confidence: ${esc(d.confidence)}%</span>` : ''}
                        ${d.health ? `<span class="badge badge-${healthBadge(d.health)}">${esc(healthLabel(d.health))}</span>` : ''}
                    </div>
                </div>
            </div>
            <h4 class="dx-h">Diagnosis</h4><p>${esc(d.summary || '')}</p>
            ${d.symptoms?.length ? `<h4 class="dx-h">Signs seen</h4>${list(d.symptoms)}` : ''}
            <h4 class="dx-h">What you should do</h4>${list(d.actions)}
            ${d.treatment ? `<h4 class="dx-h">Treatment</h4><p>${esc(d.treatment)}</p>` : ''}
            <h4 class="dx-h">How to prevent it next time</h4>${list(d.prevention)}
            ${d.followUpDays ? `<p class="dx-follow"><i class="fas fa-calendar-alt"></i> Check this plant again in ${esc(d.followUpDays)} day(s).</p>` : ''}
            <p class="dx-disclaimer">AI diagnosis is guidance, not a lab result. For serious outbreaks, contact your local extension officer.</p>
        </div>
        <div class="modal-footer"><button class="btn btn-primary" data-ok><i class="fas fa-check"></i> Got it</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); onClose?.(); };
    overlay.addEventListener('click', (e) => e.target === overlay && close());
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('[data-ok]').addEventListener('click', close);
}
