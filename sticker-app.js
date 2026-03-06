// sticker-app.js - SVG Sticker Creator
import { SVGLoader } from 'https://esm.sh/three@0.168.0/examples/jsm/loaders/SVGLoader.js';

const MSG = document.querySelector('#msg');
const stickerTextEl = document.getElementById('stickerText');
const fontSizeEl = document.getElementById('fontSize');
const textColorCountEl = document.getElementById('textColorCount');
const textColorContainerEl = document.getElementById('textColorContainer');
const exportSVGBtn = document.getElementById('exportSVG');
const stickerPreview = document.getElementById('stickerPreview');
const stickerSvg = document.getElementById('stickerSvg');

const DEFAULT_TEXT_COLORS = ['#000000', '#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2'];

// Font management
let fontBuffer = null;
let opentypeFont = null;

function isLikelyFontBuffer(buf) {
    if (!buf || buf.byteLength < 4) return false;
    const view = new Uint8Array(buf);
    // TTF: starts with 0x00 0x01 0x00 0x00 (or 0x00 0x00 for old versions)
    if (view[0] === 0x00 && view[1] === 0x01) return true;
    // OTF: starts with 0x4F 0x54 0x54 0x4F (OTTO)
    if (view[0] === 0x4F && view[1] === 0x54 && view[2] === 0x54 && view[3] === 0x4F) return true;
    // Font collection: 0x74 0x74 0x63 0x66 (ttcf)
    if (view[0] === 0x74 && view[1] === 0x74 && view[2] === 0x63 && view[3] === 0x66) return true;
    return false;
}

// Load default font (NotoSansLooped)
async function loadDefaultFont() {
    try {
        const resp = await fetch('font/font_free/NotoSansThaiLooped-Regular.ttf');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: Cannot load default font`);
        fontBuffer = await resp.arrayBuffer();
        if (fontBuffer.byteLength === 0) {
            throw new Error('Default font file is empty');
        }
        if (!isLikelyFontBuffer(fontBuffer)) {
            console.error('Default font validation failed. First 4 bytes:', Array.from(new Uint8Array(fontBuffer.slice(0, 4))).map(b => '0x' + b.toString(16).toUpperCase()).join(' '));
            throw new Error('Default font is not a valid TTF/OTF');
        }
        opentypeFont = opentype.parse(fontBuffer);
        MSG.textContent = '✅ โหลดฟอนต์เริ่มต้นสำเร็จ';
    } catch (e) {
        console.error('Error loading default font:', e);
        MSG.textContent = `⚠️ ไม่สามารถโหลดฟอนต์เริ่มต้น: ${e.message}`;
    }
}

async function loadFontFromPath(fontPath) {
    try {
        const resp = await fetch(fontPath);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: Failed to fetch font`);
        const buf = await resp.arrayBuffer();
        if (buf.byteLength === 0) {
            throw new Error('Empty font file');
        }
        if (!isLikelyFontBuffer(buf)) {
            console.error('Font buffer validation failed. First 4 bytes:', Array.from(new Uint8Array(buf.slice(0, 4))).map(b => '0x' + b.toString(16).toUpperCase()).join(' '));
            throw new Error('ไฟล์นี้ไม่ใช่ TTF/OTF ที่ถูกต้อง');
        }
        fontBuffer = buf;
        opentypeFont = opentype.parse(fontBuffer);
        return true;
    } catch (e) {
        console.error('Error loading font from', fontPath, ':', e);
        MSG.textContent = `❌ ข้อผิดพลาด: ${e.message}`;
        return false;
    }
}

// SVG generation functions
function svgFromOpenType(pathData, color = '#000000') {
    return `<path d="${pathData}" fill="${color}"/>`;
}

function toShapesFromSVG(svgString) {
    const loader = new SVGLoader();
    const data = loader.parse(svgString);
    const shapes = [];
    for (const p of data.paths) shapes.push(...SVGLoader.createShapes(p));
    return shapes;
}

function getColorCount() {
    const count = parseInt(textColorCountEl.value, 10);
    if (!Number.isFinite(count)) return 4;
    return Math.max(1, Math.min(6, count));
}

function getActiveTextColors() {
    const colorInputs = textColorContainerEl.querySelectorAll('input[id="textColor"]');
    const colors = Array.from(colorInputs)
        .map(input => input.value)
        .filter(Boolean);
    return colors.length ? colors : ['#000000'];
}

function renderTextColorInputs() {
    const targetCount = getColorCount();
    textColorCountEl.value = String(targetCount);
    const previousColors = getActiveTextColors();

    textColorContainerEl.innerHTML = '';

    for (let i = 0; i < targetCount; i++) {
        const item = document.createElement('div');
        item.className = 'color-input-item';

        const label = document.createElement('span');
        label.textContent = `${i + 1}`;

        const input = document.createElement('input');
        input.type = 'color';
        input.id = 'textColor';
        input.value = previousColors[i] || DEFAULT_TEXT_COLORS[i] || '#000000';
        input.addEventListener('input', updatePreview);

        item.appendChild(label);
        item.appendChild(input);
        textColorContainerEl.appendChild(item);
    }
}

