// Preset options used by onboarding, inventory and weekly report forms.
export const CROPS = [
    { name: 'Maize', days: 110 }, { name: 'Cassava', days: 300 }, { name: 'Rice', days: 120 },
    { name: 'Yam', days: 240 }, { name: 'Sorghum', days: 110 }, { name: 'Millet', days: 90 },
    { name: 'Cowpea (Beans)', days: 75 }, { name: 'Groundnut', days: 110 }, { name: 'Soybean', days: 100 },
    { name: 'Tomato', days: 75 }, { name: 'Pepper', days: 90 }, { name: 'Okra', days: 55 },
    { name: 'Onion', days: 120 }, { name: 'Cucumber', days: 55 }, { name: 'Watermelon', days: 85 },
    { name: 'Sweet potato', days: 120 }, { name: 'Leafy greens (Ugu/Spinach)', days: 45 },
    { name: 'Plantain', days: 365 }, { name: 'Cocoa', days: null }, { name: 'Oil palm', days: null }
];

export const LIVESTOCK = [
    'Poultry - Broilers', 'Poultry - Layers', 'Poultry - Local chickens', 'Turkeys', 'Goats', 'Sheep',
    'Cattle', 'Pigs', 'Fish - Catfish', 'Fish - Tilapia', 'Rabbits', 'Snails'
];

export const HEALTH = [
    { value: 'excellent', label: 'Excellent', badge: 'success' },
    { value: 'good', label: 'Good', badge: 'success' },
    { value: 'average', label: 'Average', badge: 'warning' },
    { value: 'sick', label: 'Sick/Diseased', badge: 'danger' }
];

export const GROWTH_STAGES = ['Planned', 'Germination', 'Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Maturity', 'Harvested'];

export const CROP_ISSUES = ['Pests', 'Leaf spots', 'Yellowing', 'Wilting', 'Weeds', 'Drought stress', 'Waterlogging', 'Rot', 'Stunted growth'];

export const LIVESTOCK_SYMPTOMS = ['Coughing', 'Diarrhoea', 'Reduced appetite', 'Lameness', 'Skin lesions', 'Low production', 'Weight loss', 'Lethargy'];

export const IRRIGATION = ['Rain-fed', 'Irrigated', 'Mixed'];

export const PURPOSES = ['Meat', 'Eggs', 'Milk', 'Breeding', 'Mixed'];

export const GOALS = [
    { id: 'yield', icon: 'fa-chart-line', label: 'Increase crop yield' },
    { id: 'disease', icon: 'fa-bug', label: 'Reduce pests & disease' },
    { id: 'animals', icon: 'fa-heartbeat', label: 'Improve livestock health' },
    { id: 'weather', icon: 'fa-cloud-sun-rain', label: 'Plan around the weather' },
    { id: 'records', icon: 'fa-clipboard-list', label: 'Keep better farm records' },
    { id: 'inputs', icon: 'fa-flask', label: 'Use fertilizer & inputs wisely' },
    { id: 'organic', icon: 'fa-leaf', label: 'Farm more sustainably' },
    { id: 'expand', icon: 'fa-expand-arrows-alt', label: 'Expand my farm' }
];

export const RECORD_KINDS = {
    crop_review: { label: 'Crop weekly review', icon: 'fa-seedling', badge: 'success', itemType: 'crop' },
    livestock_review: { label: 'Livestock weekly review', icon: 'fa-cow', badge: 'info', itemType: 'livestock' },
    fertilizer: { label: 'Fertilizer application', icon: 'fa-flask', badge: 'success', itemType: 'crop' },
    treatment: { label: 'Treatment / vaccination', icon: 'fa-syringe', badge: 'warning', itemType: 'any' },
    harvest: { label: 'Harvest / production', icon: 'fa-shopping-basket', badge: 'info', itemType: 'any' },
    observation: { label: 'General observation', icon: 'fa-eye', badge: 'info', itemType: 'any' },
    diagnosis: { label: 'AI plant diagnosis', icon: 'fa-microscope', badge: 'danger', itemType: 'crop' }
};

export function cropDays(name) {
    return CROPS.find((c) => c.name === name)?.days ?? null;
}

export function healthBadge(value) {
    return HEALTH.find((h) => h.value === value)?.badge || 'warning';
}

export function healthLabel(value) {
    return HEALTH.find((h) => h.value === value)?.label || value || '-';
}
