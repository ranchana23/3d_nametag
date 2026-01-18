// Font Preview Gallery App
const FONT_LIST = [
    // Main folder
    'font/365PANIRotFaiDemo-Regular.ttf',
    'font/Better.ttf',
    'font/Butterfly.ttf',
    'font/CkPastaDemo.ttf',
    'font/Comfortaa-VariableFont_wght.ttf',
    'font/DSgalileoTester.ttf',
    'font/Elowen.ttf',
    'font/FC Palette Color Italic.ttf',
    'font/FC Palette Color.ttf',
    'font/FC Palette Italic.ttf',
    'font/FC Palette.ttf',
    'font/Good Love.ttf',
    'font/iann_b.ttf',
    'font/iann.ttf',
    'font/ing.ttf',
    'font/January Payment.ttf',
    'font/maaja ver 1.00.ttf',
    'font/SanamDeklen_chaya.ttf',
    'font/Spookvine.ttf',
    'font/Stencilia-A.ttf',
    'font/SweetHipster-PzlE.ttf',
    'font/Various.ttf',
    // font_free subfolder
    'font/font_free/2005_iannnnnGMO.ttf',
    'font/font_free/2005_iannnnnMTV.ttf',
    'font/font_free/iannnnn-HEN-Bold.ttf',
    'font/font_free/iannnnn-HEN-Regular.ttf',
    'font/font_free/iannnnn-HEN-Thin.ttf',
    'font/font_free/iannnnn-TIGER-Black.ttf',
    'font/font_free/iannnnn-TIGER-Bold.ttf',
    'font/font_free/iannnnn-TIGER-Regular.ttf',
    'font/font_free/iannnnn-TIGER-Thin.ttf',
    'font/font_free/Mali-Bold.ttf',
    'font/font_free/Mali-Medium.ttf',
    'font/font_free/SanamDeklen_chaya.ttf',
    'font/font_free/WDB_Bangna.ttf',
    // FREE subfolder
    'font/FREE/BarberChop.otf',
    'font/FREE/Beaver Punch.otf',
    'font/FREE/Gokhan.ttf',
    'font/FREE/Simanja.ttf'
];

let currentFonts = [];

async function loadFonts() {
    const usePersonalCheckbox = document.getElementById('usePersonalFonts');
    const fontTableBody = document.getElementById('fontTableBody');
    const fontCount = document.getElementById('fontCount');
    const fontType = document.getElementById('fontType');
    const fontStats = document.getElementById('fontStats');

    // แสดง loading
    fontTableBody.innerHTML = `
        <tr>
            <td colspan="4" class="loading-message">
                <i class="fa fa-spinner fa-spin"></i> กำลังโหลดฟอนต์...
            </td>
        </tr>
    `;

    // กำหนด path ตามการเลือก
    const isPersonal = usePersonalCheckbox.checked;
    const manifestPath = isPersonal ? 'font_personal/manifest.json' : 'font/manifest.json';
    const filterPath = isPersonal ? 'font_personal/' : 'font/font_free/';

    // โหลด font list จาก manifest
    let fontPaths = FONT_LIST.slice();
    try {
        const resp = await fetch(manifestPath);
        if (resp.ok) {
            const manifest = await resp.json();
            if (Array.isArray(manifest) && manifest.length) fontPaths = manifest;
        }
    } catch (e) {
        console.warn('No font manifest, falling back to built-in FONT_LIST');
    }

    // Filter เฉพาะฟ้อนต์ตาม path ที่เลือก
    fontPaths = fontPaths.filter(path => path.includes(filterPath));

    // สร้าง @font-face rules
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    currentFonts = [];
    const seen = new Set();
    let fontIndex = 1;

    for (const fontPath of fontPaths) {
        if (!fontPath || seen.has(fontPath)) continue;
        seen.add(fontPath);

        const fileName = fontPath.split('/').pop().replace(/\.(ttf|otf)$/i, '');
        const fontFamilyName = `FontPreview_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // กำหนดหมายเลขกำกับ
        const prefix = isPersonal ? 'P' : 'F';
        const fontNumber = String(fontIndex).padStart(2, '0');
        const displayNumber = `${prefix}${fontNumber}`;

        // สร้าง @font-face rule
        const fontFaceRule = `
            @font-face {
                font-family: '${fontFamilyName}';
                src: url('${fontPath}');
                font-display: swap;
            }
        `;
        styleEl.textContent += fontFaceRule;

        currentFonts.push({
            number: displayNumber,
            name: fileName,
            fontFamily: fontFamilyName,
            path: fontPath
        });

        fontIndex++;
    }

    // อัพเดทตาราง
    updateTable();

    // อัพเดท stats
    fontCount.textContent = currentFonts.length;
    fontType.textContent = isPersonal ? 'Personal' : 'Free';
    fontStats.innerHTML = `<i class="fa fa-check-circle"></i> โหลดฟอนต์เรียบร้อย ${currentFonts.length} แบบ`;
}

function updateTable() {
    const fontTableBody = document.getElementById('fontTableBody');
    const sampleTextThai = document.getElementById('sampleTextThai').value;
    const sampleTextEnglish = document.getElementById('sampleTextEnglish').value;

    if (currentFonts.length === 0) {
        fontTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="loading-message">
                    <i class="fa fa-exclamation-circle"></i> ไม่พบฟอนต์
                </td>
            </tr>
        `;
        return;
    }

    fontTableBody.innerHTML = '';

    for (const font of currentFonts) {
        const row = document.createElement('tr');

        // คอลัมน์ชื่อฟอนต์
        const cellName = document.createElement('td');
        cellName.className = 'font-name';
        cellName.textContent = font.name;
        row.appendChild(cellName);

        // คอลัมน์ลำดับ
        const cellNumber = document.createElement('td');
        cellNumber.className = 'font-number';
        cellNumber.textContent = font.number;
        row.appendChild(cellNumber);

        // คอลัมน์ตัวอย่างภาษาไทย
        const cellThai = document.createElement('td');
        cellThai.className = 'preview-text';
        cellThai.style.fontFamily = `'${font.fontFamily}', 'Noto Sans Thai Looped', sans-serif`;
        cellThai.textContent = sampleTextThai;
        row.appendChild(cellThai);

        // คอลัมน์ตัวอย่างภาษาอังกฤษ
        const cellEnglish = document.createElement('td');
        cellEnglish.className = 'preview-text';
        cellEnglish.style.fontFamily = `'${font.fontFamily}', 'Noto Sans Thai Looped', sans-serif`;
        cellEnglish.textContent = sampleTextEnglish;
        row.appendChild(cellEnglish);

        fontTableBody.appendChild(row);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const usePersonalCheckbox = document.getElementById('usePersonalFonts');
    const refreshBtn = document.getElementById('refreshPreview');
    const sampleTextThai = document.getElementById('sampleTextThai');
    const sampleTextEnglish = document.getElementById('sampleTextEnglish');

    // โหลดฟอนต์ครั้งแรก
    loadFonts();

    // เปลี่ยนระหว่าง Free/Personal
    usePersonalCheckbox.addEventListener('change', () => {
        loadFonts();
    });

    // รีเฟรชตัวอย่าง
    refreshBtn.addEventListener('click', () => {
        updateTable();
    });

    // อัพเดทตารางเมื่อพิมพ์ (optional - real-time update)
    sampleTextThai.addEventListener('input', () => {
        updateTable();
    });

    sampleTextEnglish.addEventListener('input', () => {
        updateTable();
    });
});
