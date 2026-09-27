// Human-readable summaries of record entries (used by tables, exports and AI context).
import { RECORD_KINDS } from './catalog.js';

export function kindLabel(kind) {
    return RECORD_KINDS[kind]?.label || kind;
}

export function describeRecord(r) {
    const parts = [];
    switch (r.kind) {
        case 'crop_review':
            if (r.stage) parts.push(`Stage: ${r.stage}`);
            if (r.issues?.length) parts.push(`Issues: ${r.issues.join(', ')}`);
            if (r.fertilizer) parts.push(`Fertilizer: ${r.fertilizer}${r.fertilizerQty ? ` (${r.fertilizerQty} ${r.fertilizerUnit || ''})` : ''}`);
            if (r.irrigation) parts.push(r.irrigation);
            break;
        case 'livestock_review':
            if (r.headCount != null && r.headCount !== '') parts.push(`Head: ${r.headCount}`);
            if (+r.births) parts.push(`Births: ${r.births}`);
            if (+r.deaths) parts.push(`Deaths: ${r.deaths}`);
            if (+r.sold) parts.push(`Sold: ${r.sold}`);
            if (r.symptoms?.length) parts.push(`Symptoms: ${r.symptoms.join(', ')}`);
            if (r.production) parts.push(`Output: ${r.production} ${r.productionUnit || ''}`);
            if (r.treatment) parts.push(`Treatment: ${r.treatment}`);
            break;
        case 'fertilizer':
            parts.push([r.product, r.quantity && `${r.quantity} ${r.unit || ''}`, r.method].filter(Boolean).join(' - '));
            break;
        case 'treatment':
            parts.push([r.product, r.dose, r.reason && `for ${r.reason}`].filter(Boolean).join(' - '));
            break;
        case 'harvest':
            parts.push([r.quantity && `${r.quantity} ${r.unit || ''}`, r.quality && `quality: ${r.quality}`].filter(Boolean).join(', '));
            break;
        case 'observation':
            if (r.title) parts.push(r.title);
            break;
        case 'diagnosis':
            parts.push(`${r.disease || 'Diagnosis'}${r.severity ? ` (${r.severity})` : ''}`);
            break;
    }
    if (r.notes) parts.push(r.notes);
    return parts.filter(Boolean).join(' · ') || '-';
}
