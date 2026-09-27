// Translations. Keys missing in a language fall back to English.
const translations = {
    en: {
        ai_powered: 'AI Powered', overview: 'Overview', weekly_records: 'Weekly Records', crop_health: 'Crop Health',
        livestock: 'Livestock', profit_loss: 'Profit & Loss', settings: 'Settings', ai_farm_mgmt: 'AI-powered farm management system',
        export_report: 'Export Report', new_record: 'New Record', coming_soon: 'Coming soon', logout: 'Log out',
        sub_overview: 'Your farm at a glance', sub_records: 'Every entry from across your farm in one place',
        sub_crops: 'Inventory, weekly reviews, fertilizer & AI diagnosis', sub_livestock: 'Inventory and weekly health reviews',
        sub_finance: 'Revenue and profit tracking is on the way', sub_settings: 'Account, plan, appearance and data',
        crops_tracked: 'Crops Tracked', livestock_head: 'Livestock (head)', needs_attention: 'Needs Attention', reviews_this_week: 'Reviews This Week',
        ai_recommendations: 'AI Recommendations', ai_analysis: 'AI Farm Analysis', farm_overview: 'Farm Overview', weather: 'Weather & 7-Day Forecast',
        upcoming: 'Upcoming', all_records: 'All Records', search_records: 'Search records...', week: 'Week', date: 'Date', type: 'Type', name: 'Name',
        health: 'Health', details: 'Details', actions: 'Actions', no_records: 'No Records Yet', start_tracking: 'Start tracking your farm activities',
        add_record: 'Add Record', inventory: 'Inventory', weekly_report: 'Weekly Report', add_crop: 'Add Crop', add_livestock: 'Add Livestock',
        save: 'Save', cancel: 'Cancel', save_record: 'Save Record', excellent: 'Excellent', good: 'Good', average: 'Average', sick: 'Sick/Diseased',
        language: 'Language', theme: 'Theme', data_management: 'Data Management', danger_zone: 'Danger Zone', clear_all_data: 'Clear All Data',
        export_your_data: 'Export your data', online: 'Online', type_question: 'Type your question...', your_plan: 'Your plan', upgrade_plan: 'Upgrade plan',
        profile: 'Profile', appearance: 'Appearance', notes: 'Notes', status: 'Status', all: 'All', crop: 'Crop', health_status: 'Health Status',
        lang_en: 'English', lang_ha: 'Hausa', lang_yo: 'Yoruba', lang_ig: 'Igbo', ai_diagnosis: 'AI Plant Diagnosis'
    },
    ha: {
        ai_powered: 'AI Mai Ƙarfi', overview: 'Taƙaitawa', weekly_records: 'Rahisanci na Makonni', crop_health: 'Lafiyar Tsirin',
        livestock: 'Dabbobi', profit_loss: 'Ribɗi da Asarar', settings: 'Saituna', ai_farm_mgmt: 'Tsarin Gudanar da Gona mai Amfani da AI',
        new_record: 'Sabon Bayani', coming_soon: 'Yana zuwa nan ba da jimawa ba', ai_recommendations: 'Shawarwar AI', farm_overview: 'Bayani Game da Gona',
        all_records: 'Duk Bayanai', search_records: 'Bincika bayanai...', week: 'Mako', date: 'Kwanan Wata', type: "Nau'in", name: 'Suna',
        health: 'Lafiya', actions: 'Ayyuka', no_records: 'Babu Bayani Tukuna', start_tracking: 'Fara bin diddigin ayyukan gonarka',
        add_record: 'Ƙara Bayani', cancel: 'Soke', save_record: 'Ajiye Bayani', excellent: 'Madalla', good: 'Kyau', average: 'Matsakaici',
        sick: 'Marasa Lafiya', data_management: 'Gudanar da Bayanai', danger_zone: 'Yankin Hadari', clear_all_data: 'Share Duk Bayanai',
        online: 'Kan Layi', type_question: 'Rubuta tambayarka...', notes: 'Bayanai Ƙarin', status: 'Matsayi', crop: 'Tsirin',
        health_status: 'Matsayin Lafiya', language: 'Harshe', lang_en: 'Turanci', lang_ha: 'Hausa', lang_yo: 'Yarbawa', lang_ig: 'Igbo'
    },
    yo: {
        ai_powered: 'AI Agbara', overview: 'Àkópọ̀', weekly_records: 'Akọsilẹ ọsẹ-ọsẹ', crop_health: 'Ilera Eweko', livestock: 'Ohun ọ̀sìn',
        profit_loss: 'Èrè àti Òfo', settings: 'Ètò', ai_farm_mgmt: 'Òṣèlú iṣàgbon fún iṣẹ́ àgbẹ̀ pẹ̀lú AI', new_record: 'Àkọsílẹ̀ Tuntun',
        ai_recommendations: 'Ìmọràn AI', farm_overview: 'Àyẹ̀wò Ilé-ìsàgbon', all_records: 'Gbogbo Àkọsílẹ̀', search_records: 'Wa àkọsílẹ̀...',
        week: 'Ọsẹ', date: 'Ọjọ́', type: 'Oríṣiríṣi', name: 'Orúkọ', health: 'Ilera', actions: 'Iṣẹ́', no_records: 'Kò sí Àkọsílẹ̀',
        start_tracking: 'Bẹ̀rẹ̀ ṣíṣe àmì ìgbésẹ̀ àgbẹ̀ rẹ', add_record: 'Fi Àkọsílẹ̀ kún', cancel: 'Fagilé', save_record: 'Fi Àkọsílẹ̀ Pamọ́',
        excellent: 'Gidi gan-an', good: 'Rere', average: 'Àárẹ̀', sick: 'Àìlera/Àìsàn', data_management: 'Ìsàkóso Dátà',
        danger_zone: 'Agbègbè Ewu', clear_all_data: 'Pa Gbogbo Dátà Rẹ́', online: 'Lórí ayélujára', type_question: 'Tẹ ìbéèrè rẹ...',
        notes: 'Àkíyèsí', status: 'Ipo', crop: 'Eweko', health_status: 'Ipo Ilera', language: 'Èdè',
        lang_en: 'Gẹ̀ẹ́sì', lang_ha: 'Hausa', lang_yo: 'Yorùbá', lang_ig: 'Igbo'
    },
    ig: {
        ai_powered: 'AI Ike', overview: 'Nchịkọta', weekly_records: 'Dekọ kwa izu', crop_health: 'Ahụike Ihe ọkụkụ', livestock: 'Anụ ụlọ',
        profit_loss: 'Uru na Mfu', settings: 'Ntọala', ai_farm_mgmt: 'Usoro nchịkwa ugbo na-akwado site na AI', new_record: 'Dekọ ọhụrụ',
        ai_recommendations: 'Nduzi AI', farm_overview: 'Nchịkọwa Ugbo', all_records: 'Ndekọ niile', search_records: 'Chọọ ndekọ...',
        week: 'Izu', date: 'Ụbọchị', type: 'Ụdị', name: 'Aha', health: 'Ahụike', actions: 'Omume', no_records: 'Enweghị Ndekọ',
        start_tracking: 'Bido ịchọpụta ihe ị na-eme n\'ugbo gị', add_record: 'Tinye Ndekọ', cancel: 'Kagbuo', save_record: 'Chekwaa Ndekọ',
        excellent: 'Ọma nke ukwuu', good: 'Ọma', average: 'Nke etiti', sick: 'Ọrịa', data_management: 'Nchịkwa Data',
        danger_zone: 'Mpaghara Ihe ize ndụ', clear_all_data: 'Hichapụ Data niile', online: "N'ịntanetị", type_question: 'Dee ajụjụ gị...',
        notes: 'Ihe ndetu', status: 'Ọnọdụ', crop: 'Ihe ọkụkụ', health_status: 'Ọnọdụ Ahụike', language: 'Asụsụ',
        lang_en: 'Bekee', lang_ha: 'Hausa', lang_yo: 'Yoruba', lang_ig: 'Igbo'
    }
};

export const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'ha', name: 'Hausa' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'ig', name: 'Igbo' }
];

const KEY = 'agro_lang';

export function getLang() {
    const lang = localStorage.getItem(KEY);
    return translations[lang] ? lang : 'en';
}

export function t(key) {
    const lang = getLang();
    return translations[lang][key] ?? translations.en[key] ?? key;
}

export function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}

export function setLang(lang) {
    if (!translations[lang]) return;
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
    applyI18n();
    window.dispatchEvent(new CustomEvent('agro:lang', { detail: lang }));
}
