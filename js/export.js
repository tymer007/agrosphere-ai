// Exports: branded PDF report, Excel workbook, and a full-data ZIP backup.
// Every file name starts with "agrosphere-ai_" and every document carries the brand inside.
import { db, currentUserId } from './store.js';
import { loadScript, slug, todayISO, fmtDate } from './ui.js';
import { healthLabel } from './catalog.js';
import { kindLabel, describeRecord } from './records.js';
import { CONFIG } from './config.js';

const LIBS = {
    jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
    xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
};

function gather(rangeDays = null) {
    const user = db.get(currentUserId()) || {};
    const profile = db.one('profile') || {};
    const farm = db.one('farm') || {};
    const since = rangeDays ? new Date(Date.now() - rangeDays * 864e5).toISOString().slice(0, 10) : null;
    const records = db.list('record')
        .filter((r) => !since || (r.date || '') >= since)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return {
        user, profile, farm, records,
        crops: db.list('crop'),
        livestock: db.list('livestock'),
        analysis: db.one('analysis'),
        farmName: profile.farmName || `${(user.fullName || 'My').split(' ')[0]}'s Farm`,
        location: farm.location?.address || [profile.city, profile.state, profile.country].filter(Boolean).join(', ') || '-',
        planName: CONFIG.PLANS[user.plan]?.name || 'Free & Demo',
        rangeLabel: rangeDays ? `Last ${rangeDays} days` : 'All time'
    };
}

function fileName(kind, ext, farmName) {
    return `agrosphere-ai_${kind}_${slug(farmName)}_${todayISO()}.${ext}`;
}

function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------- PDF ----------------
async function buildPdf(data) {
    await loadScript(LIBS.jspdf);
    await loadScript(LIBS.autotable);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const green = [5, 150, 105], dark = [6, 78, 59], gold = [245, 158, 11];

    // Header band
    doc.setFillColor(...dark);
    doc.rect(0, 0, W, 34, 'F');
    doc.setFillColor(52, 211, 153);
    doc.circle(20, 17, 8, 'F');
    doc.setFillColor(255, 255, 255);
    doc.ellipse(20, 17, 2.6, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('AGROSPHERE AI', 33, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(251, 191, 36);
    doc.text('AI-POWERED AGRICULTURAL INTELLIGENCE', 33, 21.5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Farm Report', W - 14, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${data.rangeLabel} · Generated ${fmtDate(new Date())}`, W - 14, 21.5, { align: 'right' });

    // Meta
    let y = 44;
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(data.farmName, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`Farmer: ${data.user.fullName || '-'}   ·   Email: ${data.user.email || '-'}   ·   Plan: ${data.planName}`, 14, y + 6);
    doc.text(`Location: ${data.location}`, 14, y + 11);

    // Summary tiles
    y += 18;
    const heads = data.livestock.reduce((s, l) => s + (+l.count || 0), 0);
    const attention = [...data.crops, ...data.livestock].filter((i) => ['sick', 'average'].includes(i.health)).length;
    const tiles = [['Crops tracked', data.crops.length], ['Livestock (head)', heads], ['Needs attention', attention], ['Records in period', data.records.length]];
    const tw = (W - 28 - 9) / 4;
    tiles.forEach(([label, value], i) => {
        const x = 14 + i * (tw + 3);
        doc.setFillColor(236, 253, 245);
        doc.roundedRect(x, y, tw, 18, 2.5, 2.5, 'F');
        doc.setFillColor(...(i === 2 && attention ? gold : green));
        doc.rect(x, y, tw, 1.2, 'F');
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(String(value), x + 4, y + 9.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(75, 85, 99);
        doc.text(label, x + 4, y + 14.5);
    });
    y += 26;

    const section = (title, head, body, empty) => {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(title, 14, y);
        doc.setDrawColor(...green);
        doc.setLineWidth(0.6);
        doc.line(14, y + 1.8, 34, y + 1.8);
        if (!body.length) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text(empty, 14, y + 8);
            y += 16;
            return;
        }
        doc.autoTable({
            startY: y + 4, head: [head], body, theme: 'grid', margin: { left: 14, right: 14, bottom: 18 },
            styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: [229, 231, 235], textColor: [31, 41, 55], overflow: 'linebreak' },
            headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [247, 254, 250] }
        });
        y = doc.lastAutoTable.finalY + 10;
    };

    section('Crops', ['Crop', 'Variety', 'Plot / Area', 'Sown', 'Harvest', 'Stage', 'Health'],
        data.crops.map((c) => [c.name, c.variety || '-', [c.plot, c.area && `${c.area} ${c.areaUnit || ''}`].filter(Boolean).join(' · ') || '-', fmtDate(c.sowDate), fmtDate(c.harvestDate), c.stage || '-', healthLabel(c.health)]),
        'No crops recorded.');
    section('Livestock', ['Type', 'Breed', 'Count', 'Avg age (mo)', 'Purpose', 'Vaccinated', 'Health'],
        data.livestock.map((l) => [l.type, l.breed || '-', l.count ?? '-', l.avgAgeMonths ?? '-', l.purpose || '-', l.vaccinated || '-', healthLabel(l.health)]),
        'No livestock recorded.');
    section(`Weekly records (${data.rangeLabel.toLowerCase()})`, ['Date', 'Wk', 'Type', 'Item', 'Health', 'Details'],
        data.records.map((r) => [fmtDate(r.date), r.week || '-', kindLabel(r.kind), r.itemName || '-', r.health ? healthLabel(r.health) : '-', describeRecord(r)]),
        'No records in this period.');
    section('AI recommendations', ['Priority', 'Recommendation', 'Details'],
        (data.analysis?.recommendations || []).map((r) => [String(r.priority || '').toUpperCase(), r.title, r.detail]),
        'No AI analysis has been run yet.');

    // Footer on every page
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        const H = doc.internal.pageSize.getHeight();
        doc.setDrawColor(229, 231, 235);
        doc.line(14, H - 12, W - 14, H - 12);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(`Agrosphere AI · Farm Report · ${data.farmName}`, 14, H - 7);
        doc.text(`Page ${i} of ${pages}`, W - 14, H - 7, { align: 'right' });
    }
    doc.setProperties({ title: `Agrosphere AI - Farm Report - ${data.farmName}`, author: 'Agrosphere AI', creator: 'Agrosphere AI' });
    return doc;
}

