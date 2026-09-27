// Crop Health: inventory + weekly report, AI plant diagnosis (1/day) and fertilizer log.
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
    insights: cropInsights
};

let pendingImage = null;

export default {
    id: 'crops',
    icon: 'fa-seedling',
    titleKey: 'crop_health',
    subKey: 'sub_crops',

    render(root, app) {
        const crops = db.list('crop');
        const diagnoses = db.list('record').filter((r) => r.kind === 'diagnosis').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const fert = db.list('record').filter((r) => r.kind === 'fertilizer' || (r.kind === 'crop_review' && r.fertilizer)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const left = quota.remaining('diagnosis');

        renderInventoryPage(root, app, cfg, `
        <div class="content-grid" style="margin-top:24px">
            <div class="glass-card diagnosis-card">
                <div class="panel-head">
                    <h3 class="section-title"><i class="fas fa-microscope"></i> ${t('ai_diagnosis')}</h3>
                    <span class="quota-pill ${left ? '' : 'empty'}">${left}/${quota.limit('diagnosis')} left today</span>
                </div>
                <div class="dx-tabs">
                    <button class="dx-tab active"><i class="fas fa-seedling"></i> Plants</button>
                    <button class="dx-tab disabled" data-soon title="${t('coming_soon')}"><i class="fas fa-cow"></i> Animals <em>${t('coming_soon')}</em></button>
                </div>
                ${crops.length ? `
                <form class="dx-form" novalidate>
                    <label class="dropzone ${pendingImage ? 'has-image' : ''}">
                        <input type="file" accept="image/*" hidden>
                        ${pendingImage ? `<img src="${pendingImage}" alt="Selected plant photo">` : `<i class="fas fa-camera"></i><strong>Upload one photo of the affected plant</strong><small>Close-up of leaves, stem or fruit · JPG/PNG</small>`}
                    </label>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Which plant?</label>
                            <select class="form-select" name="crop">${crops.map((c) => `<option value="${c.id}">${esc(c.name)}${c.variety ? ` (${esc(c.variety)})` : ''}${c.plot ? ` - ${esc(c.plot)}` : ''}</option>`).join('')}</select></div>
                        <div class="form-group"><label class="form-label">Extra context (optional)</label>
                            <input class="form-input" name="context" maxlength="500" placeholder="e.g. spots started after heavy rain"></div>
                    </div>
                    <button class="btn btn-primary" type="submit" ${left ? '' : 'disabled'} style="width:100%;justify-content:center">
                        <i class="fas fa-search-plus"></i> ${left ? 'Diagnose with AI' : 'Daily limit reached - check back tomorrow'}
                    </button>
                </form>` : `<div class="empty-state small"><i class="fas fa-seedling"></i><p>Add a crop first, then upload a photo for diagnosis.</p></div>`}
                ${diagnoses.length ? `<h4 class="sub-h">Recent diagnoses</h4><ul class="dx-history">${diagnoses.slice(0, 4).map((d) => `
                    <li data-view="${d.id}">${d.thumb ? `<img src="${d.thumb}" alt="">` : '<i class="fas fa-leaf"></i>'}<div><strong>${esc(d.disease)}</strong><small>${esc(d.itemName)} · ${fmtDate(d.date)}</small></div><i class="fas fa-chevron-right"></i></li>`).join('')}</ul>` : ''}
            </div>

            <div class="glass-card">
                <div class="panel-head">
                    <h3 class="section-title"><i class="fas fa-flask"></i> Fertilizer log</h3>
                    <button class="btn btn-glass btn-sm" data-log-fert><i class="fas fa-plus"></i> Log</button>
                </div>
                ${fert.length ? `<ul class="fert-list">${fert.slice(0, 8).map((f) => `
                    <li><span class="task-icon badge-success"><i class="fas fa-flask"></i></span>
                        <div><strong>${esc(f.product || f.fertilizer)}</strong><small>${esc(f.itemName)} · ${fmtDate(f.date)}${f.quantity || f.fertilizerQty ? ` · ${esc(f.quantity || f.fertilizerQty)} ${esc(f.unit || f.fertilizerUnit || '')}` : ''}</small></div></li>`).join('')}</ul>`
                    : `<div class="empty-state small"><i class="fas fa-flask"></i><p>No fertilizer logged yet. Add it in a weekly review or log it here.</p></div>`}
            </div>
        </div>`);

        root.querySelector('[data-soon]')?.addEventListener('click', () => toast('Animal diagnosis is coming soon', 'info'));
        root.querySelector('[data-log-fert]').addEventListener('click', () => app.openRecord({ kind: 'fertilizer' }));
        root.querySelectorAll('[data-view]').forEach((li) => li.addEventListener('click', () => showDiagnosis(db.get(li.dataset.view))));

        const form = root.querySelector('.dx-form');
        if (!form) return;
        const file = form.querySelector('input[type=file]');
        file.addEventListener('change', async () => {
            if (!file.files[0]) return;
            try {
                pendingImage = await imageToDataUrl(file.files[0]);
                app.refresh();
            } catch (err) {
                toast(err.message, 'error');
            }
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!pendingImage) return toast('Please upload a photo of the plant first', 'warning');
            const crop = db.get(form.crop.value);
            const btn = form.querySelector('button[type=submit]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analysing photo...';
            try {
                const result = await diagnosePlant({ image: pendingImage, crop, context: form.context.value.trim() });
                const saved = await saveDiagnosis(crop, result, form.context.value.trim());
                pendingImage = null;
                showDiagnosis(saved, { onClose: () => app.refresh() });
            } catch (err) {
                toast(err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-search-plus"></i> Diagnose with AI';
            }
        });
    }
};

// Save the diagnosis as a record and write the results into the plant's own fields.
async function saveDiagnosis(crop, r, context) {
    const thumb = await imageToDataUrl(dataUrlToFile(pendingImage), 220, 0.7);
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
