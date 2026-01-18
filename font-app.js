// Font Preview Gallery App
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
    let fontPaths = [];
    try {
        const resp = await fetch(manifestPath);
        if (resp.ok) {
            const manifest = await resp.json();
            if (Array.isArray(manifest) && manifest.length) {
                fontPaths = manifest;
            }
        } else {
            console.error(`ไม่พบไฟล์ ${manifestPath}`);
            fontTableBody.innerHTML = '<tr><td colspan="4" class="loading-message"><i class="fa fa-exclamation-circle"></i> ไม่พบ manifest.json</td></tr>';
            fontStats.innerHTML = '<i class="fa fa-exclamation-circle"></i> ไม่พบไฟล์ manifest.json';
            return;
        }
    } catch (e) {
        console.error('เกิดข้อผิดพลาด:', e);
        fontTableBody.innerHTML = '<tr><td colspan="4" class="loading-message"><i class="fa fa-exclamation-circle"></i> เกิดข้อผิดพลาด</td></tr>';
        fontStats.innerHTML = '<i class="fa fa-exclamation-circle"></i> เกิดข้อผิดพลาด';
        return;
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
        // แก้ไขชื่อฟอนต์ให้ปลอดภัยสำหรับ CSS - ถ้าขึ้นต้นด้วยตัวเลข ให้เพิ่ม 'font_'
        let safeName = fileName.replace(/[^a-zA-Z0-9]/g, '_');
        if (/^\d/.test(safeName)) {
            safeName = 'font_' + safeName;
        }
        const fontFamilyName = `FontPreview_${safeName}`;

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

    // รอให้ฟอนต์โหลดเสร็จก่อนอัพเดทตาราง
    await waitForFontsToLoad();
    
    // อัพเดทตาราง
    updateTable();

    // อัพเดท stats
    fontCount.textContent = currentFonts.length;
    fontType.textContent = isPersonal ? 'Personal' : 'Free';
    fontStats.innerHTML = `<i class="fa fa-check-circle"></i> โหลดฟอนต์เรียบร้อย ${currentFonts.length} แบบ`;
}

// ฟังก์ชันรอให้ฟอนต์โหลดเสร็จ
async function waitForFontsToLoad() {
    // ใช้ document.fonts API ถ้ามี
    if (document.fonts && document.fonts.ready) {
        try {
            await document.fonts.ready;
            // รอเพิ่มอีกนิดเพื่อให้แน่ใจว่าฟอนต์โหลดเสร็จ
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
            console.warn('Font loading check failed:', e);
            // fallback: รอสักพัก
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } else {
        // fallback สำหรับ browser เก่า
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// ฟังก์ชันตรวจสอบว่าฟอนต์รองรับภาษาไทยหรือไม่
function checkThaiSupport(fontFamily, testText) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // ตั้งค่า canvas
    canvas.width = 200;
    canvas.height = 50;
    
    // วาดด้วยฟอนต์ที่ต้องการทดสอบ
    context.font = `24px '${fontFamily}'`;
    context.fillText(testText, 0, 30);
    const testData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // ล้าง canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // วาดด้วยฟอนต์ fallback (sans-serif)
    context.font = '24px sans-serif';
    context.fillText(testText, 0, 30);
    const fallbackData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // เปรียบเทียบ pixel data
    let differences = 0;
    for (let i = 0; i < testData.length; i++) {
        if (testData[i] !== fallbackData[i]) {
            differences++;
        }
    }
    
    // ถ้ามีความแตกต่างมากกว่า 100 pixels แสดงว่ารองรับภาษาไทย
    return differences > 100;
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
        
        // ตรวจสอบว่าฟอนต์รองรับภาษาไทยหรือไม่
        const supportsThai = checkThaiSupport(font.fontFamily, sampleTextThai);
        
        if (supportsThai) {
            cellThai.style.fontFamily = `'${font.fontFamily}', 'Noto Sans Thai Looped', sans-serif`;
            cellThai.textContent = sampleTextThai;
        } else {
            cellThai.textContent = '-';
            cellThai.style.color = 'var(--text-secondary)';
            cellThai.style.textAlign = 'center';
        }
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
