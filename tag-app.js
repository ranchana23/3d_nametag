// tag-app.js - Rectangle Tag Creator with 3D Preview
import * as THREE from 'https://esm.sh/three@0.168.0';
import { OrbitControls } from 'https://esm.sh/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'https://esm.sh/three@0.168.0/examples/jsm/exporters/STLExporter.js';
import { ThreeMFExporter } from './3MFExporter.js';
import { TextGeometry } from 'https://esm.sh/three@0.168.0/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'https://esm.sh/three@0.168.0/examples/jsm/loaders/FontLoader.js';

const MSG = document.querySelector('#msg');
const DIM_TEXT = document.querySelector('#dim-text');

// Font loader
const fontLoader = new FontLoader();
let loadedFont = null;
let opentypeFont = null; // Store opentype.js font

// Load default font (Helvetiker)
fontLoader.load(
    'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    (font) => {
        loadedFont = font;
        MSG.textContent = '✅ โหลดฟอนต์สำเร็จ';
    },
    undefined,
    (error) => {
        console.error('Error loading font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ (ข้อความจะไม่แสดง)';
    }
);

// Scene setup
const canvas = document.querySelector('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f7f8);

const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 2000);
camera.position.set(0, 0, 200);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

// Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 1));
const dir = new THREE.DirectionalLight(0xffffff, 0.75);
dir.position.set(60, -60, 160);
scene.add(dir);

// Grid
const grid = new THREE.GridHelper(400, 40, 0xdddddd, 0xeeeeee);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

// Current mesh
let currentMesh = null;
let textMesh = null;

// Create rounded rectangle shape
function createRoundedRectShape(width, length, radius) {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -length / 2;
    const w = width;
    const h = length;
    const r = Math.min(radius, Math.min(w, h) * 0.5);

    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    shape.closePath();

    return shape;
}

// Create rectangle with optional hole
function createRectangle() {
    const width = parseFloat(document.querySelector('#rectWidth').value) || 80;
    const length = parseFloat(document.querySelector('#rectLength').value) || 50;
    const height = parseFloat(document.querySelector('#rectHeight').value) || 3;
    const cornerRadius = parseFloat(document.querySelector('#cornerRadius').value) || 5;
    const color = document.querySelector('#rectColor').value || '#696FC7';
    const enableHole = document.querySelector('#enableHole').checked;
    const holeDiameter = parseFloat(document.querySelector('#holeDiameter').value) || 5;
    const holeOffset = parseFloat(document.querySelector('#holeOffset').value) || 8;
    const holeSide = document.querySelector('#holeSide').value; // 'left' or 'right'
    const holePosition = document.querySelector('#holePosition').value; // 'top', 'center', 'bottom'

    try {
        // Create base shape
        const shape = createRoundedRectShape(width, length, cornerRadius);

        // Add hole if enabled
        if (enableHole) {
            const holeRadius = holeDiameter / 2;
            
            // Calculate X position based on side (left/right)
            let holeX;
            if (holeSide === 'left') {
                holeX = -width / 2 + holeOffset;
            } else { // right
                holeX = width / 2 - holeOffset;
            }
            
            // Calculate Y position based on position (top/center/bottom)
            let holeY;
            if (holePosition === 'top') {
                holeY = length / 2 - holeOffset;
            } else if (holePosition === 'center') {
                holeY = 0; // center of the shape
            } else { // bottom
                holeY = -length / 2 + holeOffset;
            }
            
            const holePath = new THREE.Path();
            holePath.absarc(holeX, holeY, holeRadius, 0, Math.PI * 2, true);
            shape.holes.push(holePath);
        }

        // Extrude settings
        const extrudeSettings = {
            depth: height,
            bevelEnabled: false,
            curveSegments: 24,
            steps: 1
        };

        // Create geometry
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.computeVertexNormals();
        
        // Don't rotate geometry - keep it in standard orientation
        // Width=X, Length=Y, Height=Z (extrude direction)
        
        // Center the geometry at origin for better manipulation
        geometry.translate(0, 0, height / 2);

        // Create material
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            metalness: 0.1,
            roughness: 0.5,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.15
        });

        // Remove old mesh
        if (currentMesh) {
            scene.remove(currentMesh);
            currentMesh.geometry.dispose();
            currentMesh.material.dispose();
        }
        if (textMesh) {
            scene.remove(textMesh);
            // Dispose geometry and material for all meshes in the group
            textMesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            textMesh = null;
        }

        // Create and add new mesh
        currentMesh = new THREE.Mesh(geometry, material);
        
        // Apply rotation from controls
        applyRotation();
        
        scene.add(currentMesh);

        // Create text if name is provided and font is loaded
        const tagName = document.querySelector('#tagName').value.trim();
        const fontSize = parseFloat(document.querySelector('#fontSize').value) || 5;
        const textHeight = parseFloat(document.querySelector('#textHeight').value) || 4;
        const lineSpacing = parseFloat(document.querySelector('#lineSpacing').value) || 1.2;
        
        if (tagName) {
            try {
                // Split text into lines
                const lines = tagName.split('\n');
                const useOpentype = !!opentypeFont;
                
                const result = createMultilineText(lines, fontSize, lineSpacing, textHeight, useOpentype);
                
                if (result.group.children.length > 0) {
                    // Create text material (slightly different color)
                    const textMaterial = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(color).offsetHSL(0, 0, -0.1), // Slightly darker
                        metalness: 0.1,
                        roughness: 0.5,
                        emissive: new THREE.Color(color),
                        emissiveIntensity: 0.15
                    });
                    
                    // Apply material to all meshes in group
                    result.group.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.material = textMaterial;
                        }
                    });
                    
                    // Position text group on top of base (same coordinate system)
                    result.group.position.set(0, 0, height + textHeight / 2);
                    
                    // Apply the same rotation as the base from controls
                    const rotX = parseFloat(document.querySelector('#rotateX').value) || 0;
                    const rotY = parseFloat(document.querySelector('#rotateY').value) || 0;
                    const rotZ = parseFloat(document.querySelector('#rotateZ').value) || 0;
                    
                    result.group.rotation.x = rotX * Math.PI / 180;
                    result.group.rotation.y = rotY * Math.PI / 180;
                    result.group.rotation.z = rotZ * Math.PI / 180;
                    
                    textMesh = result.group;
                    scene.add(textMesh);
                }
            } catch (e) {
                console.error('Error creating text:', e);
            }
        }

        // Update dimension text
        const totalHeight = height + (tagName ? textHeight : 0);
        DIM_TEXT.textContent = `${width} × ${length} × ${totalHeight.toFixed(1)} mm`;
        MSG.textContent = '✅ สร้าง Rectangle สำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ เกิดข้อผิดพลาด: ' + e.message;
    }
}

