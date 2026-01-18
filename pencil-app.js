// pencil-app.js - Pencil Topper Creator with 3D Preview
import * as THREE from 'https://esm.sh/three@0.168.0';
import { OrbitControls } from 'https://esm.sh/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'https://esm.sh/three@0.168.0/examples/jsm/exporters/STLExporter.js';
import { ThreeMFExporter } from './3MFExporter.js';
import { TextGeometry } from 'https://esm.sh/three@0.168.0/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'https://esm.sh/three@0.168.0/examples/jsm/loaders/FontLoader.js';
import { mergeGeometries, mergeVertices } from 'https://esm.sh/three@0.168.0/examples/jsm/utils/BufferGeometryUtils.js';
import { SUBTRACTION, Brush, Evaluator } from 'https://esm.sh/three-bvh-csg@0.0.16';

const MSG = document.querySelector('#msg');
const DIM_TEXT = document.querySelector('#dim-text');

// Font loader
const fontLoader = new FontLoader();
let loadedFont = null;
let opentypeFont = null;

// Load default font (Helvetiker)
fontLoader.load(
    'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
    (font) => {
        loadedFont = font;
        MSG.textContent = '✅ โหลดฟอนต์สำเร็จ';
        createTopper(); // Create initial topper
    },
    undefined,
    (error) => {
        console.error('Error loading font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ';
    }
);

// Scene setup
const canvas = document.querySelector('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f7f8);

const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 2000);
camera.position.set(50, 50, 100);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

// Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 1));
const dir = new THREE.DirectionalLight(0xffffff, 0.75);
dir.position.set(60, -60, 160);
scene.add(dir);

// Grid
const gridHelper = new THREE.GridHelper(100, 10, 0xcccccc, 0xe5e5e5);
scene.add(gridHelper);

// Current meshes
let baseMesh = null;
let lettersMesh = null;

// ============= Font Management =============
const FONT_LIST = [
    'font/iann_b.ttf',
    'font/Better.ttf',
    'font/Butterfly.ttf',
    'font/font_free/Mali-Bold.ttf',
    'font/font_free/Mali-Medium.ttf',
    'font/FREE/BarberChop.otf',
    'font/FREE/Simanja.ttf'
];

let currentFontPath = null;

// Convert opentype.js path to Three.js Shape
function opentypePathToShapes(pathData) {
    const shapes = [];
    const commands = pathData.commands;
    if (!commands || commands.length === 0) return shapes;

    let currentShape = null;
    let currentPath = null;

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        
        if (cmd.type === 'M') {
            if (currentPath) {
                if (currentPath.curves.length > 0) {
                    if (currentShape) {
                        currentShape.holes.push(currentPath);
                    } else {
                        currentShape = currentPath;
                    }
                }
            }
            currentPath = new THREE.Shape();
            currentPath.moveTo(cmd.x, -cmd.y);
        } else if (cmd.type === 'L') {
            if (currentPath) currentPath.lineTo(cmd.x, -cmd.y);
        } else if (cmd.type === 'C') {
            if (currentPath) {
                currentPath.bezierCurveTo(
                    cmd.x1, -cmd.y1,
                    cmd.x2, -cmd.y2,
                    cmd.x, -cmd.y
                );
            }
        } else if (cmd.type === 'Q') {
            if (currentPath) {
                currentPath.quadraticCurveTo(
                    cmd.x1, -cmd.y1,
                    cmd.x, -cmd.y
                );
            }
        } else if (cmd.type === 'Z') {
            if (currentPath && currentPath.curves.length > 0) {
                if (currentShape && currentShape !== currentPath) {
                    currentShape.holes.push(currentPath);
                } else if (!currentShape) {
                    currentShape = currentPath;
                }
                currentPath = null;
            }
        }
    }

    if (currentPath && currentPath.curves.length > 0) {
        if (currentShape && currentShape !== currentPath) {
            currentShape.holes.push(currentPath);
        } else {
            currentShape = currentPath;
        }
    }

    if (currentShape) shapes.push(currentShape);
    return shapes;
}

