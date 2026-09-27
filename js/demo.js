// Seed data for the demo account.
import { db } from './store.js';
import { todayISO, isoWeek } from './ui.js';

function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

export function seedDemo(userId) {
    const put = (type, data) => db.put(type, data, { userId });

    put('profile', {
        phone: '+234 800 000 0000', country: 'Nigeria', state: 'Oyo', city: 'Ibadan',
        address: 'Ibadan, Oyo, Nigeria', farmName: 'Green Valley Farm', farmSize: 6, farmSizeUnit: 'hectares',
        experience: '3-5 years', role: 'Owner'
    });
    put('farm', {
        farmType: 'both', goals: ['yield', 'disease', 'weather'], challenge: 'Pests and plant disease',
        location: { lat: 7.3775, lng: 3.947, address: 'Ibadan, Oyo, Nigeria', boundary: [], points: [], radius: 0, mapped: true }
    });

    const maize = put('crop', { name: 'Maize', variety: 'Oba Super 2', plot: 'North field', area: 2.5, areaUnit: 'hectares', plantCount: 50000, sowDate: daysFromNow(-60), harvestDate: daysFromNow(50), stage: 'Flowering', health: 'good', irrigation: 'Rain-fed' });
    const tomato = put('crop', { name: 'Tomato', variety: 'Roma VF', plot: 'Garden plot', area: 0.5, areaUnit: 'hectares', plantCount: 4000, sowDate: daysFromNow(-50), harvestDate: daysFromNow(12), stage: 'Fruiting', health: 'average', irrigation: 'Irrigated' });
    put('crop', { name: 'Cassava', variety: 'TME 419', plot: 'East plot', area: 3, areaUnit: 'hectares', plantCount: 30000, sowDate: daysFromNow(-150), harvestDate: daysFromNow(150), stage: 'Vegetative', health: 'excellent', irrigation: 'Rain-fed' });
    const layers = put('livestock', { type: 'Poultry - Layers', breed: 'Isa Brown', count: 300, avgAgeMonths: 8, purpose: 'Eggs', housing: 'Deep litter', health: 'good', vaccinated: 'yes' });
    put('livestock', { type: 'Goats', breed: 'West African Dwarf', count: 14, avgAgeMonths: 18, purpose: 'Meat', housing: 'Pen', health: 'average', vaccinated: 'partial' });

    const lastWeek = daysFromNow(-7);
    put('record', { kind: 'crop_review', itemType: 'crop', itemId: maize.id, itemName: 'Maize', date: lastWeek, week: isoWeek(lastWeek), health: 'good', stage: 'Flowering', issues: ['Weeds'], notes: 'Weeded half of the north field.', irrigation: 'Rain-fed' });
    put('record', { kind: 'crop_review', itemType: 'crop', itemId: tomato.id, itemName: 'Tomato', date: lastWeek, week: isoWeek(lastWeek), health: 'average', stage: 'Fruiting', issues: ['Leaf spots', 'Yellowing'], notes: 'Lower leaves showing brown spots.', irrigation: 'Irrigated' });
    put('record', { kind: 'fertilizer', itemType: 'crop', itemId: maize.id, itemName: 'Maize', date: lastWeek, week: isoWeek(lastWeek), product: 'NPK 15:15:15', quantity: 100, unit: 'kg', method: 'Side dressing' });
    put('record', { kind: 'livestock_review', itemType: 'livestock', itemId: layers.id, itemName: 'Poultry - Layers', date: todayISO(), week: isoWeek(todayISO()), health: 'good', headCount: 300, births: 0, deaths: 1, sold: 0, symptoms: [], feed: 'Layer mash', feedKg: 36, production: 255, productionUnit: 'eggs/day', notes: 'Laying rate stable.' });
}
