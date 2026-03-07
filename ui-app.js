// สร้างปุ่ม toggle และกล่อง layer-list ถ้ายังไม่มี
window.addEventListener('DOMContentLoaded', () => {
    // ใช้ panel หลักจาก index.html id="layer-list-panel"
    // เพิ่มปุ่ม export STL แยกแต่ละเลเยอร์ไว้ใกล้กับ id="exportSTL"
    const exportSTLBtn = document.getElementById('exportSTL');
    if (exportSTLBtn) {
        let exportByLayerBtn = document.getElementById('exportSTLByLayer');
        if (!exportByLayerBtn) {
            exportByLayerBtn = document.createElement('button');
            exportByLayerBtn.id = 'exportSTLByLayer';
            exportByLayerBtn.textContent = 'Export STL (แยกเลเยอร์)';
            exportByLayerBtn.className = 'btn';
            exportByLayerBtn.style.marginLeft = '8px';
            exportSTLBtn.parentNode.insertBefore(exportByLayerBtn, exportSTLBtn.nextSibling);
        }
        exportByLayerBtn.addEventListener('click', () => {
            exportSTLByLayer();
        });
    }

    // ใช้ panel หลักจาก index.html id="layer-list-panel"
    const panel = document.getElementById('layer-list-panel');
    if (panel) {
        // เพิ่มปุ่ม toggle ถ้ายังไม่มี
        let toggleBtn = document.getElementById('toggle-layer-list');
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'toggle-layer-list';
            toggleBtn.innerHTML = '<i class="fa fa-eye-slash"></i>';
            toggleBtn.title = 'แสดง/ซ่อน';
            toggleBtn.style.fontFamily = "'Noto Sans Thai Looped', sans-serif";
            toggleBtn.style.fontSize = '11px';
            toggleBtn.style.fontWeight = '600';
            toggleBtn.style.padding = '4px 10px';
            toggleBtn.style.background = '#333333';
            toggleBtn.style.color = '#fff';
            toggleBtn.style.border = '1px solid #E5E5E5';
            toggleBtn.style.borderRadius = '8px';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.transition = 'all 0.2s ease';
            toggleBtn.style.float = 'right';
            toggleBtn.style.marginLeft = '6px';
            toggleBtn.style.marginTop = '-2px';
            toggleBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';

            // hover effect
            toggleBtn.addEventListener('mouseenter', () => {
                toggleBtn.style.background = '#555555';
                toggleBtn.style.borderColor = '#333333';
                toggleBtn.style.transform = 'translateY(-1px)';
                toggleBtn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
            });
            toggleBtn.addEventListener('mouseleave', () => {
                toggleBtn.style.background = '#333333';
                toggleBtn.style.borderColor = '#E5E5E5';
                toggleBtn.style.transform = 'translateY(0)';
                toggleBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
            });

            // click event - add เฉพาะครั้งแรกที่สร้างปุ่ม
            toggleBtn.addEventListener('click', () => {
                const list = document.getElementById('layer-list');
                const isHidden = list.style.display === 'none';
                list.style.display = isHidden ? 'block' : 'none';
                toggleBtn.innerHTML = isHidden ? '<i class="fa fa-eye-slash"></i>' : '<i class="fa fa-eye"></i>';
            });

            panel.querySelector('h3').appendChild(toggleBtn);
        }
    }
    
    // เพิ่ม event listener สำหรับ textarea ของข้อความเพื่ออัปเดต line font size UI
    const textInput = document.getElementById('text');
    if (textInput) {
        textInput.addEventListener('input', () => {
            updateLineFontSizeUI();
        });
        // Initialize UI
        updateLineFontSizeUI();
    }
    
    // เพิ่ม event listener สำหรับ totalHeight เพื่ออัปเดต default ของแต่ละบรรทัด
    const totalHeightInput = document.getElementById('totalHeight');
    if (totalHeightInput) {
        totalHeightInput.addEventListener('input', () => {
            updateLineFontSizeUI();
        });
    }
    
    // ==================== PRESET MANAGEMENT ====================
    initPresetSystem();
});

// ==================== PRESET FUNCTIONS ====================
function initPresetSystem() {
    loadPresetList();
    
    // Save Preset
    document.getElementById('savePreset')?.addEventListener('click', () => {
        const name = document.getElementById('presetName')?.value.trim();
        if (!name) {
            alert('กรุณาใส่ชื่อ Preset');
            return;
        }
        
        const preset = getCurrentSettings();
        savePreset(name, preset);
        loadPresetList();
        document.getElementById('presetName').value = '';
        alert(`บันทึก Preset "${name}" สำเร็จ`);
    });
    
    // Load Preset
    document.getElementById('loadPreset')?.addEventListener('click', () => {
        const name = document.getElementById('presetSelect')?.value;
        if (!name) {
            alert('กรุณาเลือก Preset');
            return;
        }
        
        const preset = loadPreset(name);
        if (preset) {
            applySettings(preset);
            alert(`โหลด Preset "${name}" สำเร็จ`);
        }
    });
    
    // Delete Preset
    document.getElementById('deletePreset')?.addEventListener('click', () => {
        const name = document.getElementById('presetSelect')?.value;
        if (!name) {
            alert('กรุณาเลือก Preset');
            return;
        }
        
        if (confirm(`ต้องการลบ Preset "${name}" หรือไม่?`)) {
            deletePreset(name);
            loadPresetList();
            alert(`ลบ Preset "${name}" สำเร็จ`);
        }
    });
    
    // Auto-load on select change
    document.getElementById('presetSelect')?.addEventListener('change', (e) => {
        const name = e.target.value;
        if (name) {
            document.getElementById('presetName').value = name;
        }
    });
}

function getCurrentSettings() {
    // รวบรวมขนาดฟอนต์แต่ละบรรทัด
    const text = document.getElementById('text')?.value || '';
    const lines = text.split('\n');
    const lineFontSizes = {};
    
    if (lines.length > 1) {
        lines.forEach((line, index) => {
            const lineHeightInput = document.getElementById(`lineHeight${index}`);
            if (lineHeightInput && lineHeightInput.value) {
                lineFontSizes[index] = parseFloat(lineHeightInput.value);
            }
        });
    }
    
    return {
        // Text & Font (ไม่เก็บ text เพื่อให้แก้ไขได้)
        // text: ไม่เก็บเพื่อให้ผู้ใช้สามารถพิมพ์ชื่อใหม่ได้
        usePersonalFonts: document.getElementById('usePersonalFonts')?.checked || false,
        
        // Style
        style: document.getElementById('style')?.value || 'raised',
        
        // Size
        baseEnabled: document.getElementById('baseEnabled')?.checked ?? true,
        letterHeight: parseFloat(document.getElementById('letterHeight')?.value) || 1.0,
        baseHeight: parseFloat(document.getElementById('baseHeight')?.value) || 2.0,
        outline: parseFloat(document.getElementById('outline')?.value) || 4.0,
        mmPerUnit: parseFloat(document.getElementById('mmPerUnit')?.value) || 0.25,
        totalWidth: parseFloat(document.getElementById('totalWidth')?.value) || null,
        totalHeight: parseFloat(document.getElementById('totalHeight')?.value) || 13,
        letterSpacing: parseFloat(document.getElementById('letterSpacing')?.value) || 0,
        textStroke: parseFloat(document.getElementById('textStroke')?.value) || 0,
        lineSpacing: parseFloat(document.getElementById('lineSpacing')?.value) || 1.2,
        textAlign: document.getElementById('textAlign')?.value || 'center',
        
        // Per-line font sizes
        lineFontSizes: Object.keys(lineFontSizes).length > 0 ? lineFontSizes : null,
        
        // PNG
        pngExtrudeDepth: parseFloat(document.getElementById('pngExtrudeDepth')?.value) || 2,
        pngTargetWidth: parseFloat(document.getElementById('pngTargetWidth')?.value) || 50,
        
        // SVG
        svgExtrudeDepth: parseFloat(document.getElementById('svgExtrudeDepth')?.value) || 2,
        
        // Cutout
        cornerRadius: parseFloat(document.getElementById('cornerRadius')?.value) || 6.0,
        
        // Ear/Hole
        earEnabled: document.getElementById('earEnabled')?.checked ?? true,
        earSide: document.getElementById('earSide')?.value || 'left',
        earPlacement: document.getElementById('earPlacement')?.value || 'side',
        holeDiameter: parseFloat(document.getElementById('holeDiameter')?.value) || 4.0,
        earRingThickness: parseFloat(document.getElementById('earRingThickness')?.value) || 3.0,
        earAttachOverlap: parseFloat(document.getElementById('earAttachOverlap')?.value) || 2.0,
        earYShift: parseFloat(document.getElementById('earYShift')?.value) || 0.0,
        
        // Colors
        baseColor: document.getElementById('baseColor')?.value || '#ffffff',
        textColor: document.getElementById('textColor')?.value || '#222222',
    };
}

function applySettings(preset) {
    // Text & Font (ไม่โหลด text เพื่อให้ผู้ใช้สามารถพิมพ์ชื่อใหม่ได้)
    // text: ไม่โหลดเพื่อให้ผู้ใช้แก้ไขได้
    if (preset.usePersonalFonts !== undefined) document.getElementById('usePersonalFonts').checked = preset.usePersonalFonts;
    
    // Style
    if (preset.style !== undefined) document.getElementById('style').value = preset.style;
    
    // Size
    if (preset.baseEnabled !== undefined) document.getElementById('baseEnabled').checked = preset.baseEnabled;
    if (preset.letterHeight !== undefined) document.getElementById('letterHeight').value = preset.letterHeight;
    if (preset.baseHeight !== undefined) document.getElementById('baseHeight').value = preset.baseHeight;
    if (preset.outline !== undefined) document.getElementById('outline').value = preset.outline;
    if (preset.mmPerUnit !== undefined) document.getElementById('mmPerUnit').value = preset.mmPerUnit;
    if (preset.totalWidth !== undefined && preset.totalWidth !== null) document.getElementById('totalWidth').value = preset.totalWidth;
    if (preset.totalHeight !== undefined) document.getElementById('totalHeight').value = preset.totalHeight;
    if (preset.letterSpacing !== undefined) document.getElementById('letterSpacing').value = preset.letterSpacing;
    if (preset.textStroke !== undefined) document.getElementById('textStroke').value = preset.textStroke;
    if (preset.lineSpacing !== undefined) document.getElementById('lineSpacing').value = preset.lineSpacing;
    if (preset.textAlign !== undefined) document.getElementById('textAlign').value = preset.textAlign;
    
    // PNG
    if (preset.pngExtrudeDepth !== undefined) document.getElementById('pngExtrudeDepth').value = preset.pngExtrudeDepth;
    if (preset.pngTargetWidth !== undefined) document.getElementById('pngTargetWidth').value = preset.pngTargetWidth;
    
    // SVG
    if (preset.svgExtrudeDepth !== undefined) document.getElementById('svgExtrudeDepth').value = preset.svgExtrudeDepth;
    
    // Cutout
    if (preset.cornerRadius !== undefined) document.getElementById('cornerRadius').value = preset.cornerRadius;
    
    // Ear/Hole
    if (preset.earEnabled !== undefined) document.getElementById('earEnabled').checked = preset.earEnabled;
    if (preset.earSide !== undefined) document.getElementById('earSide').value = preset.earSide;
    if (preset.earPlacement !== undefined) document.getElementById('earPlacement').value = preset.earPlacement;
    if (preset.holeDiameter !== undefined) document.getElementById('holeDiameter').value = preset.holeDiameter;
    if (preset.earRingThickness !== undefined) document.getElementById('earRingThickness').value = preset.earRingThickness;
    if (preset.earAttachOverlap !== undefined) document.getElementById('earAttachOverlap').value = preset.earAttachOverlap;
    if (preset.earYShift !== undefined) document.getElementById('earYShift').value = preset.earYShift;
    
    // Colors
    if (preset.baseColor !== undefined) document.getElementById('baseColor').value = preset.baseColor;
    if (preset.textColor !== undefined) document.getElementById('textColor').value = preset.textColor;
    
    // Update UI first to create line font size inputs
    updateLineFontSizeUI();
    
    // Per-line font sizes (ต้องทำหลัง updateLineFontSizeUI() เพื่อให้ input fields ถูกสร้างก่อน)
    if (preset.lineFontSizes) {
        // รอให้ DOM อัพเดทเสร็จก่อน (ใช้ setTimeout)
        setTimeout(() => {
            Object.keys(preset.lineFontSizes).forEach(index => {
                const input = document.getElementById(`lineHeight${index}`);
                if (input) {
                    input.value = preset.lineFontSizes[index];
                }
            });
        }, 50);
    }
}