// Get text shapes from current font
function getTextShapes(text, size) {
    const shapes = [];
    
    if (opentypeFont) {
        // Use opentype.js
        let xOffset = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const glyph = opentypeFont.charToGlyph(char);
            
            if (glyph && glyph.path) {
                const path = glyph.getPath(xOffset, 0, size);
                const glyphShapes = opentypePathToShapes(path);
                shapes.push(...glyphShapes);
                
                if (i < text.length - 1) {
                    const nextChar = text[i + 1];
                    const kerningValue = opentypeFont.getKerningValue(glyph, opentypeFont.charToGlyph(nextChar));
                    xOffset += (glyph.advanceWidth + kerningValue) * size / opentypeFont.unitsPerEm;
                } else {
                    xOffset += glyph.advanceWidth * size / opentypeFont.unitsPerEm;
                }
            }
        }
    } else if (loadedFont) {
        // Use Three.js font
        return loadedFont.generateShapes(text, size);
    }
    
    return shapes;
}

// Create base with hole
function createBase(textShapes, baseHeight, outlineMargin, holeOrientation, holeDiameter, holeX, holeY) {
    // Create offset shape (outline)
    const offsetShapes = [];
    
    for (const shape of textShapes) {
        const points = shape.getPoints();
        const offsetPoints = offsetPath(points, outlineMargin);
        const offsetShape = new THREE.Shape(offsetPoints);
        offsetShapes.push(offsetShape);
    }
    
    // Extrude base
    const baseGeometry = new THREE.ExtrudeGeometry(offsetShapes, {
        depth: baseHeight,
        bevelEnabled: false,
        curveSegments: 12
    });
    
    // Create hole cylinder
    const holeLength = 150;
    const holeGeometry = new THREE.CylinderGeometry(
        holeDiameter / 2,
        holeDiameter / 2,
        holeLength,
        32
    );
    
    // Create base mesh for CSG
    const baseBrush = new Brush(baseGeometry);
    baseBrush.updateMatrixWorld();
    
    // Create hole brush
    const holeBrush = new Brush(holeGeometry);
    
    if (holeOrientation === 'FRONTBACK') {
        // Rotate to cut through front/back (along X axis)
        holeBrush.rotation.z = Math.PI / 2;
        holeBrush.position.set(0, holeY, baseHeight / 2);
    } else {
        // TOPBOTTOM: cut through top/bottom (along Y axis)
        holeBrush.position.set(holeX, 0, baseHeight / 2);
    }
    
    holeBrush.updateMatrixWorld();
    
    // Perform CSG subtraction
    const evaluator = new Evaluator();
    const result = evaluator.evaluate(baseBrush, holeBrush, SUBTRACTION);
    
    // Fix non-manifold edges by merging vertices and converting to non-indexed
    let finalGeometry = result.geometry.clone();
    finalGeometry = mergeVertices(finalGeometry);
    finalGeometry = finalGeometry.toNonIndexed();
    
    return finalGeometry;
}

// Simple offset path (expand)
function offsetPath(points, offset) {
    // Simple offset implementation
    // For production, you'd want a proper offsetting algorithm
    const center = new THREE.Vector2();
    points.forEach(p => {
        center.x += p.x;
        center.y += p.y;
    });
    center.x /= points.length;
    center.y /= points.length;
    
    return points.map(p => {
        const dir = new THREE.Vector2(p.x - center.x, p.y - center.y).normalize();
        return new THREE.Vector2(
            p.x + dir.x * offset,
            p.y + dir.y * offset
        );
    });
}