// Apply rotation to current mesh
function applyRotation() {
    if (!currentMesh) return;
    
    const rotX = parseFloat(document.querySelector('#rotateX').value) || 0;
    const rotY = parseFloat(document.querySelector('#rotateY').value) || 0;
    const rotZ = parseFloat(document.querySelector('#rotateZ').value) || 0;
    
    // Convert degrees to radians
    currentMesh.rotation.x = rotX * Math.PI / 180;
    currentMesh.rotation.y = rotY * Math.PI / 180;
    currentMesh.rotation.z = rotZ * Math.PI / 180;
    
    // Apply same rotation to text if it exists
    if (textMesh) {
        textMesh.rotation.x = rotX * Math.PI / 180;
        textMesh.rotation.y = rotY * Math.PI / 180;
        textMesh.rotation.z = rotZ * Math.PI / 180;
    }
}

// Reset rotation to zero
function resetRotation() {
    // Reset all rotations to 0 (unified coordinate system)
    document.querySelector('#rotateX').value = 0;
    document.querySelector('#rotateY').value = 0;
    document.querySelector('#rotateZ').value = 0;
    applyRotation();
    MSG.textContent = '🔄 รีเซ็ตมุมหมุนแล้ว';
}

// Export STL
function exportSTL() {
    if (!currentMesh) {
        MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
        return;
    }

    try {
        const exporter = new STLExporter();
        
        // Create a temporary scene to export both base and text
        const exportScene = new THREE.Scene();
        exportScene.add(currentMesh.clone());
        if (textMesh) {
            const clonedText = textMesh.clone(true); // true = deep clone for groups
            exportScene.add(clonedText);
        }
        
        const stl = exporter.parse(exportScene);
        const blob = new Blob([stl], { type: 'model/stl' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        const tagName = document.querySelector('#tagName').value.trim() || 'rectangle_tag';
        // Remove newlines and special chars for filename
        const fileName = tagName.replace(/[\n\r]/g, '_').replace(/[^\w\u0E00-\u0E7F-]/g, '_');
        a.download = `${fileName}.stl`;
        
        a.click();
        URL.revokeObjectURL(a.href);
        MSG.textContent = '✅ ส่งออก STL สำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ ส่งออก STL ไม่สำเร็จ';
    }
}

// Export 3MF
async function export3MF() {
    if (!currentMesh) {
        MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
        return;
    }

    try {
        MSG.textContent = '⏳ กำลังสร้างไฟล์ 3MF...';
        
        const exportScene = new THREE.Scene();
        exportScene.add(currentMesh.clone());
        if (textMesh) {
            const clonedText = textMesh.clone(true); // true = deep clone for groups
            exportScene.add(clonedText);
        }

        const exporter = new ThreeMFExporter();
        const blob = await exporter.parse(exportScene);
        
        if (!blob) {
            MSG.textContent = '❌ สร้างไฟล์ 3MF ไม่สำเร็จ';
            return;
        }

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        const tagName = document.querySelector('#tagName').value.trim() || 'rectangle_tag';
        // Remove newlines and special chars for filename
        const fileName = tagName.replace(/[\n\r]/g, '_').replace(/[^\w\u0E00-\u0E7F-]/g, '_');
        a.download = `${fileName}.3mf`;
        
        a.click();
        URL.revokeObjectURL(a.href);
        
        MSG.textContent = '✅ ส่งออก 3MF สำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ ส่งออก 3MF ไม่สำเร็จ: ' + e.message;
    }
}

// View controls
document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'top') {
            camera.position.set(0, 0, 200);
            controls.target.set(0, 0, 0);
        } else if (view === 'front') {
            camera.position.set(0, -200, 0);
            controls.target.set(0, 0, 0);
        } else if (view === 'side') {
            camera.position.set(200, 0, 0);
            controls.target.set(0, 0, 0);
        }
        controls.update();
    });
});

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
        
        if (cmd.type === 'M') { // Move to (start new path)
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
            currentPath.moveTo(cmd.x, -cmd.y); // Flip Y for Three.js
        } else if (cmd.type === 'L') { // Line to
            if (currentPath) currentPath.lineTo(cmd.x, -cmd.y);
        } else if (cmd.type === 'C') { // Cubic bezier
            if (currentPath) {
                currentPath.bezierCurveTo(
                    cmd.x1, -cmd.y1,
                    cmd.x2, -cmd.y2,
                    cmd.x, -cmd.y
                );
            }
        } else if (cmd.type === 'Q') { // Quadratic bezier
            if (currentPath) {
                currentPath.quadraticCurveTo(
                    cmd.x1, -cmd.y1,
                    cmd.x, -cmd.y
                );
            }
        } else if (cmd.type === 'Z') { // Close path
            // Path completed
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

    // Add last path if exists
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

// Create text geometry from opentype.js font
function createTextFromOpentype(text, fontSize, extrudeDepth) {
    if (!opentypeFont) return null;

    const allShapes = [];
    let xOffset = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const glyph = opentypeFont.charToGlyph(char);
        
        if (glyph && glyph.path) {
            const path = glyph.getPath(xOffset, 0, fontSize);
            const shapes = opentypePathToShapes(path);
            
            shapes.forEach(shape => {
                allShapes.push(shape);
            });
            
            // Advance for next character
            if (i < text.length - 1) {
                const nextChar = text[i + 1];
                const kerningValue = opentypeFont.getKerningValue(glyph, opentypeFont.charToGlyph(nextChar));
                xOffset += (glyph.advanceWidth + kerningValue) * fontSize / opentypeFont.unitsPerEm;
            } else {
                xOffset += glyph.advanceWidth * fontSize / opentypeFont.unitsPerEm;
            }
        }
    }

    if (allShapes.length === 0) return null;

    // Create extruded geometry from shapes
    const geometry = new THREE.ExtrudeGeometry(allShapes, {
        depth: extrudeDepth,
        bevelEnabled: false,
        curveSegments: 12
    });

    // Compute bounding box for centering
    geometry.computeBoundingBox();
    const textWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
    const textHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;
    
    return { geometry, textWidth, textHeight };
}