// Generate SVG from text
async function generateSVG() {
    if (!opentypeFont) {
        MSG.textContent = '❌ โปรดโหลดฟอนต์ก่อน';
        return null;
    }

    const text = stickerTextEl.value.trim();
    if (!text) {
        MSG.textContent = '❌ โปรดใส่ข้อความ';
        return null;
    }

    const fontSize = parseFloat(fontSizeEl.value) || 36;
    const textColors = getActiveTextColors();
    const lines = text.split('\n');

    try {
        let svgContent = '';
        let yOffset = fontSize * 1.2;
        let maxWidth = 0;
        let totalHeight = 0;
        let charColorIndex = 0;

        // Generate path for each line
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            let xOffset = 20;
            let lineWidth = 0;

            // Generate paths for each character in the line
            for (const char of line) {
                const textColor = textColors[charColorIndex % textColors.length] || '#000000';
                charColorIndex++;

                try {
                    // Get glyph from font
                    const glyph = opentypeFont.charToGlyph(char);
                    if (!glyph || !glyph.getPath) {
                        continue;
                    }

                    // Get path with positioning
                    const path = glyph.getPath(xOffset, yOffset, fontSize);
                    if (!path.commands || path.commands.length === 0) {
                        // Skip characters with no path
                        const glyph_advance = (glyph.advanceWidth || 0) * (fontSize / opentypeFont.unitsPerEm);
                        xOffset += glyph_advance;
                        lineWidth += glyph_advance;
                        continue;
                    }

                    const pathData = path.toPathData(2);

                    if (pathData) {
                        svgContent += svgFromOpenType(pathData, textColor);
                        svgContent += '\n';
                    }

                    // Move x offset by glyph advance
                    const glyph_advance = (glyph.advanceWidth || 0) * (fontSize / opentypeFont.unitsPerEm);
                    xOffset += glyph_advance;
                    lineWidth += glyph_advance;
                } catch (e) {
                    console.warn(`Error rendering character '${char}':`, e);
                    // Just skip this character and continue
                }
            }

            maxWidth = Math.max(maxWidth, lineWidth);
            yOffset += fontSize * 1.3; // Line spacing
            totalHeight = yOffset;
        }

        if (!svgContent) {
            MSG.textContent = '❌ ไม่สามารถแสดงผลข้อความ';
            return null;
        }

        // Calculate viewBox dimensions with padding
        const padding = 30;
        const viewWidth = maxWidth + (padding * 2);
        const viewHeight = totalHeight + padding;

        // Create complete SVG
        const completeSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}">
    ${svgContent}