// Create pencil topper
function createTopper() {
    const nameText = document.querySelector('#nameText').value || 'Mickey';
    const letterHeight = parseFloat(document.querySelector('#letterHeight').value) || 12;
    const letterThickness = parseFloat(document.querySelector('#letterThickness').value) || 1.4;
    const baseHeight = parseFloat(document.querySelector('#baseHeight').value) || 12;
    const outlineMargin = parseFloat(document.querySelector('#outlineMargin').value) || 2.3;
    const holeOrientation = document.querySelector('#holeOrientation').value;
    const holeDiameter = parseFloat(document.querySelector('#holeDiameter').value) || 7.8;
    const holeX = parseFloat(document.querySelector('#holeX').value) || 21;
    const holeY = parseFloat(document.querySelector('#holeY').value) || 4;
    const baseColor = document.querySelector('#baseColor').value;
    const lettersColor = document.querySelector('#lettersColor').value;
    
    if (!nameText) {
        MSG.textContent = '⚠️ กรุณาใส่ชื่อ';
        return;
    }
    
    if (!loadedFont && !opentypeFont) {
        MSG.textContent = '⚠️ กรุณารอโหลดฟอนต์';
        return;
    }
    
    try {
        // Remove old meshes
        if (baseMesh) {
            scene.remove(baseMesh);
            baseMesh.geometry.dispose();
            baseMesh.material.dispose();
            baseMesh = null;
        }
        if (lettersMesh) {
            scene.remove(lettersMesh);
            lettersMesh.geometry.dispose();
            lettersMesh.material.dispose();
            lettersMesh = null;
        }
        
        // Get text shapes
        const textShapes = getTextShapes(nameText, letterHeight);
        
        if (textShapes.length === 0) {
            MSG.textContent = '❌ ไม่สามารถสร้างข้อความได้';
            return;
        }
        
        // Create base with hole
        const baseGeometry = createBase(
            textShapes,
            baseHeight,
            outlineMargin,
            holeOrientation,
            holeDiameter,
            holeX,
            holeY
        );
        
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(baseColor),
            metalness: 0.1,
            roughness: 0.5,
            emissive: new THREE.Color(baseColor),
            emissiveIntensity: 0.15
        });
        
        baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        scene.add(baseMesh);
        
        // Create raised letters
        let lettersGeometry = new THREE.ExtrudeGeometry(textShapes, {
            depth: letterThickness,
            bevelEnabled: false,
            curveSegments: 12
        });
        
        // Fix non-manifold edges for letters
        lettersGeometry = mergeVertices(lettersGeometry);
        lettersGeometry = lettersGeometry.toNonIndexed();
        
        // Position letters on top of base
        lettersGeometry.translate(0, 0, baseHeight);
        
        const lettersMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(lettersColor),
            metalness: 0.1,
            roughness: 0.5,
            emissive: new THREE.Color(lettersColor),
            emissiveIntensity: 0.15
        });
        
        lettersMesh = new THREE.Mesh(lettersGeometry, lettersMaterial);
        scene.add(lettersMesh);
        
        // Update dimension display
        const box = new THREE.Box3();
        box.expandByObject(baseMesh);
        box.expandByObject(lettersMesh);
        const size = box.getSize(new THREE.Vector3());
        DIM_TEXT.textContent = `📐 ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`;
        
        // Adjust camera
        const center = new THREE.Vector3();
        box.getCenter(center);
        controls.target.copy(center);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5;
        camera.position.set(distance * 0.5, distance * 0.5, distance);
        camera.lookAt(center);
        controls.update();
        
        MSG.textContent = '✅ สร้าง Pencil Topper สำเร็จ';
        
    } catch (error) {
        console.error(error);
        MSG.textContent = `❌ เกิดข้อผิดพลาด: ${error.message}`;
    }
}

// Merge meshes for export
function createMergedMesh() {
    const geometries = [];
    
    if (baseMesh) {
        const baseGeo = baseMesh.geometry.clone();
        baseGeo.applyMatrix4(baseMesh.matrix);
        geometries.push(baseGeo);
    }
    
    if (lettersMesh) {
        const lettersGeo = lettersMesh.geometry.clone();
        lettersGeo.applyMatrix4(lettersMesh.matrix);
        geometries.push(lettersGeo);
    }
    
    if (geometries.length === 0) return null;
    
    let mergedGeometry = mergeGeometries(geometries, false);
    mergedGeometry = mergeVertices(mergedGeometry, 0.0001);
    mergedGeometry.computeVertexNormals();
    
    const material = baseMesh ? baseMesh.material.clone() : new THREE.MeshStandardMaterial();
    
    return new THREE.Mesh(mergedGeometry, material);
}

