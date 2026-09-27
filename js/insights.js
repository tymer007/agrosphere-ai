// Preset, rule-based insights shown beside the weekly report forms (no API call).
import { daysBetween } from './ui.js';

const ISSUE_TIPS = {
    'Pests': 'Scout the underside of leaves at dawn. Start with neem-based spray before stronger chemicals, and remove heavily infested plants.',
    'Leaf spots': 'Leaf spots often mean fungal disease. Remove affected lower leaves, avoid overhead watering and improve spacing for airflow.',
    'Yellowing': 'Yellowing of older leaves usually signals nitrogen deficiency - consider a top-dress of urea or well-rotted manure.',
    'Wilting': 'Check soil moisture first. If the soil is wet and plants still wilt, inspect the stem base for rot or bacterial wilt.',
    'Weeds': 'Weeds compete hardest in the first 6 weeks. Weed before fertilizer application so crops get the nutrients.',
    'Drought stress': 'Water early morning, mulch around plants and prioritise crops at flowering - that stage is most sensitive to drought.',
    'Waterlogging': 'Open drainage channels between beds. Waterlogged roots cannot take up nutrients.',
    'Rot': 'Remove rotting plants from the field and avoid planting the same crop in that spot next season.',
    'Stunted growth': 'Stunting can come from poor soil, root pests or nematodes. A soil test will tell you which nutrients are missing.'
};

const SYMPTOM_TIPS = {
    'Coughing': 'Coughing can spread fast. Improve ventilation in the house and separate coughing animals.',
    'Diarrhoea': 'Isolate affected animals, give clean water with electrolytes and check the feed for mould.',
    'Reduced appetite': 'Loss of appetite is an early warning sign - check temperature and watch closely for 24-48 hours.',
    'Lameness': 'Inspect hooves/feet, keep housing dry and trim hooves if overgrown.',
    'Skin lesions': 'Skin lesions may be mites or fungal infection. Isolate and consult a vet before treating the whole group.',
    'Low production': 'A drop in eggs or milk often follows stress, heat or feed changes. Check feed quality and water supply.',
    'Weight loss': 'Deworm if not done in the last 3 months and review feed quantity per head.',
    'Lethargy': 'Lethargic animals should be checked by a vet quickly - it is a sign of many serious diseases.'
};

export function cropInsights(crop, reports = []) {
    const tips = [];
    const last = reports[0];
    if (!crop) return tips;

    if (!last) tips.push({ icon: 'fa-clipboard-check', tone: 'info', text: `No weekly review yet for ${crop.name}. A quick review each week helps spot problems early.` });
    else {
        const ago = -daysBetween(last.date);
        if (ago > 7) tips.push({ icon: 'fa-clock', tone: 'warning', text: `Last review was ${ago} days ago - it's time for this week's check.` });
    }

    const health = last?.health || crop.health;
    if (health === 'sick') tips.push({ icon: 'fa-microscope', tone: 'danger', text: `${crop.name} is marked sick. Upload a photo to AI Plant Diagnosis for a disease check and treatment advice.` });
    if (health === 'average') tips.push({ icon: 'fa-search', tone: 'warning', text: 'Health is average - look closer for early pest or nutrient problems before they spread.' });

    (last?.issues || []).forEach((issue) => ISSUE_TIPS[issue] && tips.push({ icon: 'fa-lightbulb', tone: 'warning', text: ISSUE_TIPS[issue] }));

    if (crop.harvestDate) {
        const days = daysBetween(crop.harvestDate);
        if (days >= 0 && days <= 14) tips.push({ icon: 'fa-shopping-basket', tone: 'success', text: `Harvest is due in ${days} day(s). Prepare bags, storage and labour now.` });
        else if (days < 0 && crop.stage !== 'Harvested') tips.push({ icon: 'fa-exclamation-triangle', tone: 'warning', text: `Expected harvest date passed ${-days} day(s) ago. Update the stage if you have harvested.` });
    }

    const stage = last?.stage || crop.stage;
    if (stage === 'Flowering') tips.push({ icon: 'fa-tint', tone: 'info', text: 'Flowering is the most water-sensitive stage. Avoid moisture stress this week.' });
    if (stage === 'Vegetative' && !reports.some((r) => r.fertilizer || r.kind === 'fertilizer')) tips.push({ icon: 'fa-flask', tone: 'info', text: 'Vegetative stage is the right time for a nitrogen top-dress if you have not applied fertilizer yet.' });

    if (crop.lastDiagnosis) tips.push({ icon: 'fa-notes-medical', tone: 'info', text: `Last AI diagnosis: ${crop.lastDiagnosis.disease} (${crop.lastDiagnosis.severity}). Keep following the treatment plan.` });

    if (!tips.length) tips.push({ icon: 'fa-check-circle', tone: 'success', text: `${crop.name} looks on track. Keep up the weekly reviews.` });
    return tips;
}

export function livestockInsights(group, reports = []) {
    const tips = [];
    const last = reports[0];
    if (!group) return tips;

    if (!last) tips.push({ icon: 'fa-clipboard-check', tone: 'info', text: `No weekly review yet for ${group.type}. Record head count and health each week.` });
    else if (-daysBetween(last.date) > 7) tips.push({ icon: 'fa-clock', tone: 'warning', text: `Last review was ${-daysBetween(last.date)} days ago - time for this week's check.` });

    if ((last?.deaths || 0) > 0) tips.push({ icon: 'fa-heartbeat', tone: 'danger', text: `${last.deaths} death(s) recorded last review. If more than 1-2% die in a week, call a vet.` });
    if ((last?.health || group.health) === 'sick') tips.push({ icon: 'fa-user-md', tone: 'danger', text: 'Group marked sick - isolate affected animals and consult a veterinarian.' });
    (last?.symptoms || []).forEach((s) => SYMPTOM_TIPS[s] && tips.push({ icon: 'fa-lightbulb', tone: 'warning', text: SYMPTOM_TIPS[s] }));
    if (group.vaccinated === 'no') tips.push({ icon: 'fa-syringe', tone: 'warning', text: 'Vaccinations are not up to date. Book the next round - prevention is cheaper than treatment.' });
    if (group.vaccinated === 'partial') tips.push({ icon: 'fa-syringe', tone: 'info', text: 'Some animals are unvaccinated. Complete the schedule so the whole group is protected.' });
    if (/layers/i.test(group.type) && last?.production && group.count) {
        const rate = Math.round((last.production / (last.headCount || group.count)) * 100);
        tips.push({ icon: 'fa-egg', tone: rate >= 75 ? 'success' : 'warning', text: `Laying rate is about ${rate}%. ${rate >= 75 ? 'That is a healthy rate.' : 'Below 75% - check feed, light hours and stress.'}` });
    }

    if (!tips.length) tips.push({ icon: 'fa-check-circle', tone: 'success', text: `${group.type} look healthy. Keep recording weekly.` });
    return tips;
}