// Create multiline text geometry
function createMultilineText(lines, fontSize, lineSpacing, extrudeDepth, useOpentype) {
    const group = new THREE.Group();
    let maxWidth = 0;
    const lineHeight = fontSize * lineSpacing;
    const totalHeight = lines.length * lineHeight;
    
    lines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines
        
        let lineGeometry = null;
        let lineWidth = 0;
        
        if (useOpentype && opentypeFont) {
            const result = createTextFromOpentype(line, fontSize, extrudeDepth);
            if (result) {
                lineGeometry = result.geometry;
                lineWidth = result.textWidth;
            }
        } else if (loadedFont) {
            lineGeometry = new TextGeometry(line, {
                font: loadedFont,
                size: fontSize,
                height: extrudeDepth,
                curveSegments: 12,
                bevelEnabled: false
            });
            
            lineGeometry.computeBoundingBox();
            lineWidth = lineGeometry.boundingBox.max.x - lineGeometry.boundingBox.min.x;
        }
        
        if (lineGeometry) {
            const lineMesh = new THREE.Mesh(lineGeometry);
            
            // Position each line (centered horizontally, stacked vertically)
            const yPos = (totalHeight / 2) - (index * lineHeight) - lineHeight / 2;
            lineMesh.position.set(-lineWidth / 2, yPos, 0);
            
            group.add(lineMesh);
            maxWidth = Math.max(maxWidth, lineWidth);
        }
    });
    
    return { group, maxWidth, totalHeight };
}