// ---------------- Excel ----------------
async function buildWorkbook(data) {
    await loadScript(LIBS.xlsx);
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: `Agrosphere AI - Farm Data - ${data.farmName}`, Author: 'Agrosphere AI', Company: 'Agrosphere AI' };

    const about = XLSX.utils.aoa_to_sheet([
        ['Agrosphere AI - Farm Data Export'], [],
        ['Farm', data.farmName], ['Farmer', data.user.fullName], ['Email', data.user.email], ['Plan', data.planName],
        ['Location', data.location], ['Period', data.rangeLabel], ['Generated', new Date().toLocaleString()]
    ]);
    about['!cols'] = [{ wch: 14 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(wb, about, 'Agrosphere AI');

    const sheet = (rows, name) => {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No data' }]);
        ws['!cols'] = Object.keys(rows[0] || { Info: 1 }).map((k) => ({ wch: Math.min(50, Math.max(12, k.length + 4)) }));
        XLSX.utils.book_append_sheet(wb, ws, name);
    };
    sheet(data.crops.map((c) => ({ Crop: c.name, Variety: c.variety, Plot: c.plot, Area: c.area, 'Area unit': c.areaUnit, Plants: c.plantCount, 'Sow date': c.sowDate, 'Expected harvest': c.harvestDate, Stage: c.stage, Health: healthLabel(c.health), Irrigation: c.irrigation, 'Last diagnosis': c.lastDiagnosis?.disease || '' })), 'Crops');
    sheet(data.livestock.map((l) => ({ Type: l.type, Breed: l.breed, Count: l.count, 'Avg age (months)': l.avgAgeMonths, Purpose: l.purpose, Housing: l.housing, Vaccinated: l.vaccinated, Health: healthLabel(l.health) })), 'Livestock');
    sheet(data.records.map((r) => ({ Date: r.date, Week: r.week, Type: kindLabel(r.kind), Item: r.itemName, Health: r.health ? healthLabel(r.health) : '', Details: describeRecord(r) })), 'Weekly Records');
    sheet(data.records.filter((r) => r.kind === 'diagnosis').map((r) => ({ Date: r.date, Crop: r.itemName, Disease: r.disease, Severity: r.severity, Confidence: r.confidence, Summary: r.summary, Treatment: r.treatment })), 'AI Diagnoses');
    sheet((data.analysis?.recommendations || []).map((r) => ({ Priority: r.priority, Category: r.category, Recommendation: r.title, Details: r.detail })), 'AI Recommendations');
    return wb;
}

export async function exportPdf(rangeDays = null) {
    const data = gather(rangeDays);
    const doc = await buildPdf(data);
    download(doc.output('blob'), fileName('farm-report', 'pdf', data.farmName));
}

export async function exportExcel(rangeDays = null) {
    const data = gather(rangeDays);
    const wb = await buildWorkbook(data);
    const bytes = window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName('farm-data', 'xlsx', data.farmName));
}

// "Export your data": ZIP with the Excel workbook, the PDF report and raw JSON.
export async function exportAll() {
    const data = gather(null);
    await loadScript(LIBS.jszip);
    const [doc, wb] = await Promise.all([buildPdf(data), buildWorkbook(data)]);
    const zip = new window.JSZip();
    const folder = zip.folder(`agrosphere-ai_data-export_${slug(data.farmName)}_${todayISO()}`);
    folder.file(fileName('farm-data', 'xlsx', data.farmName), window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    folder.file(fileName('farm-report', 'pdf', data.farmName), doc.output('arraybuffer'));

    const user = { ...data.user };
    delete user.passwordHash;
    delete user.salt;
    const raw = db.rawRows().filter((r) => r.userId === currentUserId() && !r.deleted && r.entryType !== 'user');
    folder.file(fileName('raw-data', 'json', data.farmName), JSON.stringify({ app: 'Agrosphere AI', exportedAt: new Date().toISOString(), user, entries: raw }, null, 2));
    folder.file('README.txt', [
        'Agrosphere AI - Data Export',
        '============================',
        `Farm: ${data.farmName}`, `Farmer: ${data.user.fullName} <${data.user.email}>`, `Exported: ${new Date().toLocaleString()}`, '',
        'Files:',
        ' - farm-data .xlsx   : all crops, livestock, weekly records, diagnoses and AI recommendations',
        ' - farm-report .pdf  : printable farm report',
        ' - raw-data .json    : every entry exactly as stored by Agrosphere AI'
    ].join('\n'));
    const blob = await zip.generateAsync({ type: 'blob' });
    download(blob, `agrosphere-ai_data-export_${slug(data.farmName)}_${todayISO()}.zip`);
}