</svg>`;

        return { svg: completeSVG, width: viewWidth, height: viewHeight };
    } catch (e) {
        console.error('Error generating SVG:', e);
        MSG.textContent = `❌ ข้อผิดพลาด: ${e.message}`;
        return null;
    }
}

// Update preview
async function updatePreview() {
    const result = await generateSVG();
    if (result) {
        stickerSvg.setAttribute('viewBox', `0 0 ${result.width} ${result.height}`);
        stickerSvg.innerHTML = result.svg.replace(/<svg[^>]*>/i, '').replace(/<\/svg>/i, '');
        stickerPreview.classList.add('visible');
        MSG.textContent = '✅ อัพเดตตัวอย่างสำเร็จ';
    }
}

// Export SVG
async function exportSVGFile() {
    const result = await generateSVG();
    if (!result) return;

    const text = stickerTextEl.value.split('\n')[0] || 'sticker';
    const fileName = `${text.trim().replace(/\s+/g, '_')}_${Date.now()}.svg`;

    // Create blob and download
    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    MSG.textContent = `✅ ดาวน์โหลด ${fileName} สำเร็จ`;
}

// Font dropdown population
async function populateFontDropdown() {
    const listContainer = document.getElementById('fontDropdownList');
    const selectedDiv = document.getElementById('fontDropdownSelected');
    const usePersonalCheckbox = document.getElementById('usePersonalFonts');

    // Move dropdown list to body to prevent stacking context issues
    if (listContainer && listContainer.parentElement.id === 'fontDropdownWrapper') {
        document.body.appendChild(listContainer);
    }

    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    let currentSelectedValue = '';

    async function loadFonts() {
        listContainer.innerHTML = '';
        styleEl.textContent = '';

        // Determine path based on checkbox
        const isPersonal = usePersonalCheckbox.checked;
        const manifestPath = isPersonal ? 'font_personal/manifest.json' : 'font/manifest.json';
        const filterPath = isPersonal ? 'font_personal/' : 'font/font_free/';

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
                listContainer.innerHTML = '<div style="padding:20px;color:var(--text-secondary);">ไม่พบ manifest.json</div>';
                return;
            }
        } catch (e) {
            console.error('Error loading manifest:', e);
            listContainer.innerHTML = '<div style="padding:20px;color:var(--text-secondary);">เกิดข้อผิดพลาดในการโหลดฟอนต์</div>';
            return;
        }

        // Filter by path
        fontPaths = fontPaths.filter(path => path.includes(filterPath));

        // Dedupe and create options
        const seen = new Set();
        let fontIndex = 1;
        let firstItem = null;
        for (const fontPath of fontPaths) {
            if (!fontPath || seen.has(fontPath)) continue;
            seen.add(fontPath);

            const fileName = fontPath.split('/').pop().replace(/\.(ttf|otf)$/i, '');
            let safeName = fileName.replace(/[^a-zA-Z0-9]/g, '_');
            if (/^\d/.test(safeName)) {
                safeName = 'font_' + safeName;
            }
            const fontFamilyName = `StickerFont_${safeName}`;

            const prefix = isPersonal ? 'P' : 'F';
            const fontNumber = String(fontIndex).padStart(2, '0');
            const displayName = `${prefix}${fontNumber} ${fileName}`;
            fontIndex++;

            // Create @font-face rule
            const fontFaceRule = `
                @font-face {
                    font-family: '${fontFamilyName}';
                    src: url('${fontPath}');
                    font-display: swap;
                }
            `;
            styleEl.textContent += fontFaceRule;

            // Create option element
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            item.textContent = displayName;
            item.style.fontFamily = `'${fontFamilyName}', 'Noto Sans Thai Looped', sans-serif`;
            item.dataset.value = fontPath;
            item.dataset.fontName = fileName;

            if (!firstItem) firstItem = item;

            item.addEventListener('click', async () => {
                // Remove previous selection
                listContainer.querySelectorAll('.custom-select-item').forEach(el => {
                    el.classList.remove('selected');
                });

                // Mark as selected
                item.classList.add('selected');

                // Update selected display
                selectedDiv.textContent = displayName;
                selectedDiv.style.fontFamily = `'${fontFamilyName}', 'Noto Sans Thai Looped', sans-serif`;

                // Hide dropdown
                listContainer.style.display = 'none';
                selectedDiv.classList.remove('active');

                // Load font
                const success = await loadFontFromPath(fontPath);

                // Clear file upload
                document.getElementById('fontFile').value = '';

                currentSelectedValue = fontPath;

                if (success) {
                    MSG.textContent = `✅ โหลดฟอนต์: ${fileName}`;
                    await updatePreview();
                }

                // Load CSS font
                try {
                    await document.fonts.load(`16px '${fontFamilyName}'`);
                } catch (e) {
                    console.warn('CSS Font loading check failed:', e);
                }
            });

            listContainer.appendChild(item);
        }

        // Default to the first font in list (F01/P01) on initial load.
        if (!currentSelectedValue && firstItem) {
            firstItem.click();
        }
    }

    // Load fonts on first run
    await loadFonts();

    // Listen for checkbox changes
    usePersonalCheckbox.addEventListener('change', async () => {
        await loadFonts();
    });

    // Toggle dropdown on click
    selectedDiv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isVisible = listContainer.style.display !== 'none';
        listContainer.style.display = isVisible ? 'none' : 'block';
        selectedDiv.classList.toggle('active');

        if (listContainer.style.display !== 'none') {
            const rect = selectedDiv.getBoundingClientRect();
            listContainer.style.left = rect.left + 'px';
            listContainer.style.top = (rect.bottom + 5) + 'px';
            listContainer.style.width = rect.width + 'px';
        }
    });

    // Close dropdown on document click
    document.addEventListener('click', (e) => {
        if (e.target !== selectedDiv && !listContainer.contains(e.target)) {
            listContainer.style.display = 'none';
            selectedDiv.classList.remove('active');
        }
    });
}

// File upload handler
document.getElementById('fontFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const buf = await file.arrayBuffer();
        if (buf.byteLength === 0) {
            throw new Error('ไฟล์ว่างเปล่า');
        }
        if (!isLikelyFontBuffer(buf)) {
            console.error('File validation failed. First 4 bytes:', Array.from(new Uint8Array(buf.slice(0, 4))).map(b => '0x' + b.toString(16).toUpperCase()).join(' '));
            throw new Error('ตัวเลือกต้องเป็น .ttf หรือ .otf ที่ถูกต้อง');
        }
        fontBuffer = buf;
        opentypeFont = opentype.parse(fontBuffer);
        MSG.textContent = `✅ โหลด ${file.name} สำเร็จ`;
        await updatePreview();
    } catch (e) {
        console.error('Error:', e);
        MSG.textContent = `❌ ${e.message}`;
    }
});

// Event listeners
stickerTextEl.addEventListener('input', updatePreview);
fontSizeEl.addEventListener('change', updatePreview);
textColorCountEl.addEventListener('input', async () => {
    renderTextColorInputs();
    await updatePreview();
});
exportSVGBtn.addEventListener('click', exportSVGFile);

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
    MSG.textContent = '⏳ กำลังโหลดฟอนต์...';
    renderTextColorInputs();
    await loadDefaultFont();
    await populateFontDropdown();
    await updatePreview();
});