function savePreset(name, preset) {
    const presets = JSON.parse(localStorage.getItem('nametag_presets') || '{}');
    presets[name] = {
        ...preset,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem('nametag_presets', JSON.stringify(presets));
}

function loadPreset(name) {
    const presets = JSON.parse(localStorage.getItem('nametag_presets') || '{}');
    return presets[name];
}

function deletePreset(name) {
    const presets = JSON.parse(localStorage.getItem('nametag_presets') || '{}');
    delete presets[name];
    localStorage.setItem('nametag_presets', JSON.stringify(presets));
}

function loadPresetList() {
    const presets = JSON.parse(localStorage.getItem('nametag_presets') || '{}');
    const select = document.getElementById('presetSelect');
    if (!select) return;
    
    // Clear existing options except first one
    select.innerHTML = '<option value="">-- เลือก Preset --</option>';
    
    // Add presets
    Object.keys(presets).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

// ui-app.js — preview + STL export one-piece
import * as THREE from 'https://esm.sh/three@0.168.0';
import { OrbitControls } from 'https://esm.sh/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from './TransformControls.js';
import { STLExporter } from 'https://esm.sh/three@0.168.0/examples/jsm/exporters/STLExporter.js';
import { ThreeMFExporter } from './3MFExporter.js';
// ...existing code...
// ฟังก์ชัน export STL แยกแต่ละเลเยอร์
function exportSTLByLayer() {
    try {
        const textValue = document.querySelector('#text').value || 'nametag';
        const fileName = textValue.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
        const hasVerts = (geom) => geom && geom.attributes && geom.attributes.position && geom.attributes.position.count > 0;
        layers.forEach(layer => {
            if (layer.mesh?.geometry && hasVerts(layer.mesh.geometry)) {
                // apply matrix (scale/transform) ของ mesh ลง geometry ก่อน export
                const geom = layer.mesh.geometry.clone();
                geom.applyMatrix4(layer.mesh.matrixWorld);
                const exporter = new STLExporter();
                const meshForExport = new THREE.Mesh(geom);
                const stl = exporter.parse(meshForExport);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([stl], { type: 'model/stl' }));
                const layerName = layer.name.replace(/[^a-zA-Z0-9ก-๙]/g, '_');
                a.download = `${fileName}_layer_${layerName}.stl`;
                a.click();
                URL.revokeObjectURL(a.href);
            }
        });
        MSG.textContent = '✅ ส่งออก STL แยกแต่ละเลเยอร์สำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ ส่งออก STL แยกเลเยอร์ไม่สำเร็จ';
    }
}
import * as BufferGeometryUtils from 'https://esm.sh/three@0.168.0/examples/jsm/utils/BufferGeometryUtils.js';
import { addPNGExtrudeToScene } from './png-extrude.js';
import { pngToSVG } from './image-tracer-wrapper.js';
import { SVGLoader } from 'https://esm.sh/three@0.168.0/examples/jsm/loaders/SVGLoader.js';

const MM_PER_UNIT_INPUT = document.querySelector('#mmPerUnit');
const MSG = document.querySelector('#msg');

// Scene setup
const canvas = document.querySelector('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f7f8);
const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 2000);

// 👉 เริ่มจาก Top view
camera.position.set(0, 0, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 1));
const dir = new THREE.DirectionalLight(0xffffff, 0.75);
dir.position.set(60, -60, 160);
scene.add(dir);
const grid = new THREE.GridHelper(400, 40, 0xdddddd, 0xeeeeee);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

// ฟังก์ชัน refresh scene ให้แสดงเฉพาะ mesh ที่อยู่ใน layers
function refreshScene() {
    // ลบ mesh ทั้งหมดที่ไม่อยู่ใน layers
    scene.children.forEach(obj => {
        if (obj.isMesh && !layers.some(l => l.mesh === obj)) {
            scene.remove(obj);
        }
    });
    // เพิ่ม mesh เฉพาะที่อยู่ใน layers
    layers.forEach(l => {
        if (!scene.children.includes(l.mesh)) {
            scene.add(l.mesh);
        }
    });
}


// Layer system

let baseMesh = null;
let textMesh = null;
let layers = [];
let layerIdCounter = 1;

function addLayer(mesh, name = "Nametag") {
    const id = layerIdCounter++;
    // ดึงข้อความจาก input เพื่อแสดงในชื่อเลเยอร์
    const textValue = document.querySelector('#text')?.value || '';
    layers.push({ id, name: `${name} (${textValue}) #${id}`, mesh, visible: true });
    scene.add(mesh);
    refreshScene();
    renderLayerList();
}

