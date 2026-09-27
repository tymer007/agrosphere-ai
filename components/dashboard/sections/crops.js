// Crop Health: action bar (AI diagnosis / fertilizer popups) + inventory & weekly report.
// Each crop card shows its recent diagnoses and fertilizer applications.
import { db } from '../../../js/store.js';
import { esc, fmtDate, toast, imageToDataUrl, todayISO, isoWeek } from '../../../js/ui.js';
import { t } from '../../../js/i18n.js';
import { cropInsights } from '../../../js/insights.js';
import { quota, diagnosePlant } from '../../../js/ai.js';
import { renderInventoryPage, harvestText } from '../inventory-page.js';
import { showDiagnosis } from '../diagnosis-popup.js';

const cfg = {
    kind: 'crop',
    reviewKind: 'crop_review',
    icon: 'fa-seedling',
    addLabel: 'Add Crop',
    emptyText: 'Add the crops you are growing to start tracking their health.',
    label: (c) => c.name,
    meta: (c) => [c.plot, c.area && `${c.area} ${c.areaUnit || ''}`, c.stage, c.sowDate && `sown ${fmtDate(c.sowDate)}`, harvestText(c)].filter(Boolean),
    insights: cropInsights,
    logKinds: ['diagnosis', 'fertilizer', 'treatment', 'harvest']
};

export default {
    id: 'crops',
    icon: 'fa-seedling',
    titleKey: 'crop_health',
    subKey: 'sub_crops',
    recordScope: 'crop',

    render(root, app) {
        const left = quota.remaining('diagnosis');
        renderInventoryPage(root, app, cfg, {
            top: `
            <div class="page-actions">
                <button class="action-tile" data-action="diagnose">
                    <span class="action-icon badge-danger"><i class="fas fa-microscope"></i></span>
                    <span><strong>${t('ai_diagnosis')}</strong><small>Upload a photo of a sick plant</small></span>
                    <em class="quota-pill ${left ? '' : 'empty'}">${left}/${quota.limit('diagnosis')} today</em>
                </button>
                <button class="action-tile" data-action="fertilizer">
                    <span class="action-icon badge-success"><i class="fas fa-flask"></i></span>
                    <span><strong>Log fertilizer</strong><small>Record a fertilizer or manure application</small></span>
                </button>
            </div>`
        });

        root.querySelector('[data-action=fertilizer]').addEventListener('click', () => {
            if (!db.list('crop').length) return toast('Add a crop first', 'warning');
            app.openRecord({ kind: 'fertilizer' });
        });
        root.querySelector('[data-action=diagnose]').addEventListener('click', () => openDiagnosisModal(app));
    }
};

function openDiagnosisModal(app) {
    const crops = db.list('crop');
    if (!crops.length) return toast('Add a crop first, then diagnose it', 'warning');
    const left = quota.remaining('diagnosis');
    let image = null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
        <div class="modal-header">
            <h3 class="modal-title"><i class="fas fa-microscope" style="color:var(--primary)"></i> ${t('ai_diagnosis')}</h3>
            <button class="modal-close" aria-label="Close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <div class="dx-tabs">
                <button class="dx-tab active" type="button"><i class="fas fa-seedling"></i> Plants</button>
                <button class="dx-tab disabled" type="button" data-soon><i class="fas fa-cow"></i> Animals <em>${t('coming_soon')}</em></button>
                <span class="quota-pill ${left ? '' : 'empty'}" style="margin-left:auto;align-self:center">${left}/${quota.limit('diagnosis')} left today</span>
            </div>
            <form class="dx-form" novalidate>
                <label class="dropzone">
                    <input type="file" accept="image/*" hidden>
                    <span class="dz-empty"><i class="fas fa-camera"></i><strong>Upload one photo of the affected plant</strong><small>Close-up of leaves, stem or fruit · JPG/PNG</small></span>
                </label>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Which plant?</label>
                        <select class="form-select" name="crop">${crops.map((c) => `<option value="${c.id}">${esc(c.name)}${c.variety ? ` (${esc(c.variety)})` : ''}${c.plot ? ` - ${esc(c.plot)}` : ''}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Extra context (optional)</label>
                        <input class="form-input" name="context" maxlength="500" placeholder="e.g. spots started after heavy rain"></div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-glass" data-close>${t('cancel')}</button>
            <button class="btn btn-primary" data-run ${left ? '' : 'disabled'}><i class="fas fa-search-plus"></i> ${left ? 'Diagnose with AI' : 'Daily limit reached - check back tomorrow'}</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => e.target === overlay && close());
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelector('[data-soon]').addEventListener('click', () => toast('Animal diagnosis is coming soon', 'info'));

    const form = overlay.querySelector('form');
    const zone = overlay.querySelector('.dropzone');
    const file = zone.querySelector('input');
    file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        try {
            image = await imageToDataUrl(file.files[0]);
            zone.classList.add('has-image');
            zone.querySelector('.dz-empty')?.remove();
            zone.querySelector('img')?.remove();
            zone.insertAdjacentHTML('beforeend', `<img src="${image}" alt="Selected plant photo">`);
        } catch (err) {
            toast(err.message, 'error');
        }
    });

    const run = overlay.querySelector('[data-run]');
    run.addEventListener('click', async () => {
        if (!image) return toast('Please upload a photo of the plant first', 'warning');
        const crop = db.get(form.crop.value);
        run.disabled = true;
        run.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analysing photo...';
        try {
            const result = await diagnosePlant({ image, crop, context: form.context.value.trim() });
            const saved = await saveDiagnosis(crop, result, form.context.value.trim(), image);
            close();
            showDiagnosis(saved, { onClose: () => app.refresh() });
        } catch (err) {
            toast(err.message, 'error');
            run.disabled = false;
            run.innerHTML = '<i class="fas fa-search-plus"></i> Diagnose with AI';
        }
    });
}

// Save the diagnosis as a record and write the results into the plant's own fields.
async function saveDiagnosis(crop, r, context, image) {
    const thumb = await imageToDataUrl(dataUrlToFile(image), 220, 0.7);
    const date = todayISO();
    const record = db.put('record', {
        kind: 'diagnosis', itemType: 'crop', itemId: crop.id, itemName: crop.name, date, week: isoWeek(date),
        health: r.healthStatus, disease: r.disease, severity: r.severity, confidence: r.confidence, summary: r.summary,
        symptoms: r.symptoms, actions: r.actions, prevention: r.prevention, treatment: r.treatment, followUpDays: r.followUpDays,
        context, thumb
    });
    db.patch(crop.id, {
        health: r.healthStatus || crop.health,
        lastDiagnosis: { disease: r.disease, severity: r.severity, treatment: r.treatment, date, recordId: record.id }
    });
    return record;
}

function dataUrlToFile(dataUrl) {
    const [meta, b64] = dataUrl.split(',');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new File([bytes], 'plant.jpg', { type: meta.match(/:(.*?);/)[1] });
}