async function populateFontDropdown() {
    const listContainer = document.getElementById('fontDropdownList');
    const selectedDiv = document.getElementById('fontDropdownSelected');
    
    // สร้าง style element สำหรับ @font-face
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);
    
    // Prefer manifest file if available
    let fontPaths = FONT_LIST.slice();
    try {
        const resp = await fetch('font/manifest.json');
        if (resp.ok) {
            const manifest = await resp.json();
            if (Array.isArray(manifest) && manifest.length) fontPaths = manifest;
        }
    } catch (e) {
        console.warn('No font manifest, falling back to built-in FONT_LIST');
    }

    // dedupe and normalize
    const seen = new Set();
    for (const fontPath of fontPaths) {
        if (!fontPath || seen.has(fontPath)) continue;
        seen.add(fontPath);
        const fileName = fontPath.split('/').pop().replace(/\.(ttf|otf)$/i, '');
        const fontFamilyName = `FontPreview_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
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
        item.textContent = fileName;
        item.style.fontFamily = `'${fontFamilyName}', 'Noto Sans Thai', sans-serif`;
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
            selectedDiv.textContent = fileName;
            selectedDiv.style.fontFamily = `'${fontFamilyName}', 'Noto Sans Thai', sans-serif`;
            
            // Hide dropdown
            listContainer.style.display = 'none';
            selectedDiv.classList.remove('active');
            
            // Load font
            await loadFontFromPath(fontPath);
        });
        
        listContainer.appendChild(item);
    }
    
    // Toggle dropdown visibility
    selectedDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = listContainer.style.display === 'block';
        listContainer.style.display = isVisible ? 'none' : 'block';
        selectedDiv.classList.toggle('active', !isVisible);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        listContainer.style.display = 'none';
        selectedDiv.classList.remove('active');
    });
}

async function loadFontFromPath(fontPath) {
    MSG.textContent = '⏳ กำลังโหลดฟอนต์...';
    currentFontPath = fontPath;
    
    try {
        // Load TTF/OTF using opentype.js
        const response = await fetch(fontPath);
        const arrayBuffer = await response.arrayBuffer();
        opentypeFont = opentype.parse(arrayBuffer);
        
        // Clear Three.js font to use opentype instead
        loadedFont = null;
        
        MSG.textContent = `✅ โหลดฟอนต์: ${fontPath.split('/').pop()}`;
        
        // Recreate geometry with new font
        if (currentMesh) createRectangle();
        
    } catch (error) {
        console.error('Error loading font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ - ใช้ฟอนต์ default';
        opentypeFont = null;
        // Reload default font
        fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
            (font) => {
                loadedFont = font;
                if (currentMesh) createRectangle();
            }
        );
    }
}

// Font upload handler
document.getElementById('fontUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    MSG.textContent = '⏳ กำลังโหลดฟอนต์...';
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        opentypeFont = opentype.parse(arrayBuffer);
        
        // Clear Three.js font to use opentype instead
        loadedFont = null;
        
        MSG.textContent = `✅ โหลดฟอนต์: ${file.name}`;
        currentFontPath = 'custom';
        
        // Update dropdown display
        const selectedDiv = document.getElementById('fontDropdownSelected');
        selectedDiv.textContent = file.name.replace(/\.(ttf|otf)$/i, '');
        
        if (currentMesh) createRectangle();
        
    } catch (error) {
        console.error('Error loading custom font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ';
    }
});

// Event listeners
document.querySelector('#createRect').addEventListener('click', createRectangle);
document.querySelector('#exportSTL').addEventListener('click', exportSTL);
document.querySelector('#export3MF').addEventListener('click', export3MF);
document.querySelector('#resetRotation').addEventListener('click', resetRotation);

// Rotation controls - update only rotation without recreating geometry
document.querySelector('#rotateX').addEventListener('input', applyRotation);
document.querySelector('#rotateY').addEventListener('input', applyRotation);
document.querySelector('#rotateZ').addEventListener('input', applyRotation);

// Auto-update on input change (except rotation inputs which are handled separately)
document.querySelectorAll('input').forEach(input => {
    if (!input.id.startsWith('rotate')) {
        input.addEventListener('input', () => {
            if (currentMesh) createRectangle();
        });
    }
});

// Auto-update on select (dropdown) change
document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', () => {
        if (currentMesh) createRectangle();
    });
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Handle canvas resize
    const canvas = renderer.domElement;
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

// Create initial rectangle
createRectangle();

// Populate font dropdown
populateFontDropdown();