function renderLayerList() {
    const list = document.getElementById("layer-list");
    if (!list) return;
    list.innerHTML = "";
    layers.forEach(function (layer, idx) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-item';
        // เพิ่ม state สำหรับการแก้ไขชื่อ
        if (!layer.editing) layer.editing = false;
        layerDiv.innerHTML = `
            ${layer.editing
                ? `<input type="text" class="layer-name-input" value="${layer.name}" style="width: 220px; margin-right: 8px;" />`
                : `<span class="layer-name-label" style="width: 220px; margin-right: 8px; display: inline-block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${layer.name}</span>`}
            <button class="edit-name-btn" style="${layer.editing ? 'display:none;' : ''}"><i class="fa fa-pencil"></i></button>
            <button class="save-name-btn" style="${layer.editing ? '' : 'display:none;'}"><i class="fa fa-check"></i></button>
            <button class="show-hide-btn"><i class="fa ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
            <button class="delete-btn"><i class="fa fa-trash"></i></button>
            <button class="move-up-btn"><i class="fa fa-arrow-up"></i></button>
            <button class="move-down-btn"><i class="fa fa-arrow-down"></i></button>
        `;
        // Event: กดปุ่มแก้ไขชื่อ
        layerDiv.querySelector('.edit-name-btn').addEventListener('click', () => {
            layer.editing = true;
            renderLayerList();
        });
        // Event: กดปุ่มบันทึกชื่อ
        layerDiv.querySelector('.save-name-btn').addEventListener('click', () => {
            const nameInput = layerDiv.querySelector('.layer-name-input');
            layer.name = nameInput.value;
            layer.editing = false;
            renderLayerList();
        });
        // Event: กด Enter เพื่อบันทึกชื่อ
        if (layer.editing) {
            const nameInput = layerDiv.querySelector('.layer-name-input');
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    layer.name = nameInput.value;
                    layer.editing = false;
                    renderLayerList();
                }
            });
        }
        // ...existing code...
        // Raycaster for mesh selection
        const raycaster = new THREE.Raycaster();
        let mouse = new THREE.Vector2();
        let currentTransform = null;
        canvas.addEventListener('pointerdown', function (event) {
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            // Prevent selection if TransformControls is currently dragging
            if (currentTransform && currentTransform.dragging) return;
            // Only test visible meshes in layers
            const meshes = layers.filter(l => l.visible).map(l => l.mesh);
            const intersects = raycaster.intersectObjects(meshes);
            if (intersects.length > 0) {
                const mesh = intersects[0].object;
                // Remove previous TransformControls
                if (currentTransform) {
                    scene.remove(currentTransform);
                    currentTransform.dispose();
                    currentTransform = null;
                }
                // Attach TransformControls to selected mesh
                currentTransform = new TransformControls(camera, renderer.domElement);
                currentTransform.attach(mesh);
                scene.add(currentTransform);
                currentTransform.addEventListener('dragging-changed', function (e) {
                    controls.enabled = !e.value;
                    currentTransform.dragging = e.value;
                });
            }
        });
        // Show/hide button
        layerDiv.querySelector('.show-hide-btn').addEventListener('click', function () {
            layer.visible = !layer.visible;
            layer.mesh.visible = layer.visible;
            renderLayerList();
        });
        // Delete button
        layerDiv.querySelector('.delete-btn').addEventListener('click', function () {
            deleteLayer(layer.id);
        });
        // Move up button
        layerDiv.querySelector('.move-up-btn').addEventListener('click', function () {
            if (idx > 0) {
                moveLayer(idx, idx - 1);
            }
        });
        // Move down button
        layerDiv.querySelector('.move-down-btn').addEventListener('click', function () {
            if (idx < layers.length - 1) {
                moveLayer(idx, idx + 1);
            }
        });
        list.appendChild(layerDiv);
    });
    // ลบเลเยอร์ออกจาก scene/layers
    function deleteLayer(id) {
        const idx = layers.findIndex(l => l.id === id);
        if (idx !== -1) {
            const layer = layers[idx];
            if (layer.mesh && layer.mesh.parent) {
                layer.mesh.parent.remove(layer.mesh);
            }
            layers.splice(idx, 1);
            renderLayerList();
        }
    }
}


// Config
function cfg() {
    return {
        style: document.querySelector('#style')?.value || 'raised',
        text: document.querySelector('#text').value || 'Ranchana',
        baseEnabled: document.querySelector('#baseEnabled')?.checked ?? true,
        letterHeight: parseFloat(document.querySelector('#letterHeight').value) || 3.0,
        baseHeight: parseFloat(document.querySelector('#baseHeight').value) || 2.0,
        outline: parseFloat(document.querySelector('#outline').value) || 4.0,
        mmPerUnit: parseFloat(MM_PER_UNIT_INPUT.value) || 0.25,
        // รู
        earPlacement: document.querySelector('#earPlacement')?.value || 'side',
        earEnabled: document.querySelector('#earEnabled')?.checked ?? true,
        earSide: document.querySelector('#earSide').value,
        holeDiameter: parseFloat(document.querySelector('#holeDiameter').value) || 6.0,
        earRingThickness: parseFloat(document.querySelector('#earRingThickness').value) || 2.0,
        earAttachOverlap: parseFloat(document.querySelector('#earAttachOverlap').value) || 2.0,
        earYShift: parseFloat(document.querySelector('#earYShift').value) || 0.0,

        // กว้าง/สูงรวมเป้าหมาย (mm)
        totalWidth: parseFloat(document.querySelector('#totalWidth')?.value),
        totalHeight: parseFloat(document.querySelector('#totalHeight')?.value),
        letterSpacing: parseFloat(document.querySelector('#letterSpacing')?.value) || 0.0,
        lineSpacing: parseFloat(document.querySelector('#lineSpacing')?.value) || 1.2,
        textAlign: document.querySelector('#textAlign')?.value || 'center',

        baseColor: document.querySelector('#baseColor')?.value || '#dddddd',
        textColor: document.querySelector('#textColor')?.value || '#333333',

        textStroke: parseFloat(document.querySelector('#textStroke')?.value) || 0.0,
        // (เฉพาะ Cutout)
        cornerRadius: parseFloat(document.querySelector('#cornerRadius')?.value) || 3.0,



    };
}


// --- Helpers ---
function svgFromOpenType(pathData) {
    return `<svg xmlns="http://www.w3.org/2000/svg">
    <path d="${pathData}" fill="#000"/>
  </svg>`;
}
function toShapesFromSVG(svgString) {
    const loader = new SVGLoader();
    const data = loader.parse(svgString);
    const shapes = [];
    for (const p of data.paths) shapes.push(...SVGLoader.createShapes(p));
    return shapes;
}
function samplePathCommands(commands, step = 12) {
    const contours = [];
    let current = [];
    let penX = 0, penY = 0, startX = 0, startY = 0;
    const add = (x, y) => current.push({ X: x, Y: y });
    for (const c of commands) {
        if (c.type === 'M') { if (current.length) { contours.push(current); current = []; } penX = startX = c.x; penY = startY = c.y; add(penX, penY); }
        else if (c.type === 'L') { penX = c.x; penY = c.y; add(penX, penY); }
        else if (c.type === 'Q') {
            const x0 = penX, y0 = penY;
            for (let i = 1; i <= step; i++) {
                const t = i / step, mt = 1 - t;
                add(mt * mt * x0 + 2 * mt * t * c.x1 + t * t * c.x, mt * mt * y0 + 2 * mt * t * c.y1 + t * t * c.y);
            }
            penX = c.x; penY = c.y;
        }
        else if (c.type === 'C') {
            const x0 = penX, y0 = penY;
            for (let i = 1; i <= step; i++) {
                const t = i / step, mt = 1 - t;
                add(mt ** 3 * x0 + 3 * mt * mt * t * c.x1 + 3 * mt * t * t * c.x2 + t ** 3 * c.x,
                    mt ** 3 * y0 + 3 * mt * mt * t * c.y1 + 3 * mt * t * t * c.y2 + t ** 3 * c.y);
            }
            penX = c.x; penY = c.y;
        }
        else if (c.type === 'Z') { if (current.length) { contours.push(current); current = []; } penX = startX; penY = startY; }
    }
    if (current.length) contours.push(current);
    return contours;
}
function ringToPath(ring) {
    const path = new THREE.Path();
    ring.forEach((p, i) => i ? path.lineTo(p.X, p.Y) : path.moveTo(p.X, p.Y));
    path.closePath();
    return path;
}

/** ออฟเซ็ตคอนทัวร์ของตัวอักษรด้วย Clipper แล้วรวมเป็น Shape พร้อม holes */
function shapesFromOffsetContours(contoursFU, strokeMM, mmPerUnit) {
    const CLIP = 100; // scale ให้เป็น integer
    const delta = (strokeMM / mmPerUnit) * CLIP;

    // 1) Offset ทุกคอนทัวร์
    const off = new ClipperLib.ClipperOffset(2, 0.25);
    for (const con of contoursFU) {
        const path = con.map(pt => ({ X: pt.X * CLIP, Y: pt.Y * CLIP }));
        off.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    }
    const offsetPaths = new ClipperLib.Paths();
    off.Execute(offsetPaths, delta);

    if (!offsetPaths.length) return [];

    // 2) Union เพื่อจัดโครงสร้าง outer/holes
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(offsetPaths, ClipperLib.PolyType.ptSubject, true);
    const polyTree = new ClipperLib.PolyTree();
    clipper.Execute(
        ClipperLib.ClipType.ctUnion,
        polyTree,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );

    // 3) เดินต้นไม้: node ที่ "ไม่ใช่ hole" = outer ring ของ Shape
    const shapes = [];
    function walk(node) {
        const childs = node.Childs();
        for (const ch of childs) {
            if (!ch.IsHole()) {
                // outer
                const outer = ch.Contour().map(pt => ({ X: pt.X / CLIP, Y: pt.Y / CLIP }));
                const shape = polygonToShape(outer);

                // holes = ลูกของ outer ที่เป็นหลุม
                for (const h of ch.Childs()) {
                    if (h.IsHole()) {
                        const hole = h.Contour().map(pt => ({ X: pt.X / CLIP, Y: pt.Y / CLIP }));
                        shape.holes.push(ringToPath(hole));
                        // เกาะกลางในหลุม (ลูกถัดไปของ hole) จะเป็นเกาะใหม่ => ปล่อยให้รอบถัดไป handle
                    }
                }
                shapes.push(shape);
            }
            // เดินต่อ
            walk(ch);
        }
    }
    walk(polyTree);
    return shapes;
}
function roundedRectShapeFU(x, y, w, h, rFU) {
    const s = new THREE.Shape();
    const r = Math.max(0, Math.min(rFU, Math.min(w, h) * 0.5));
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    s.closePath();
    return s;
}

function polygonToShape(poly) {
    const s = new THREE.Shape();
    poly.forEach((p, i) => i ? s.lineTo(p.X, p.Y) : s.moveTo(p.X, p.Y));
    s.closePath();
    return s;
}

// --- Font utils ---
function isLikelyFontBuffer(buf) {
    const u8 = new Uint8Array(buf.slice(0, 4));
    const isTTF = (u8[0] === 0x00 && u8[1] === 0x01 && u8[2] === 0x00 && u8[3] === 0x00);
    const isOTF = (u8[0] === 0x4F && u8[1] === 0x54 && u8[2] === 0x54 && u8[3] === 0x4F);
    return isTTF || isOTF;
}

let fontBuffer = null;
window.currentFont = null; // เก็บ font object ไว้ใช้ใน scaleToTargetHeight (global)

async function loadDefaultFont() {
    if (fontBuffer) return;
    const resp = await fetch('./iann_b.ttf');
    if (!resp.ok) throw new Error(`โหลด iann_b.ttf ไม่ได้ (HTTP ${resp.status})`);
    const buf = await resp.arrayBuffer();
    if (!isLikelyFontBuffer(buf)) throw new Error('ไฟล์ iann_b.ttf ไม่ใช่ TTF/OTF');
    fontBuffer = buf;
    MSG.textContent = 'ใช้ฟอนต์ Default (iann_b.ttf)';
}

async function populateFontDropdown() {
    const listContainer = document.getElementById('fontDropdownList');
    const selectedDiv = document.getElementById('fontDropdownSelected');
    const usePersonalCheckbox = document.getElementById('usePersonalFonts');

    // Move dropdown list to body to prevent stacking context issues
    if (listContainer && listContainer.parentElement.id === 'fontDropdownWrapper') {
        document.body.appendChild(listContainer);
    }

    // สร้าง style element สำหรับ @font-face
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    let currentSelectedValue = '';

    async function loadFonts() {
        // ลบรายการเดิม
        listContainer.innerHTML = '';
        styleEl.textContent = '';

        // กำหนด path ตามการเลือก
        const isPersonal = usePersonalCheckbox.checked;
        const manifestPath = isPersonal ? 'font_personal/manifest.json' : 'font/manifest.json';
        const filterPath = isPersonal ? 'font_personal/' : 'font/font_free/';

        // โหลดจาก manifest.json
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
                listContainer.innerHTML = '<div style="padding:20px;color:var(--text-secondary);">ไม่พบ manifest.json<br>กรุณาสร้างไฟล์ manifest.json ในโฟลเดอร์ฟอนต์</div>';
                return;
            }
        } catch (e) {
            console.error('เกิดข้อผิดพลาดในการโหลด manifest:', e);
            listContainer.innerHTML = '<div style="padding:20px;color:var(--text-secondary);">เกิดข้อผิดพลาดในการโหลดฟอนต์</div>';
            return;
        }

        // Filter เฉพาะฟ้อนต์ตาม path ที่เลือก
        fontPaths = fontPaths.filter(path => path.includes(filterPath));

        // dedupe and normalize
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
            const displayName = `${prefix}${fontNumber} ${fileName}`;
            fontIndex++;

            // สร้าง @font-face rule
            const fontFaceRule = `
                @font-face {
                    font-family: '${fontFamilyName}';
                    src: url('${fontPath}');
                    font-display: swap;
                }
            `;
            styleEl.textContent += fontFaceRule;

            // สร้าง custom option
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            item.textContent = displayName;
            item.style.fontFamily = `'${fontFamilyName}', 'Noto Sans Thai Looped', sans-serif`;
            item.dataset.value = fontPath;
            item.dataset.fontName = fileName;

            // Click event
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

                // Load font สำหรับ opentype.js (สำหรับสร้าง 3D)
                const success = await loadFontFromPath(fontPath);

                // Clear file upload
                document.getElementById('font').value = '';

                currentSelectedValue = fontPath;

                // Auto refresh preview if font loaded successfully
                if (success) {
                    MSG.textContent = '⏳ กำลังอัพเดต preview...';
                    await refresh();
                    MSG.textContent = `✅ ใช้ฟอนต์: ${fileName} และอัพเดต preview แล้ว`;
                }
                
                // รอให้ฟอนต์โหลดเสร็จสำหรับ CSS (แสดงใน dropdown เท่านั้น)
                try {
                    await document.fonts.load(`16px '${fontFamilyName}'`);
                } catch (e) {
                    console.warn('CSS Font loading check failed:', e);
                }
            });

            listContainer.appendChild(item);
        }
    }

    // โหลดฟ้อนต์ครั้งแรก
    await loadFonts();

    // Event listener สำหรับ checkbox
    usePersonalCheckbox.addEventListener('change', async () => {
        await loadFonts();
        selectedDiv.textContent = '-- เลือกฟอนต์ --';
        selectedDiv.style.fontFamily = "'Noto Sans Thai Looped', sans-serif";
    });

    // Toggle dropdown with position calculation
    const wrapperDiv = document.getElementById('fontDropdownWrapper');
    selectedDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = listContainer.style.display === 'block';

        if (!isVisible) {
            // Calculate position
            const rect = selectedDiv.getBoundingClientRect();
            listContainer.style.top = `${rect.bottom + 4}px`;
            listContainer.style.left = `${rect.left}px`;
            listContainer.style.width = `${rect.width}px`;
            listContainer.style.display = 'block';
            selectedDiv.classList.add('active');
            wrapperDiv.classList.add('active');
        } else {
            listContainer.style.display = 'none';
            selectedDiv.classList.remove('active');
            wrapperDiv.classList.remove('active');
        }
    });

    // Update position on scroll
    const updateDropdownPosition = () => {
        if (listContainer.style.display === 'block') {
            const rect = selectedDiv.getBoundingClientRect();
            listContainer.style.top = `${rect.bottom + 4}px`;
            listContainer.style.left = `${rect.left}px`;
        }
    };

    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#fontDropdownWrapper')) {
            listContainer.style.display = 'none';
            selectedDiv.classList.remove('active');
            wrapperDiv.classList.remove('active');
        }
    });

    console.log(`✅ สร้าง custom dropdown สำเร็จ`);
}

async function loadFontFromPath(fontPath) {
    try {
        console.log('🔍 กำลังโหลดฟอนต์:', fontPath);
        MSG.textContent = `⏳ กำลังโหลดฟอนต์ ${fontPath}...`;
        const resp = await fetch(fontPath);
        if (!resp.ok) {
            console.error('❌ HTTP Error:', resp.status, resp.statusText);
            throw new Error(`โหลดฟอนต์ไม่ได้ (HTTP ${resp.status})`);
        }
        const buf = await resp.arrayBuffer();
        console.log('✅ ดาวน์โหลดสำเร็จ, ขนาด:', buf.byteLength, 'bytes');
        if (!isLikelyFontBuffer(buf)) {
            console.error('❌ ไฟล์ไม่ใช่ฟอนต์');
            throw new Error('ไฟล์ไม่ใช่ TTF/OTF');
        }
        fontBuffer = buf;
        console.log('✅ ตั้งค่า fontBuffer สำเร็จ');
        const fileName = fontPath.split('/').pop();
        MSG.textContent = `✅ ใช้ฟอนต์: ${fileName}`;
        return true;
    } catch (e) {
        console.error('❌ Error loading font:', e);
        MSG.textContent = `❌ โหลดฟอนต์ไม่สำเร็จ: ${e.message}`;
        return false;
    }
}
// สร้าง UI สำหรับปรับขนาดฟอนต์แต่ละบรรทัด
function updateLineFontSizeUI() {
    const text = document.getElementById('text')?.value || '';
    const lines = text.split('\n');
    const container = document.getElementById('lineFontSizeInputs');
    const controlsDiv = document.getElementById('lineFontSizeControls');
    
    if (!container || !controlsDiv) return;
    
    // ถ้ามีมากกว่า 1 บรรทัด ให้แสดง controls
    if (lines.length > 1) {
        controlsDiv.style.display = 'block';
        container.innerHTML = '';
        
        const defaultFontSize = parseFloat(document.getElementById('totalHeight')?.value) || 13;
        
        lines.forEach((line, index) => {
            const lineDiv = document.createElement('div');
            lineDiv.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
            
            const label = document.createElement('label');
            label.textContent = `บรรทัด ${index + 1}:`;
            label.style.cssText = 'min-width:70px;font-size:13px;';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `lineHeight${index}`;
            input.className = 'line-font-size';
            input.min = '1';
            input.max = '50';
            input.step = '0.5';
            input.value = defaultFontSize;
            input.style.cssText = 'width:70px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);font-size:13px;';
            
            const preview = document.createElement('span');
            preview.textContent = line.substring(0, 20) + (line.length > 20 ? '...' : '');
            preview.style.cssText = 'flex:1;font-size:12px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            
            lineDiv.appendChild(label);
            lineDiv.appendChild(input);
            lineDiv.appendChild(preview);
            container.appendChild(lineDiv);
        });
    } else {
        controlsDiv.style.display = 'none';
    }
}

// รวม path ของข้อความแบบกำหนด letter-spacing (mm) + รองรับ kerning + รองรับหลายบรรทัด + text alignment + per-line font sizes
function buildTextPathWithSpacing(font, text, fontSize, letterSpacingMM, mmPerUnit, lineSpacingMultiplier = 1.2, textAlign = 'center', lineFontSizes = null) {
    const path = new opentype.Path();
    if (!text || !font) return path;

    // แยกบรรทัด
    const lines = text.split('\n');
    
    // letterSpacing ใน "หน่วย path" (font space หลังคูณ fontSize/unitsPerEm)
    // เราทำให้ spacingMM (mm) -> font units โดย spacingFU = mm / mmPerUnit
    // แต่เพราะ getPath ใช้หน่วย path (font units * fontSize/unitsPerEm),
    // เราจะใช้ spacingPath = spacingFU * (fontSize / font.unitsPerEm)
    const spacingFU = letterSpacingMM / mmPerUnit; // font units
    const scale = fontSize / font.unitsPerEm;      // font units -> path units
    const spacingPath = spacingFU * scale;         // path units
    
    // คำนวณ line height (lineSpacingMultiplier ของ fontSize ตามหน่วย path units)
    const lineHeight = fontSize * lineSpacingMultiplier;
    
    // คำนวณความกว้างของแต่ละบรรทัดก่อน (สำหรับ alignment)
    const lineWidths = [];
    const lineHeights = [];
    let maxWidth = 0;
    
    lines.forEach((lineText, lineIndex) => {
        if (!lineText.trim()) {
            lineWidths.push(0);
            lineHeights.push(fontSize * lineSpacingMultiplier);
            return;
        }
        
        // ใช้ font size ของบรรทัดนี้ (ถ้ามี) หรือใช้ default
        const lineFontSize = lineFontSizes && lineFontSizes[lineIndex] ? lineFontSizes[lineIndex] : fontSize;
        const lineScale = lineFontSize / font.unitsPerEm;
        const lineSpacingPathLocal = spacingFU * lineScale;
        
        let lineWidth = 0;
        try {
            const glyphs = font.stringToGlyphs(lineText, { features: {} });
            glyphs.forEach((g, i) => {
                lineWidth += (g.advanceWidth || 0) * lineScale;
                if (i < glyphs.length - 1) {
                    try {
                        const next = glyphs[i + 1];
                        const kernFU = font.getKerningValue ? font.getKerningValue(g, next) : 0;
                        lineWidth += kernFU * lineScale;
                    } catch (e) {}
                }
                lineWidth += lineSpacingPathLocal;
            });
        } catch (e) {}
        
        lineWidths.push(lineWidth);
        lineHeights.push(lineFontSize * lineSpacingMultiplier);
        if (lineWidth > maxWidth) maxWidth = lineWidth;
    });
    
    let currentY = 0;

    // วนลูปแต่ละบรรทัด
    lines.forEach((lineText, lineIndex) => {
        if (!lineText.trim()) {
            // บรรทัดว่าง ให้เว้นบรรทัด
            currentY += lineHeights[lineIndex];
            return;
        }
        
        // ใช้ font size ของบรรทัดนี้
        const lineFontSize = lineFontSizes && lineFontSizes[lineIndex] ? lineFontSizes[lineIndex] : fontSize;
        const lineScale = lineFontSize / font.unitsPerEm;
        const lineSpacingPathLocal = spacingFU * lineScale;
        
        // คำนวณ X offset สำหรับ alignment
        let startX = 0;
        const lineWidth = lineWidths[lineIndex];
        
        if (textAlign === 'center') {
            startX = -lineWidth / 2;
        } else if (textAlign === 'right') {
            startX = -lineWidth;
        }
        // left alignment: startX = 0 (default)

        let glyphs;
        try {
            // ปิด OpenType features ที่อาจทำให้เกิด error
            glyphs = font.stringToGlyphs(lineText, { features: {} });
        } catch (e) {
            console.warn('⚠️ ฟอนต์มี features ที่ไม่รองรับ, ใช้โหมดพื้นฐาน:', e.message);
            // fallback: แปลงเป็น glyphs แบบไม่ใช้ features
            try {
                glyphs = [];
                for (let i = 0; i < lineText.length; i++) {
                    const glyph = font.charToGlyph(lineText.charAt(i));
                    if (glyph) glyphs.push(glyph);
                }
            } catch (e2) {
                console.error('❌ ไม่สามารถแปลงข้อความเป็น glyphs:', e2);
                return;
            }
        }
        
        let x = startX;

        for (let i = 0; i < glyphs.length; i++) {
            const g = glyphs[i];

            // เพิ่ม path ของ glyph นี้
            try {
                const gp = g.getPath(x, currentY, lineFontSize);
                gp.commands.forEach(cmd => path.commands.push(cmd));
            } catch (e) {
                console.warn(`⚠️ ไม่สามารถสร้าง path สำหรับตัวอักษร "${lineText.charAt(i)}":`, e.message);
                // ข้ามตัวอักษรที่มีปัญหา
            }

            // ระยะขยับสำหรับ glyph ถัดไป = advance + kerning + letterSpacing
            let advance = (g.advanceWidth || 0) * lineScale;

            // kerning (ใน font units) -> path units
            if (i < glyphs.length - 1) {
                const next = glyphs[i + 1];
                try {
                    const kernFU = font.getKerningValue ? font.getKerningValue(g, next) : 0; // font units
                    const kernPath = kernFU * lineScale;
                    advance += kernPath;
                } catch (e) {
                    // ถ้า kerning มีปัญหา ก็ข้าม
                }
            }

            // เพิ่ม letter spacing (path units)
            advance += lineSpacingPathLocal;

            x += advance;
        }
        
        // เลื่อน Y ไปบรรทัดถัดไป
        currentY += lineHeights[lineIndex];
    });

    return path;
}

// --- Geometry ---
async function buildGeometries() {
    if (!fontBuffer) await loadDefaultFont();
    
    let font;
    try {
        font = opentype.parse(fontBuffer);
        window.currentFont = font; // เก็บไว้ใช้ใน scaleToTargetHeight
    } catch (e) {
        console.warn('❌ Parse font ครั้งแรกล้มเหลว:', e.message);
        console.log('🔄 ลองใหม่โดยสร้าง font object แบบพื้นฐาน...');
        
        // สร้าง DataView เพื่ออ่าน font
        const dataView = new DataView(fontBuffer);
        
        // อ่าน font โดยข้าม advanced features ที่อาจมีปัญหา
        try {
            // ใช้ opentype.parse แต่ wrap error handling
            const tables = {};
            font = opentype.parse(fontBuffer);
            window.currentFont = font; // เก็บไว้ใช้ใน scaleToTargetHeight
            
            // ถ้ายัง error ก็ให้แจ้ง user
            if (!font) {
                throw new Error('Cannot parse font');
            }
        } catch (e2) {
            console.error('❌ ฟอนต์นี้ใช้งานไม่ได้:', e2.message);
            MSG.textContent = `❌ ฟอนต์นี้ไม่รองรับ กรุณาเลือกฟอนต์อื่น`;
            
            // โหลด default font แทน
            await loadDefaultFont();
            font = opentype.parse(fontBuffer);
            window.currentFont = font; // เก็บไว้ใช้ใน scaleToTargetHeight
            MSG.textContent = '⚠️ ฟอนต์ที่เลือกไม่รองรับ ใช้ฟอนต์ default แทน';
        }
    }
    
    const fontSize = 100;
    const c = cfg();
    
    // คำนวณ scale factor ที่จะถูกใช้ภายหลัง (สำหรับ compensate ขนาดรูแขวน)
    let futureScaleFactor = 1.0;
    
    // Pre-calculate scale factor if totalWidth or totalHeight is set
    // เราจะใช้ค่านี้เพื่อ compensate ขนาดรูแขวนให้คงที่
    if (Number.isFinite(c.totalHeight) && c.totalHeight > 0 && window.currentFont) {
        const font = window.currentFont;
        let capHeight = 0;
        if (font.tables?.os2?.sCapHeight) {
            capHeight = font.tables.os2.sCapHeight;
        } else if (font.ascender) {
            capHeight = font.ascender;
        }
        if (capHeight > 0 && font.unitsPerEm) {
            const capHeightInMM = (capHeight / font.unitsPerEm) * fontSize * c.mmPerUnit;
            futureScaleFactor = c.totalHeight / capHeightInMM;
        }
    } else if (Number.isFinite(c.totalWidth) && c.totalWidth > 0) {
        // ถ้าใช้ totalWidth ต้องคำนวณแบบคร่าวๆ (ยากกว่า ใช้ค่าประมาณ)
        // สำหรับตอนนี้ ถ้าไม่มี totalHeight ก็ใช้ค่า default
        futureScaleFactor = 1.0;
    }

    // helper ภายใน: กรอบมุมโค้ง (หน่วย: FU = font units)
    function roundedRectShapeFU(x, y, w, h, rFU) {
        const s = new THREE.Shape();
        const r = Math.max(0, Math.min(rFU, Math.min(w, h) * 0.5));
        s.moveTo(x + r, y);
        s.lineTo(x + w - r, y);
        s.quadraticCurveTo(x + w, y, x + w, y + r);
        s.lineTo(x + w, y + h - r);
        s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        s.lineTo(x + r, y + h);
        s.quadraticCurveTo(x, y + h, x, y + h - r);
        s.lineTo(x, y + r);
        s.quadraticCurveTo(x, y, x + r, y);
        s.closePath();
        return s;
    }

    // รวบรวม line font sizes (ถ้ามี)
    const lines = c.text.split('\n');
    const lineFontSizes = [];
    let hasCustomLineSizes = false;
    
    lines.forEach((line, index) => {
        const lineHeightInput = document.getElementById(`lineHeight${index}`);
        if (lineHeightInput) {
            lineFontSizes.push(parseFloat(lineHeightInput.value) || fontSize);
            hasCustomLineSizes = true;
        } else {
            lineFontSizes.push(fontSize);
        }
    });
    
    // ใช้ path แบบมี letter spacing, alignment และ per-line font sizes
    const otPath = buildTextPathWithSpacing(
        font, 
        c.text, 
        fontSize, 
        c.letterSpacing, 
        c.mmPerUnit, 
        c.lineSpacing, 
        c.textAlign,
        hasCustomLineSizes ? lineFontSizes : null
    );
    const svg = svgFromOpenType(otPath.toPathData(3));

    // shapes ของตัวอักษร (ยังอยู่ใน FU)
    let letterShapesFU;
    if (Math.abs(c.textStroke) < 1e-6) {
        letterShapesFU = toShapesFromSVG(svg);
    } else {
        const contoursFU = samplePathCommands(otPath.commands, 16);
        letterShapesFU = shapesFromOffsetContours(contoursFU, c.textStroke, c.mmPerUnit);
    }

    // แตกตามสไตล์
    if ((c.style || 'raised') === 'raised') {
        // ===== Raised (พฤติกรรมเดิม) =====
        const textGeom = new THREE.ExtrudeGeometry(letterShapesFU, {
            depth: c.baseHeight + c.letterHeight, bevelEnabled: false, curveSegments: 24, steps: 1
        });
        textGeom.scale(c.mmPerUnit, -c.mmPerUnit, 1);
        textGeom.computeVertexNormals();

        const contours = samplePathCommands(otPath.commands, 16);
        const CLIP = 100;
        const offsetter = new ClipperLib.ClipperOffset(2, 0.25);
        for (const con of contours) {
            offsetter.AddPath(
                con.map(pt => ({ X: pt.X * CLIP, Y: pt.Y * CLIP })),
                ClipperLib.JoinType.jtRound,
                ClipperLib.EndType.etClosedPolygon
            );
        }
        const outPaths = [];
        offsetter.Execute(outPaths, (c.outline / c.mmPerUnit) * CLIP);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const baseShapes = outPaths.map(p => {
            const ptsFU = p.map(pt => ({ X: pt.X / CLIP, Y: pt.Y / CLIP }));
            for (const q of ptsFU) {
                if (q.X < minX) minX = q.X;
                if (q.X > maxX) maxX = q.X;
                if (q.Y < minY) minY = q.Y;
                if (q.Y > maxY) maxY = q.Y;
            }
            return polygonToShape(ptsFU);
        });
        if (c.earEnabled) {
            // Always use mm for ear/hole features, not affected by scaling
            // ปรับขนาดรูแขวนโดย compensate scale factor ที่จะถูกใช้ภายหลัง
            const rHoleMM = (c.holeDiameter * 0.5) / futureScaleFactor;
            const rOuterMM = rHoleMM + (c.earRingThickness / futureScaleFactor);
            const attachMM = c.earAttachOverlap / futureScaleFactor;

            // Calculate center position based on side
            let cxMM, yCenterMM;

            if (c.earSide === 'top') {
                // Top placement: Center X horizontally + shift, Y at top edge
                cxMM = ((minX + maxX) / 2) * c.mmPerUnit + c.earYShift;
                // Note: In SVG coords (Y-down), minY is the "top" visual edge.
                // To place above, we subtract radius (move to smaller Y).
                yCenterMM = (minY * c.mmPerUnit) - rOuterMM + attachMM;
            } else {
                // Side placement (Left/Right)
                yCenterMM = ((minY + maxY) / 2) * c.mmPerUnit + c.earYShift;
                cxMM = (c.earSide === 'right')
                    ? ((maxX * c.mmPerUnit) + rOuterMM - attachMM)
                    : ((minX * c.mmPerUnit) - rOuterMM + attachMM);
            }

            if ((c.earPlacement || 'side') === 'side') {
                // ---------- แบบเดิม: หูด้านข้าง/ด้านบน (นอกกรอบ) ----------
                // Scale all coordinates from mm to FU before creating shape
                const scale = 1 / c.mmPerUnit;
                const earShape = new THREE.Shape();
                earShape.absarc(cxMM * scale, yCenterMM * scale, rOuterMM * scale, 0, Math.PI * 2, false);
                const earHole = new THREE.Path();
                earHole.absarc(cxMM * scale, yCenterMM * scale, rHoleMM * scale, 0, Math.PI * 2, false);
                earShape.holes.push(earHole);
                baseShapes.push(earShape);
            } else {
                // ---------- ใหม่: เจาะรู "ในกรอบ" ----------
                const scale = 1 / c.mmPerUnit;
                const wallMM = c.earRingThickness;

                // Recalculate center for "inside" mode
                let cxMM2, yCenterMM2;

                if (c.earSide === 'top') {
                    cxMM2 = cxMM; // X stays centered
                    // Move down (add Y) to be inside
                    yCenterMM2 = (minY * c.mmPerUnit) + wallMM + rHoleMM;
                } else {
                    yCenterMM2 = yCenterMM; // Y stays centered
                    cxMM2 = (c.earSide === 'right')
                        ? ((maxX * c.mmPerUnit) - wallMM - rHoleMM)
                        : ((minX * c.mmPerUnit) + wallMM + rHoleMM);
                }

                // เจาะรูลงใน shape หลัก: เลือก shape ที่มีพื้นที่มากสุด (มักเป็นชิ้นนอก)
                let targetShape = baseShapes[0];
                if (baseShapes.length > 1) {
                    targetShape = baseShapes.reduce((a, b) =>
                        (a.getArea ? a.getArea() : 0) > (b.getArea ? b.getArea() : 0) ? a : b
                    );
                }
                const inner = new THREE.Path();
                inner.absarc(cxMM2 * scale, yCenterMM2 * scale, rHoleMM * scale, 0, Math.PI * 2, false);
                targetShape.holes.push(inner);
            }
        }


        const baseGeom = new THREE.ExtrudeGeometry(baseShapes, {
            depth: c.baseHeight, bevelEnabled: false, curveSegments: 18, steps: 1
        });
        baseGeom.scale(c.mmPerUnit, -c.mmPerUnit, 1);
        baseGeom.computeVertexNormals();
        // ฐานเริ่มจาก z=0 ขึ้นไป c.baseHeight, ตัวอักษรเริ่มจาก z=c.baseHeight ขึ้นไป
        // ไม่ translate เพื่อให้ฐานอยู่ที่ z>=0

        return { textGeom, baseGeom };

    }
    else {
        // ===== Cutout (ตัวอักษรเป็น "รู" ในกรอบมุมโค้ง) =====


        // 1) หา bbox ตัวอักษรใน FU
        const tmp = new THREE.ExtrudeGeometry(letterShapesFU, { depth: 1, bevelEnabled: false });
        tmp.computeBoundingBox();
        const bb = tmp.boundingBox;
        const wFU = bb.max.x - bb.min.x;
        const hFU = bb.max.y - bb.min.y;

        // 2) ทำกรอบ: ขยาย bbox ด้วย outline (FU) + มุมโค้ง (FU)
        const padFU = c.outline / c.mmPerUnit;
        const xFU = bb.min.x - padFU;
        const yFU = bb.min.y - padFU;
        const w2FU = wFU + padFU * 2;
        const h2FU = hFU + padFU * 2;
        const rFU = (c.cornerRadius || 3) / c.mmPerUnit;

        const frameShapeFU = roundedRectShapeFU(xFU, yFU, w2FU, h2FU, rFU);

        // 3) ใส่ "ตัวอักษร" เป็นรูในกรอบ (เฉพาะ outline) + ขยับตัวอักษรเลี่ยงรูด้านใน ~2 mm
        function pathFromShapeOutline(shape, segments = 96, dx = 0, dy = 0) {
            const pts = shape.getPoints(segments); // เฉพาะเส้นนอก
            const hole = new THREE.Path();
            pts.forEach((p, i) => (i ? hole.lineTo(p.x + dx, p.y + dy) : hole.moveTo(p.x + dx, p.y + dy)));
            hole.closePath();
            return hole;
        }

        // default ไม่ขยับ
        let textOffsetXFU = 0, textOffsetYFU = 0;

        // ถ้าเป็นรู "ในกรอบ" ให้ขยับตัวอักษรหนีรูด้านในประมาณ 2 mm
        if (c.earEnabled && (c.earPlacement || 'side') === 'inside') {
            const keepAwayMM = 5.0;                                 // << ระยะที่อยากเว้น
            const keepAwayFU = keepAwayMM / c.mmPerUnit;

            if (c.earSide === 'top') {
                // Top inside: Move text down (increase Y)
                textOffsetYFU = keepAwayFU;
            } else {
                // ถ้ารูอยู่ขวา -> ขยับตัวอักษรไปทางซ้าย (ค่าลบ), ถ้ารูอยู่ซ้าย -> ขยับไปขวา
                textOffsetXFU = (c.earSide === 'right') ? -keepAwayFU : keepAwayFU;
            }
        }

        for (const s of letterShapesFU) {
            // ✅ เพิ่มเฉพาะ "ขอบนอก" เป็นรู และเลื่อนทั้งก้อนด้วย textOffsetXFU
            frameShapeFU.holes.push(pathFromShapeOutline(s, 96, textOffsetXFU, textOffsetYFU));
        }
        // ❌ อย่า push s.holes (inner counters) เข้าไปซ้ำ


        // 4) รูแขวน—อ้างอิงขนาดกรอบ
        let minX = xFU, maxX = xFU + w2FU, minY = yFU, maxY = yFU + h2FU;
        const baseShapesFU = [frameShapeFU];


        // --- โหมดเจาะรู "ในกรอบ" แบบสะอาด (รูเดียว + เข็มนาฬิกา) ---
        if (c.earEnabled && (c.earPlacement || 'side') === 'inside') {
            const rHole = c.holeDiameter * 0.5;
            const rHoleFU = rHole / c.mmPerUnit;

            // ใช้ earAttachOverlap เป็นระยะห่างจากขอบกรอบ (ซ้อนเข้าฐาน)
            const insetFU = (c.earAttachOverlap / c.mmPerUnit) || 0;

            let cxFU, yCenterFU;

            if (c.earSide === 'top') {
                cxFU = (minX + maxX) / 2 + (c.earYShift / c.mmPerUnit);
                // Top inside: minY + inset + radius
                yCenterFU = minY + insetFU + rHoleFU;
            } else {
                yCenterFU = (minY + maxY) / 2 + (c.earYShift / c.mmPerUnit);
                cxFU = (c.earSide === 'right')
                    ? (maxX - insetFU - rHoleFU)
                    : (minX + insetFU + rHoleFU);
            }

            // รูจริงเพียง "วงเดียว" และทำเป็น clockwise เพื่อเป็น hole ชัดเจน
            const inner = new THREE.Path();
            inner.absarc(cxFU, yCenterFU, rHoleFU, 0, Math.PI * 2, true /* clockwise */);
            frameShapeFU.holes.push(inner);
        }




        // --- โหมดหูด้านข้างเดิม (อยู่หลังจากนี้ตามโค้ดคุณ)
        if (c.earEnabled && (c.earPlacement || 'side') === 'side') {
            // ปรับขนาดรูแขวนโดย compensate scale factor ที่จะถูกใช้ภายหลัง
            const rHole = (c.holeDiameter * 0.5) / futureScaleFactor;
            const rOuter = rHole + (c.earRingThickness / futureScaleFactor);
            const rOuterFU = rOuter / c.mmPerUnit;
            const rHoleFU = rHole / c.mmPerUnit;
            const attachFU = (c.earAttachOverlap / futureScaleFactor) / c.mmPerUnit;

            let cxFU, yCenterFU;

            if (c.earSide === 'top') {
                cxFU = (minX + maxX) / 2 + (c.earYShift / c.mmPerUnit);
                // Top outside: minY - rOuter + attach
                yCenterFU = minY - rOuterFU + attachFU;
            } else {
                yCenterFU = (minY + maxY) / 2 + (c.earYShift / c.mmPerUnit);
                cxFU = (c.earSide === 'right') ? (maxX + rOuterFU - attachFU) : (minX - rOuterFU + attachFU);
            }

            const earShape = new THREE.Shape();
            earShape.absarc(cxFU, yCenterFU, rOuterFU, 0, Math.PI * 2, false);
            const earHole = new THREE.Path();
            earHole.absarc(cxFU, yCenterFU, rHoleFU, 0, Math.PI * 2, false);
            earShape.holes.push(earHole);
            baseShapesFU.push(earShape);
        }


        // 5) Extrude เฉพาะฐาน (text เป็นรู) และคืนค่า textGeom ว่าง
        const baseGeom = new THREE.ExtrudeGeometry(baseShapesFU, {
            depth: c.baseHeight, bevelEnabled: false, curveSegments: 24, steps: 1
        });
        baseGeom.scale(c.mmPerUnit, -c.mmPerUnit, 1);
        baseGeom.computeVertexNormals();
        baseGeom.translate(0, 0, -c.baseHeight);

        const textGeom = new THREE.BufferGeometry(); // ว่างสำหรับ cutout
        return { textGeom, baseGeom };
    }
}

function centerPair(baseGeom, textGeom) {
    // 🔹 clone เฉพาะ geometry ที่มีจริง
    const geoms = [];
    if (baseGeom && baseGeom.attributes?.position) geoms.push(baseGeom.clone());
    if (textGeom && textGeom.attributes?.position?.count > 0) geoms.push(textGeom.clone());

    // ถ้าไม่มี geometry เลย ก็ออก
    if (!geoms.length) return;

    // 🔹 รวมเพื่อหาศูนย์กลาง
    const mergedForCenter = BufferGeometryUtils.mergeGeometries(geoms, false);
    const attr = mergedForCenter.getAttribute('position');
    if (!attr) return; // ป้องกัน null

    const box = new THREE.Box3().setFromBufferAttribute(attr);
    const center = box.getCenter(new THREE.Vector3());

    // 🔹 แปลตำแหน่งเฉพาะชิ้นที่มีจริง
    baseGeom?.translate?.(-center.x, -center.y, -center.z);
    if (textGeom && textGeom.attributes?.position?.count > 0) {
        textGeom.translate(-center.x, -center.y, -center.z);
    }
}


function centerAndMerge(baseGeom, textGeom) {
    const mergedForCenter = BufferGeometryUtils.mergeGeometries([baseGeom.clone(), textGeom.clone()], false);
    const box = new THREE.Box3().setFromBufferAttribute(mergedForCenter.getAttribute('position'));
    const center = box.getCenter(new THREE.Vector3());
    baseGeom.translate(-center.x, -center.y, -center.z);
    textGeom.translate(-center.x, -center.y, -center.z);
    const merged = BufferGeometryUtils.mergeGeometries([baseGeom, textGeom], false);
    merged.computeVertexNormals();
    return merged;
}
function scaleToTargetWidth(baseGeom, textGeom, targetWidthMM) {
    if (!Number.isFinite(targetWidthMM) || targetWidthMM <= 0) return;

    const geoms = [];
    if (baseGeom?.attributes?.position?.count > 0) geoms.push(baseGeom.clone());
    if (textGeom?.attributes?.position?.count > 0) geoms.push(textGeom.clone());
    if (geoms.length === 0) return;

    const mergedTemp = BufferGeometryUtils.mergeGeometries(geoms, false);
    const attr = mergedTemp.getAttribute('position');
    if (!attr) return;

    const box = new THREE.Box3().setFromBufferAttribute(attr);
    const currentWidth = box.max.x - box.min.x;
    if (currentWidth <= 0) return;

    const k = targetWidthMM / currentWidth;

    // สเกลเฉพาะ XY (คงความหนา Z)
    baseGeom.scale(k, k, 1);
    if (textGeom?.attributes?.position?.count > 0) {
        textGeom.scale(k, k, 1);
    }
}
function scaleToTargetHeight(baseGeom, textGeom, targetHeightMM) {
    if (!Number.isFinite(targetHeightMM) || targetHeightMM <= 0) return;

    const geoms = [];
    if (baseGeom?.attributes?.position?.count > 0) geoms.push(baseGeom.clone());
    if (textGeom?.attributes?.position?.count > 0) geoms.push(textGeom.clone());
    if (geoms.length === 0) return;

    const mergedTemp = BufferGeometryUtils.mergeGeometries(geoms, false);
    const attr = mergedTemp.getAttribute('position');
    if (!attr) return;

    // ใช้ bounding box ของ geometry จริง เพื่อคำนวณความสูง
    // นี่จะแม่นยำกว่าเพราะรวมฐาน outline และองค์ประกอบอื่นทั้งหมด
    const box = new THREE.Box3().setFromBufferAttribute(attr);
    const currentHeight = box.max.y - box.min.y;
    
    if (currentHeight <= 0) return;

    const k = targetHeightMM / currentHeight;

    // สเกล X และ Y เท่ากันเพื่อรักษาสัดส่วน (ไม่สเกล Z เพื่อคงความหนา)
    baseGeom.scale(k, k, 1);
    if (textGeom?.attributes?.position?.count > 0) {
        textGeom.scale(k, k, 1);
    }
}


async function refresh() {
    try {
        const { textGeom, baseGeom } = await buildGeometries();

        // สเกลให้ตรงความกว้าง/ความสูงรวม (ถ้ามีกำหนด) — ให้ความสำคัญกับความกว้างก่อน
        const c = cfg();
        if (Number.isFinite(c.totalWidth) && c.totalWidth > 0) {
            scaleToTargetWidth(baseGeom, textGeom, c.totalWidth);
        } else if (Number.isFinite(c.totalHeight) && c.totalHeight > 0) {
            scaleToTargetHeight(baseGeom, textGeom, c.totalHeight);
        }

        // จัดให้อยู่กึ่งกลางร่วม โดย "ไม่" merge
        centerPair(baseGeom, textGeom);

        // ลบของเก่า (ถ้ามี) + เคลียร์เมม
        if (baseMesh) {
            baseMesh.geometry?.dispose?.();
            baseMesh.material?.dispose?.();
            scene.remove(baseMesh);
            baseMesh = null;
        }
        if (textMesh) {
            textMesh.geometry?.dispose?.();
            textMesh.material?.dispose?.();
            scene.remove(textMesh);
            textMesh = null;
        }

        // helper: เช็คว่า geometry มีจุดจริงไหม
        const hasVerts = (g) => g && g.attributes && g.attributes.position && g.attributes.position.count > 0;

        // สร้าง base mesh (เฉพาะเมื่อ baseEnabled เป็น true)
        if (c.baseEnabled && hasVerts(baseGeom)) {
            baseMesh = new THREE.Mesh(
                baseGeom,
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(c.baseColor),
                    metalness: 0.1,
                    roughness: 0.5,
                    emissive: new THREE.Color(c.baseColor),
                    emissiveIntensity: 0.15
                })
            );
            scene.add(baseMesh);
        }

        // สำหรับ raised: มี textGeom; สำหรับ cutout: textGeom อาจว่าง -> ข้าม
        if (hasVerts(textGeom)) {
            textMesh = new THREE.Mesh(
                textGeom,
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(c.textColor),
                    metalness: 0.1,
                    roughness: 0.5,
                    emissive: new THREE.Color(c.textColor),
                    emissiveIntensity: 0.15
                })
            );
            scene.add(textMesh);
        }

        // fit view (ใช้เฉพาะ mesh ที่มีอยู่จริง)
        const tempGroup = new THREE.Group();
        if (baseMesh) tempGroup.add(baseMesh.clone());
        if (textMesh) tempGroup.add(textMesh.clone());

        const box = new THREE.Box3().setFromObject(tempGroup);
        tempGroup.clear();

        // กันกรณี geometry เพิ่งสร้าง/เลขศูนย์
        if (!isFinite(box.min.x) || !isFinite(box.max.x)) {
            MSG.textContent = '❌ ไม่พบ geometry ที่จะแสดง';
            return;
        }

        const sizeVec = box.getSize(new THREE.Vector3());
        const size = sizeVec.length();
        // ขนาดจริง (หน่วย mm) — geometries ถูกสเกลเป็น mm ตอนสร้าง
        const widthMM = Math.max(0, box.max.x - box.min.x);
        const heightMM = Math.max(0, box.max.y - box.min.y);
        const depthMM = Math.max(0, box.max.z - box.min.z);
        // ปัดทศนิยม 2 ตำแหน่ง
        const fmt = (v) => Math.round(v * 100) / 100;
        const dimEl = document.getElementById('dim-text');
        if (dimEl) dimEl.textContent = `${fmt(widthMM)} * ${fmt(heightMM)} * ${fmt(depthMM)} mm`;
        const centroid = box.getCenter(new THREE.Vector3());

        controls.target.copy(centroid);
        camera.near = Math.max(0.1, size / 100);
        camera.far = Math.max(500, size * 10);
        camera.updateProjectionMatrix();

        // Top view
        camera.position.set(centroid.x, centroid.y, centroid.z + size);
        controls.update();

        MSG.textContent = '';
    } catch (e) {
        console.error(e);
        MSG.textContent = 'มีข้อผิดพลาดตอนสร้างโมเดล (ดู Console)';
    }
}


// Render loop
function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
}
renderer.setAnimationLoop(() => { resize(); renderer.render(scene, camera); });

// Viewport controls - สถานะ 1:1
let isRealScale = false;
let currentView = 'front';

// ฟังก์ชันคำนวณ centroid และขนาดโมเดล
function getModelBounds() {
    const tempGroup = new THREE.Group();
    if (baseMesh) tempGroup.add(baseMesh.clone());
    if (textMesh) tempGroup.add(textMesh.clone());
    layers.forEach(layer => {
        if (layer.visible && layer.mesh) {
            tempGroup.add(layer.mesh.clone());
        }
    });
    const box = new THREE.Box3().setFromObject(tempGroup);
    tempGroup.clear();
    return box;
}

// ฟังก์ชันตั้งค่า camera ตามมุมมองและ scale
function setCameraViewAndScale(view, useRealScale) {
    const box = getModelBounds();
    if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;
    
    const centroid = box.getCenter(new THREE.Vector3());
    const sizeVec = box.getSize(new THREE.Vector3());
    
    let distance;
    if (useRealScale) {
        // คำนวณระยะสำหรับ 1:1
        const widthMM = sizeVec.x;
        const heightMM = sizeVec.y;
        const dpi = window.devicePixelRatio * 96;
        const pixelsPerMM = dpi / 25.4;
        const targetWidthPx = widthMM * pixelsPerMM;
        const targetHeightPx = heightMM * pixelsPerMM;
        const maxDimPx = Math.max(targetWidthPx, targetHeightPx);
        const maxDimMM = Math.max(widthMM, heightMM);
        const fov = camera.fov * (Math.PI / 180);
        distance = (maxDimMM / 2) / Math.tan(fov / 2) * (canvas.clientHeight / maxDimPx);
    } else {
        // ใช้ระยะปกติ
        distance = sizeVec.length();
    }
    
    let pos = { x: centroid.x, y: centroid.y, z: centroid.z };
    switch (view) {
        case 'top':
            pos.z += distance;
            break;
        case 'bottom':
            pos.z -= distance;
            break;
        case 'front':
            pos.y -= distance;
            break;
        case 'back':
            pos.y += distance;
            break;
        case 'side':
            pos.x += distance;
            break;
        default:
            pos.y -= distance;
    }
    
    camera.position.set(pos.x, pos.y, pos.z);
    controls.target.copy(centroid);
    controls.update();
}

// Event listeners สำหรับปุ่มมุมมอง
document.querySelectorAll('#viewport-controls button[data-view]').forEach(btn => {
    btn.addEventListener('click', e => {
        currentView = btn.dataset.view;
        setCameraViewAndScale(currentView, isRealScale);
        // If TransformControls is active, update its camera reference
        if (window.currentTransform) {
            window.currentTransform.camera = camera;
        }
    });
});

// Event listener สำหรับปุ่ม 1:1
document.getElementById('scale-100')?.addEventListener('click', () => {
    isRealScale = !isRealScale; // Toggle
    setCameraViewAndScale(currentView, isRealScale);
    
    if (isRealScale) {
        const box = getModelBounds();
        const sizeVec = box.getSize(new THREE.Vector3());
        const btn = document.getElementById('scale-100');
        btn.style.background = '#555555';
        btn.style.borderColor = '#333333';
        MSG.textContent = `✅ แสดงขนาดจริง 1:1 (${Math.round(sizeVec.x * 100) / 100} × ${Math.round(sizeVec.y * 100) / 100} × ${Math.round(sizeVec.z * 100) / 100} mm)`;
    } else {
        const btn = document.getElementById('scale-100');
        btn.style.background = '#333333';
        btn.style.borderColor = '#E5E5E5';
        MSG.textContent = '✅ ปิดโหมด 1:1';
    }
});
// ===== Style UI toggle =====
function applyStyleUI() {
    const style = document.querySelector('#style')?.value || 'raised';
    // ซ่อน/โชว์ทุกส่วนที่มี data-style ให้ตรงกับสไตล์
    document.querySelectorAll('[data-style]').forEach(el => {
        const styles = (el.getAttribute('data-style') || '').split(/\s*,\s*/);
        el.style.display = styles.includes(style) ? '' : 'none';
    });
}

// Events
document.querySelector('#style').addEventListener('input', () => {
    applyStyleUI();
    refresh(); // ใช้โมเดลเดิม เมื่อเป็น raised
});


// Events
document.querySelector('#add').addEventListener('click', async () => {
    try {
        const { textGeom, baseGeom } = await buildGeometries();
        const c = cfg();
        if (Number.isFinite(c.totalWidth) && c.totalWidth > 0) {
            scaleToTargetWidth(baseGeom, textGeom, c.totalWidth);
        } else if (Number.isFinite(c.totalHeight) && c.totalHeight > 0) {
            scaleToTargetHeight(baseGeom, textGeom, c.totalHeight);
        }
        centerPair(baseGeom, textGeom);

        // helper: เช็คว่า geometry มีจุดจริงไหม
        const hasVerts = (g) => g && g.attributes && g.attributes.position && g.attributes.position.count > 0;

        // สร้าง base mesh (ต้องมีเสมอ)
        const meshProps = { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) };
        baseMesh = new THREE.Mesh(
            baseGeom,
            new THREE.MeshStandardMaterial({
                color: new THREE.Color(c.baseColor),
                metalness: 0.1,
                roughness: 0.5,
                emissive: new THREE.Color(c.baseColor),
                emissiveIntensity: 0.15
            })
        );
        // preserve transform if re-adding
        Object.assign(baseMesh.position, meshProps.position);
        Object.assign(baseMesh.rotation, meshProps.rotation);
        Object.assign(baseMesh.scale, meshProps.scale);
        addLayer(baseMesh, "Base");

        // สำหรับ raised: มี textGeom; สำหรับ cutout: textGeom อาจว่าง -> ข้าม
        if (hasVerts(textGeom)) {
            textMesh = new THREE.Mesh(
                textGeom,
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(c.textColor),
                    metalness: 0.1,
                    roughness: 0.5,
                    emissive: new THREE.Color(c.textColor),
                    emissiveIntensity: 0.15
                })
            );
            Object.assign(textMesh.position, meshProps.position);
            Object.assign(textMesh.rotation, meshProps.rotation);
            Object.assign(textMesh.scale, meshProps.scale);
            addLayer(textMesh, "Text");
        }
        MSG.textContent = '✅ เพิ่ม nametag ในเฟรมแล้ว';
    } catch (e) {
        console.error(e);
        MSG.textContent = 'มีข้อผิดพลาดตอนเพิ่ม nametag (ดู Console)';
    }
});

// Preview button - แสดงผลเมื่อกดเท่านั้น
document.querySelector('#preview').addEventListener('click', async () => {
    await refresh();
    
    // ตั้งค่า default: 1:1 และ Top view
    // เปิดโหมด 1:1 ถ้ายังไม่เปิด
    if (!isRealScale) {
        isRealScale = true;
        const btn = document.getElementById('scale-100');
        if (btn) {
            btn.style.background = '#555555';
            btn.style.borderColor = '#333333';
        }
    }
    
    // ตั้งมุมมองเป็น Top
    currentView = 'top';
    setCameraViewAndScale(currentView, isRealScale);
    
    const box = getModelBounds();
    if (isFinite(box.min.x) && isFinite(box.max.x)) {
        const sizeVec = box.getSize(new THREE.Vector3());
        MSG.textContent = `✅ แสดงขนาดจริง 1:1 - Top View (${Math.round(sizeVec.x * 100) / 100} × ${Math.round(sizeVec.y * 100) / 100} × ${Math.round(sizeVec.z * 100) / 100} mm)`;
    }
});

// Size preset buttons (S M L)
document.querySelectorAll('.size-preset').forEach(btn => {
    btn.addEventListener('click', async () => {
        const size = parseInt(btn.dataset.size);
        const totalHeightInput = document.querySelector('#totalHeight');
        if (totalHeightInput) {
            totalHeightInput.value = size;
            // ปรับสีปุ่มที่เลือก
            document.querySelectorAll('.size-preset').forEach(b => {
                b.style.background = '';
                b.style.borderColor = '';
                b.style.color = '';
                b.classList.remove('active');
            });
            btn.style.background = '#333333';
            btn.style.borderColor = '#333333';
            btn.style.color = '#fff';
            btn.classList.add('active');
            
            // Preview ทันที
            await refresh();
            
            // ตั้งค่า default: 1:1 และ Top view
            // เปิดโหมด 1:1 ถ้ายังไม่เปิด
            if (!isRealScale) {
                isRealScale = true;
                const scale100Btn = document.getElementById('scale-100');
                if (scale100Btn) {
                    scale100Btn.style.background = '#555555';
                    scale100Btn.style.borderColor = '#333333';
                }
            }
            
            // ตั้งมุมมองเป็น Top
            currentView = 'top';
            setCameraViewAndScale(currentView, isRealScale);
            
            const box = getModelBounds();
            if (isFinite(box.min.x) && isFinite(box.max.x)) {
                const sizeVec = box.getSize(new THREE.Vector3());
                MSG.textContent = `✅ ขนาด ${size} mm - 1:1 Top View (${Math.round(sizeVec.x * 100) / 100} × ${Math.round(sizeVec.y * 100) / 100} × ${Math.round(sizeVec.z * 100) / 100} mm)`;
            }
        }
    });
});

// Auto-refresh preview when base/ear settings change
const earInputs = [
    '#baseEnabled',
    '#earEnabled',
    '#earSide',
    '#earPlacement',
    '#holeDiameter',
    '#earRingThickness',
    '#earAttachOverlap',
    '#earYShift'
];

earInputs.forEach(selector => {
    const element = document.querySelector(selector);
    if (element) {
        element.addEventListener('change', async () => {
            await refresh();
        });
        // สำหรับ input type number ให้ preview ทันทีเมื่อพิมพ์เสร็จ
        if (element.type === 'number') {
            element.addEventListener('input', async () => {
                await refresh();
            });
        }
    }
});

// ลบ auto-refresh เมื่อ input เปลี่ยนแปลง
// document.querySelectorAll('input,select').forEach(el => {
//     el.addEventListener('input', () => { if (el.id !== 'font') refresh(); });
// });

document.querySelector('#font').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    if (!isLikelyFontBuffer(buf)) { MSG.textContent = '❌ ต้องเป็น .ttf หรือ .otf'; return; }
    fontBuffer = buf; MSG.textContent = `โหลดฟอนต์: ${f.name}`; await refresh();
});
document.querySelector('#exportSTL').addEventListener('click', () => {
    try {
        // Export mesh ทุกตัวที่อยู่ใน scene ที่มี geometry จริง
        const hasVerts = (geom) => geom && geom.attributes && geom.attributes.position && geom.attributes.position.count > 0;
        // apply matrix (scale/transform) ของ mesh ลง geometry ก่อน export
        const geoms = scene.children.filter(obj => obj.isMesh && obj.geometry && hasVerts(obj.geometry)).map(obj => {
            const geom = obj.geometry.clone();
            geom.applyMatrix4(obj.matrixWorld);
            return geom;
        });
        if (geoms.length === 0) {
            MSG.textContent = '❌ ไม่มี geometry ใน scene ที่ให้ส่งออก';
            return;
        }
        const mergedForExport = BufferGeometryUtils.mergeGeometries(geoms, false);
        if (!mergedForExport) {
            MSG.textContent = '❌ รวมชิ้นงานไม่สำเร็จ';
            return;
        }
        const exporter = new STLExporter();
        const mergedMeshForExport = new THREE.Mesh(mergedForExport);
        const stl = exporter.parse(mergedMeshForExport);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([stl], { type: 'model/stl' }));
        const textValue = document.querySelector('#text').value || 'nametag';
        const fileName = textValue.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
        a.download = `${fileName}.stl`;
        a.click();
        URL.revokeObjectURL(a.href);
        MSG.textContent = '✅ ส่งออก STL ทุกชิ้นในเฟรมสำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ ส่งออก STL ไม่สำเร็จ';
    }
});

// เพิ่ม event สำหรับ export 3MF
document.querySelector('#export3MF').addEventListener('click', async () => {
    try {
        // เช็คว่ามี layer อยู่หรือไม่
        if (layers.length === 0) {
            MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
            return;
        }

        MSG.textContent = '⏳ กำลังสร้างไฟล์ 3MF พร้อมสี...';

        // สร้าง scene ชั่วคราวสำหรับ export
        const exportScene = new THREE.Scene();

        // เพิ่มทุก layer ที่มี mesh เข้า scene
        layers.forEach(layer => {
            if (layer.mesh && layer.mesh.geometry) {
                const geom = layer.mesh.geometry.clone();
                geom.applyMatrix4(layer.mesh.matrixWorld);

                // สร้าง material ใหม่ที่มีสีจาก layer
                const mat = new THREE.MeshStandardMaterial({
                    color: layer.mesh.material.color.clone()
                });

                const mesh = new THREE.Mesh(geom, mat);
                mesh.name = layer.name || 'Layer';
                exportScene.add(mesh);
            }
        });

        if (exportScene.children.length === 0) {
            MSG.textContent = '❌ ไม่มี geometry ให้ส่งออก';
            return;
        }

        // ใช้ ThreeMFExporter แบบใหม่ที่รองรับสี
        const exporter = new ThreeMFExporter();
        const blob = await exporter.parse(exportScene);

        if (!blob) {
            MSG.textContent = '❌ สร้างไฟล์ 3MF ไม่สำเร็จ';
            return;
        }

        // Download file
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const textValue = document.querySelector('#text').value || 'nametag';
        const fileName = textValue.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
        a.download = `${fileName}_multicolor.3mf`;
        a.click();
        URL.revokeObjectURL(a.href);

        MSG.textContent = `✅ ส่งออก 3MF พร้อมสี ${layers.length} เลเยอร์สำเร็จ!`;
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ ส่งออก 3MF ไม่สำเร็จ: ' + e.message;
    }
});



// Start

await loadDefaultFont();
populateFontDropdown(); // โหลดรายการฟอนต์ใน dropdown
applyStyleUI();   // ✅ แสดง UI ให้ตรงกับสไตล์เริ่มต้น
// ไม่ต้อง refresh() ตอนเริ่มต้น เพื่อไม่ให้มีเลเยอร์ default

// Font file upload event
document.getElementById('font').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
        // Clear custom dropdown selection
        const selectedDiv = document.getElementById('fontDropdownSelected');
        selectedDiv.textContent = '-- เลือกฟอนต์ --';
        selectedDiv.style.fontFamily = "'Noto Sans Thai Looped', sans-serif";

        // Remove selected class from all items
        document.querySelectorAll('.custom-select-item').forEach(item => {
            item.classList.remove('selected');
        });
    }
});

// PNG Extrude event handler
document.querySelector('#addPngExtrude').addEventListener('click', async () => {
    const fileInput = document.querySelector('#pngUpload');
    const depthInput = document.querySelector('#pngExtrudeDepth');
    const targetWidthInput = document.querySelector('#pngTargetWidth'); // เพิ่ม input สำหรับขนาดจริง (mm)
    const file = fileInput.files?.[0];
    let extrudeDepth = parseFloat(depthInput.value) || 2;
    const mmPerUnit = parseFloat(document.querySelector('#mmPerUnit').value) || 0.25;
    const targetWidthMM = parseFloat(targetWidthInput?.value) || 50; // ค่า default 50mm
    if (!file) {
        MSG.textContent = '❌ กรุณาเลือกไฟล์ PNG ขาวดำก่อน';
        return;
    }
    try {
        MSG.textContent = '⏳ กำลังแปลง PNG เป็น SVG...';
        // อ่านขนาด PNG (pixel)
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
        });
        const pngWidthPx = img.width;
        // Convert PNG to SVG using image-tracer-js
        const svgString = await pngToSVG(file, { ltres: 1, qtres: 1, pathomit: 8, blurradius: 0, numberofcolors: 2 });
        // Parse SVG and extrude using SVGLoader
        const loader = new SVGLoader();
        const svgData = loader.parse(svgString);
        let shapes = [];
        for (const p of svgData.paths) shapes.push(...SVGLoader.createShapes(p));
        // กรอง shape ที่เป็น background (ขอบแผ่น)
        if (shapes.length > 1) {
            const areas = shapes.map(sh => Math.abs(THREE.ShapeUtils.area(sh.getPoints())));
            const maxArea = Math.max(...areas);
            shapes = shapes.filter((s, i) => areas[i] < maxArea * 0.99);
        }
        if (shapes.length === 0) {
            MSG.textContent = '❌ ไม่พบรูปร่างใน SVG';
            return;
        }
        // extrude เฉพาะ shape วัตถุ (ดอกไม้)
        const geometry = new THREE.ExtrudeGeometry(shapes, {
            depth: extrudeDepth,
            bevelEnabled: false,
            steps: 1,
            curveSegments: 24
        });
        geometry.computeVertexNormals();
        geometry.translate(0, 0, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.1,
            roughness: 0.5,
            emissive: 0x222222,
            emissiveIntensity: 0.15
        });
        const mesh = new THREE.Mesh(geometry, material);
        // คำนวณ scale factor จาก targetWidthMM / pngWidthPx แล้วหารด้วย 10 เพื่อให้ขนาด mm ตรงจริง
        const scaleFactor = (targetWidthMM / pngWidthPx);
        mesh.scale.set(scaleFactor, scaleFactor, 1);
        scene.add(mesh);
        refreshScene();
        addLayer(mesh, 'PNG→SVG Extrude');
        // Add TransformControls for interactive scaling
        const transformControls = new TransformControls(camera, renderer.domElement);
        transformControls.attach(mesh);
        transformControls.setMode('translate');
        scene.add(transformControls);
        MSG.textContent = '✅ เพิ่ม PNG Extrude ในเฟรมแล้ว (ปรับขนาดได้ในเฟรม)';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ เพิ่ม PNG Extrude ไม่สำเร็จ';
    }
});
import { addSVGExtrudeToScene } from './svg-extrude.js';

document.querySelector('#addSvgExtrude').addEventListener('click', async () => {
    const fileInput = document.querySelector('#svgUpload');
    const depthInput = document.querySelector('#svgExtrudeDepth');
    const file = fileInput.files?.[0];
    const extrudeDepth = parseFloat(depthInput.value) || 2;
    if (!file) {
        MSG.textContent = '❌ กรุณาเลือกไฟล์ SVG ก่อน';
        return;
    }
    try {
        await addSVGExtrudeToScene({ file, extrudeDepth, scene, addLayer });
        MSG.textContent = '✅ เพิ่ม SVG Extrude ในเฟรมแล้ว';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ เพิ่ม SVG Extrude ไม่สำเร็จ';
    }
});