// Export STL
function exportSTL() {
    if (!baseMesh && !lettersMesh) {
        MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
        return;
    }
    
    try {
        const exporter = new STLExporter();
        const shouldMerge = document.querySelector('#mergeGeometry').checked;
        let exportTarget;
        
        if (shouldMerge) {
            const mergedMesh = createMergedMesh();
            if (!mergedMesh) {
                MSG.textContent = '❌ ไม่สามารถรวม geometry ได้';
                return;
            }
            exportTarget = mergedMesh;
        } else {
            const exportScene = new THREE.Scene();
            if (baseMesh) exportScene.add(baseMesh.clone());
            if (lettersMesh) exportScene.add(lettersMesh.clone());
            exportTarget = exportScene;
        }
        
        const stl = exporter.parse(exportTarget);
        const blob = new Blob([stl], { type: 'model/stl' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        const nameText = document.querySelector('#nameText').value || 'pencil_topper';
        const fileName = nameText.replace(/[^\w\u0E00-\u0E7F-]/g, '_');
        a.download = `${fileName}.stl`;
        
        a.click();
        URL.revokeObjectURL(a.href);
        
        if (shouldMerge && exportTarget instanceof THREE.Mesh) {
            exportTarget.geometry.dispose();
            exportTarget.material.dispose();
        }
        
        const mode = shouldMerge ? '(Merged)' : '(Separate)';
        MSG.textContent = `✅ ส่งออก STL สำเร็จ ${mode}`;
    } catch (error) {
        console.error(error);
        MSG.textContent = `❌ ส่งออก STL ไม่สำเร็จ: ${error.message}`;
    }
}

// Export 3MF
async function export3MF() {
    if (!baseMesh && !lettersMesh) {
        MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
        return;
    }
    
    try {
        MSG.textContent = '⏳ กำลังสร้างไฟล์ 3MF...';
        const shouldMerge = document.querySelector('#mergeGeometry').checked;
        let exportTarget;
        
        if (shouldMerge) {
            const mergedMesh = createMergedMesh();
            if (!mergedMesh) {
                MSG.textContent = '❌ ไม่สามารถรวม geometry ได้';
                return;
            }
            exportTarget = mergedMesh;
        } else {
            const exportScene = new THREE.Scene();
            if (baseMesh) exportScene.add(baseMesh.clone());
            if (lettersMesh) exportScene.add(lettersMesh.clone());
            exportTarget = exportScene;
        }
        
        const exporter = new ThreeMFExporter();
        const blob = await exporter.parse(exportTarget);
        
        if (!blob) {
            MSG.textContent = '❌ สร้างไฟล์ 3MF ไม่สำเร็จ';
            return;
        }
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        const nameText = document.querySelector('#nameText').value || 'pencil_topper';
        const fileName = nameText.replace(/[^\w\u0E00-\u0E7F-]/g, '_');
        a.download = `${fileName}.3mf`;
        
        a.click();
        URL.revokeObjectURL(a.href);
        
        if (shouldMerge && exportTarget instanceof THREE.Mesh) {
            exportTarget.geometry.dispose();
            exportTarget.material.dispose();
        }
        
        const mode = shouldMerge ? '(Merged)' : '(Separate)';
        MSG.textContent = `✅ ส่งออก 3MF สำเร็จ ${mode}`;
    } catch (error) {
        console.error(error);
        MSG.textContent = `❌ ส่งออก 3MF ไม่สำเร็จ: ${error.message}`;
    }
}

// Font dropdown (same as tag-app.js)
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
    
    async function loadFonts() {
        // ลบรายการเดิม
        listContainer.innerHTML = '';
        styleEl.textContent = '';
        
        // กำหนด path ตามการเลือก
        const isPersonal = usePersonalCheckbox.checked;
        const manifestPath = isPersonal ? 'font_personal/manifest.json' : 'font/manifest.json';
        const filterPath = isPersonal ? 'font_personal/' : 'font/font_free/';
        
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
        
        const seen = new Set();
        for (const fontPath of fontPaths) {
            if (!fontPath || seen.has(fontPath)) continue;
            seen.add(fontPath);
            const fileName = fontPath.split('/').pop().replace(/\.(ttf|otf)$/i, '');
            const fontFamilyName = `FontPreview_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            const fontFaceRule = `
                @font-face {
                    font-family: '${fontFamilyName}';
                    src: url('${fontPath}');
                    font-display: swap;
                }
            `;
            styleEl.textContent += fontFaceRule;
            
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            item.textContent = fileName;
            item.style.fontFamily = `'${fontFamilyName}', 'Noto Sans Thai Looped', sans-serif`;
            item.dataset.value = fontPath;
            item.dataset.fontName = fileName;
            
            item.addEventListener('click', async () => {
                listContainer.querySelectorAll('.custom-select-item').forEach(el => {
                    el.classList.remove('selected');
                });
                
                item.classList.add('selected');
                selectedDiv.textContent = displayName;
                selectedDiv.style.fontFamily = `'${fontFamilyName}', 'Noto Sans Thai Looped', sans-serif`;
                
                listContainer.style.display = 'none';
                selectedDiv.classList.remove('active');
                
                await loadFontFromPath(fontPath);
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
    
    const wrapperDiv = document.getElementById('fontDropdownWrapper');
    selectedDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = listContainer.style.display === 'block';
        listContainer.style.display = isVisible ? 'none' : 'block';
        selectedDiv.classList.toggle('active', !isVisible);
        wrapperDiv.classList.toggle('active', !isVisible);
    });
    
    document.addEventListener('click', () => {
        listContainer.style.display = 'none';
        selectedDiv.classList.remove('active');
        wrapperDiv.classList.remove('active');
    });
}

async function loadFontFromPath(fontPath) {
    MSG.textContent = '⏳ กำลังโหลดฟอนต์...';
    currentFontPath = fontPath;
    
    try {
        const response = await fetch(fontPath);
        const arrayBuffer = await response.arrayBuffer();
        opentypeFont = opentype.parse(arrayBuffer);
        loadedFont = null;
        
        MSG.textContent = `✅ โหลดฟอนต์: ${fontPath.split('/').pop()}`;
        createTopper();
    } catch (error) {
        console.error('Error loading font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ - ใช้ฟอนต์ default';
        opentypeFont = null;
        fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
            (font) => {
                loadedFont = font;
                createTopper();
            }
        );
    }
}

document.getElementById('fontUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    MSG.textContent = '⏳ กำลังโหลดฟอนต์...';
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        opentypeFont = opentype.parse(arrayBuffer);
        loadedFont = null;
        
        MSG.textContent = `✅ โหลดฟอนต์: ${file.name}`;
        currentFontPath = 'custom';
        
        const selectedDiv = document.getElementById('fontDropdownSelected');
        selectedDiv.textContent = file.name.replace(/\.(ttf|otf)$/i, '');
        
        createTopper();
    } catch (error) {
        console.error('Error loading custom font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ';
    }
});

// Event listeners
document.querySelector('#createTopper').addEventListener('click', createTopper);
document.querySelector('#exportSTL').addEventListener('click', exportSTL);
document.querySelector('#export3MF').addEventListener('click', export3MF);

// Auto-update on input change
document.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('input', () => {
        if (baseMesh || lettersMesh) createTopper();
    });
});

// Viewport controls
document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        const box = new THREE.Box3();
        if (baseMesh) box.expandByObject(baseMesh);
        if (lettersMesh) box.expandByObject(lettersMesh);
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5;
        
        if (view === 'top') {
            camera.position.set(center.x, center.y, center.z + distance);
        } else if (view === 'front') {
            camera.position.set(center.x, center.y - distance, center.z);
        } else if (view === 'side') {
            camera.position.set(center.x + distance, center.y, center.z);
        } else if (view === 'iso') {
            camera.position.set(
                center.x + distance * 0.5,
                center.y - distance * 0.5,
                center.z + distance * 0.7
            );
        }
        
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
    });
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    
    controls.update();
    renderer.render(scene, camera);
}

animate();
populateFontDropdown();
