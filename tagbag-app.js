// tagbag-app.js - Multi-line Text Extrude Creator with 3D Preview
import * as THREE from 'https://esm.sh/three@0.168.0';
import { OrbitControls } from 'https://esm.sh/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'https://esm.sh/three@0.168.0/examples/jsm/exporters/STLExporter.js';
import { ThreeMFExporter } from './3MFExporter.js';
import { TextGeometry } from 'https://esm.sh/three@0.168.0/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'https://esm.sh/three@0.168.0/examples/jsm/loaders/FontLoader.js';
import { mergeGeometries } from 'https://esm.sh/three@0.168.0/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeVertices } from 'https://esm.sh/three@0.168.0/examples/jsm/utils/BufferGeometryUtils.js';

const MSG = document.querySelector('#msg');
const DIM_TEXT = document.querySelector('#dim-text');

// Font loader
const fontLoader = new FontLoader();
let loadedFont = null;
let opentypeFont = null; // Store opentype.js font
let currentFontPath = null;

// Load default font (TeX Gyre Adventor)
async function loadDefaultFont() {
    try {
        MSG.textContent = '⏳ กำลังโหลดฟอนต์ TeX Gyre Adventor...';
        const fontResp = await fetch('font/font_free/texgyreadventor-regular.otf');
        const arrayBuffer = await fontResp.arrayBuffer();
        opentypeFont = opentype.parse(arrayBuffer);
        loadedFont = null; // Use opentype instead
        currentFontPath = 'font/font_free/texgyreadventor-regular.otf';
        MSG.textContent = '✅ โหลดฟอนต์ TeX Gyre Adventor สำเร็จ';
        
        // Update dropdown display
        const selectedDiv = document.getElementById('fontDropdownSelected');
        if (selectedDiv) {
            selectedDiv.textContent = 'TeX Gyre Adventor (Default)';
        }
        
        createText();
    } catch (error) {
        console.error('Error loading default font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ';
    }
}

// Load default font on startup
loadDefaultFont();

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

// Current meshes
let textMesh = null;
let baseMesh = null;

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

// Helper function: check if point is inside polygon using ray casting
function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
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
            
            // Get all paths for this glyph
            const glyphPaths = [];
            const commands = path.commands;
            let currentPath = null;

            for (let j = 0; j < commands.length; j++) {
                const cmd = commands[j];
                
                if (cmd.type === 'M') {
                    if (currentPath && currentPath.curves.length > 0) {
                        glyphPaths.push(currentPath);
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
                        glyphPaths.push(currentPath);
                        currentPath = null;
                    }
                }
            }

            if (currentPath && currentPath.curves.length > 0) {
                glyphPaths.push(currentPath);
            }

            // Process paths to determine which are holes using winding order
            if (glyphPaths.length > 0) {
                const pathsWithInfo = glyphPaths.map(p => {
                    const points = p.getPoints();
                    const area = THREE.ShapeUtils.area(points);
                    return {
                        path: p,
                        points: points,
                        area: area,
                        absArea: Math.abs(area),
                        isCCW: area > 0
                    };
                });

                // Sort by absolute area (largest first)
                pathsWithInfo.sort((a, b) => b.absArea - a.absArea);

                // First approach: use winding order
                let outlines = pathsWithInfo.filter(p => p.isCCW);
                let holes = pathsWithInfo.filter(p => !p.isCCW);

                // If all paths have the same winding, use area-based approach
                if (outlines.length === 0 || holes.length === 0) {
                    // Largest path is the outline
                    if (pathsWithInfo.length > 0) {
                        const mainShape = pathsWithInfo[0].path;
                        
                        // Check each smaller path to see if it's inside the main shape
                        for (let idx = 1; idx < pathsWithInfo.length; idx++) {
                            const candidateHole = pathsWithInfo[idx];
                            if (candidateHole.points.length > 0) {
                                const testPoint = candidateHole.points[0];
                                if (isPointInPolygon(testPoint, pathsWithInfo[0].points)) {
                                    mainShape.holes.push(candidateHole.path);
                                }
                            }
                        }
                        
                        allShapes.push(mainShape);
                    }
                } else if (pathsWithInfo.length === 1) {
                    // Single path - just add it
                    allShapes.push(pathsWithInfo[0].path);
                } else {
                    // Multiple paths with mixed winding - match holes to outlines
                    const usedHoles = new Set();
                    
                    outlines.forEach(outline => {
                        const shape = outline.path;
                        
                        // Find holes that are inside this outline
                        holes.forEach((hole, holeIdx) => {
                            if (usedHoles.has(holeIdx)) return;
                            
                            if (hole.points.length > 0) {
                                const testPoint = hole.points[0];
                                if (isPointInPolygon(testPoint, outline.points)) {
                                    shape.holes.push(hole.path);
                                    usedHoles.add(holeIdx);
                                }
                            }
                        });
                        
                        allShapes.push(shape);
                    });
                }
            }
            
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

// Generate UI controls for per-line font sizes
function updateLineFontSizeUI() {
    const tagName = document.querySelector('#tagName').value;
    const lines = tagName.split('\n');
    const container = document.getElementById('lineFontSizeInputs');
    const wrapper = document.getElementById('lineFontSizeControls');
    
    // Hide if only one line or empty
    if (lines.length <= 1 || !tagName.trim()) {
        wrapper.style.display = 'none';
        return;
    }
    
    wrapper.style.display = 'block';
    container.innerHTML = '';
    
    const defaultFontSize = parseFloat(document.querySelector('#fontSize').value) || 5;
    
    lines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines but keep index
        
        const lineDiv = document.createElement('div');
        lineDiv.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
        
        const label = document.createElement('label');
        label.style.cssText = 'flex:1;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        label.textContent = `บรรทัด ${index + 1}: ${line.substring(0, 20)}${line.length > 20 ? '...' : ''}`;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `lineSize${index}`;
        input.className = 'line-font-size';
        input.min = '1';
        input.max = '20';
        input.step = '0.5';
        input.value = defaultFontSize;
        input.style.cssText = 'width:70px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);font-size:13px;';
        
        // Update on change
        input.addEventListener('input', () => {
            createText();
        });
        
        lineDiv.appendChild(label);
        lineDiv.appendChild(input);
        container.appendChild(lineDiv);
    });
}

// Create multiline text geometry
function createMultilineText(lines, fontSize, lineSpacing, extrudeDepth, useOpentype) {
    const group = new THREE.Group();
    let maxWidth = 0;
    let totalHeight = 0;
    let currentY = 0;
    
    // Get per-line font sizes if available
    const lineFontSizes = [];
    lines.forEach((line, index) => {
        const lineInput = document.getElementById(`lineSize${index}`);
        const lineSize = lineInput ? parseFloat(lineInput.value) || fontSize : fontSize;
        lineFontSizes.push(lineSize);
    });
    
    // Calculate total height first
    lines.forEach((line, index) => {
        if (line.trim()) {
            const lineSize = lineFontSizes[index];
            totalHeight += lineSize * lineSpacing;
        }
    });
    
    // Start from top
    currentY = totalHeight / 2;
    
    lines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines
        
        const lineSize = lineFontSizes[index];
        const lineHeight = lineSize * lineSpacing;
        
        let lineGeometry = null;
        let lineWidth = 0;
        
        if (useOpentype && opentypeFont) {
            const result = createTextFromOpentype(line, lineSize, extrudeDepth);
            if (result) {
                lineGeometry = result.geometry;
                lineWidth = result.textWidth;
            }
        } else if (loadedFont) {
            lineGeometry = new TextGeometry(line, {
                font: loadedFont,
                size: lineSize,
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
            const yPos = currentY - lineHeight / 2;
            lineMesh.position.set(-lineWidth / 2, yPos, 0);
            
            group.add(lineMesh);
            maxWidth = Math.max(maxWidth, lineWidth);
            
            // Move down for next line
            currentY -= lineHeight;
        }
    });
    
    return { group, maxWidth, totalHeight };
}

// Create text mesh
function createText() {
    // Don't create text if font is not loaded yet
    if (!loadedFont && !opentypeFont) {
        MSG.textContent = '⏳ รอโหลดฟอนต์...';
        return;
    }

    const tagName = document.querySelector('#tagName').value.trim();
    const fontSize = parseFloat(document.querySelector('#fontSize').value) || 5;
    const textHeight = parseFloat(document.querySelector('#textHeight').value) || 4;
    const lineSpacing = parseFloat(document.querySelector('#lineSpacing').value) || 1.2;
    const textColor = document.querySelector('#textColor').value || '#696FC7';
    
    // Base parameters
    const enableBase = document.querySelector('#enableBase')?.checked ?? true;
    const baseWidth = parseFloat(document.querySelector('#baseWidth')?.value) || 80;
    const baseLength = parseFloat(document.querySelector('#baseLength')?.value) || 50;
    const baseHeight = parseFloat(document.querySelector('#baseHeight')?.value) || 4;
    const cornerRadius = parseFloat(document.querySelector('#cornerRadius')?.value) || 8;
    const baseColor = document.querySelector('#baseColor')?.value || '#FFFFFF';

    try {
        // Remove old meshes
        if (textMesh) {
            scene.remove(textMesh);
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
        
        if (baseMesh) {
            scene.remove(baseMesh);
            if (baseMesh.geometry) baseMesh.geometry.dispose();
            if (baseMesh.material) baseMesh.material.dispose();
            baseMesh = null;
        }

        // Create base if enabled
        if (enableBase) {
            const shape = createRoundedRectShape(baseWidth, baseLength, cornerRadius);
            const extrudeSettings = {
                depth: baseHeight,
                bevelEnabled: false,
                curveSegments: 24,
                steps: 1
            };
            
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.computeVertexNormals();
            geometry.translate(0, 0, baseHeight / 2);
            
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(baseColor),
                metalness: 0.1,
                roughness: 0.5,
                emissive: new THREE.Color(baseColor),
                emissiveIntensity: 0.15
            });
            
            baseMesh = new THREE.Mesh(geometry, material);
            baseMesh.name = 'base';
            applyRotation(baseMesh);
            scene.add(baseMesh);
        }

        if (!tagName) {
            MSG.textContent = enableBase ? '✅ สร้างฐานสำเร็จ' : '⚠️ กรุณาใส่ข้อความ';
            DIM_TEXT.textContent = enableBase ? `${baseWidth} × ${baseLength} × ${baseHeight} mm` : '';
            return;
        }

        // Split text into lines
        const lines = tagName.split('\n');
        const useOpentype = !!opentypeFont;
        
        const result = createMultilineText(lines, fontSize, lineSpacing, textHeight, useOpentype);
        
        if (result.group.children.length > 0) {
            // Create text material with user-selected color
            const textMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(textColor),
                metalness: 0.1,
                roughness: 0.5,
                emissive: new THREE.Color(textColor),
                emissiveIntensity: 0.15
            });
            
            // Apply material to all meshes in group
            result.group.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = textMaterial;
                    child.name = 'text';
                }
            });
            
            // Apply user offsets and position text on top of base
            const offX = (document.getElementById('offsetX') ? parseFloat(document.getElementById('offsetX').value) : 0) || 0;
            const offY = (document.getElementById('offsetY') ? parseFloat(document.getElementById('offsetY').value) : 0) || 0;
            const zPos = enableBase ? baseHeight + textHeight / 2 - 0.1 : 0;
            result.group.position.set(offX, offY, zPos);
            
            // Apply rotation from controls
            applyRotation(result.group);
            
            textMesh = result.group;
            textMesh.name = 'text_group';
            scene.add(textMesh);
            
            // Update dimension text
            const totalHeight = enableBase ? baseHeight + textHeight : textHeight;
            DIM_TEXT.textContent = enableBase ? 
                `${baseWidth} × ${baseLength} × ${totalHeight.toFixed(1)} mm` :
                `${result.maxWidth.toFixed(1)} × ${result.totalHeight.toFixed(1)} × ${textHeight.toFixed(1)} mm`;
            MSG.textContent = enableBase ? '✅ สร้างฐานและข้อความสำเร็จ' : '✅ สร้างข้อความสำเร็จ';
        } else {
            MSG.textContent = '⚠️ ไม่สามารถสร้างข้อความได้';
            DIM_TEXT.textContent = '';
        }
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ เกิดข้อผิดพลาด: ' + e.message;
        DIM_TEXT.textContent = '';
    }
}

// Apply rotation to mesh
function applyRotation(mesh = null) {
    const rotX = parseFloat(document.querySelector('#rotateX').value) || 0;
    const rotY = parseFloat(document.querySelector('#rotateY').value) || 0;
    const rotZ = parseFloat(document.querySelector('#rotateZ').value) || 0;
    
    // Convert degrees to radians
    const rotationX = rotX * Math.PI / 180;
    const rotationY = rotY * Math.PI / 180;
    const rotationZ = rotZ * Math.PI / 180;
    
    if (mesh) {
        mesh.rotation.x = rotationX;
        mesh.rotation.y = rotationY;
        mesh.rotation.z = rotationZ;
    } else {
        // Apply to both base and text if no specific mesh provided
        if (baseMesh) {
            baseMesh.rotation.x = rotationX;
            baseMesh.rotation.y = rotationY;
            baseMesh.rotation.z = rotationZ;
        }
        if (textMesh) {
            textMesh.rotation.x = rotationX;
            textMesh.rotation.y = rotationY;
            textMesh.rotation.z = rotationZ;
        }
    }
}

// Reset rotation to zero
function resetRotation() {
    document.querySelector('#rotateX').value = 0;
    document.querySelector('#rotateY').value = 0;
    document.querySelector('#rotateZ').value = 0;
    applyRotation();
    MSG.textContent = '🔄 รีเซ็ตมุมหมุนแล้ว';
}

// Merge all geometries into a single manifold mesh
function createMergedMesh() {
    const geometries = [];
    
    // Clone and collect base geometry
    if (baseMesh) {
        const baseGeo = baseMesh.geometry.clone();
        baseGeo.applyMatrix4(baseMesh.matrix);
        geometries.push(baseGeo);
    }
    
    // Clone and collect text geometries
    if (textMesh) {
        textMesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
                const textGeo = child.geometry.clone();
                child.updateWorldMatrix(true, false);
                textGeo.applyMatrix4(child.matrixWorld);
                geometries.push(textGeo);
            }
        });
    }
    
    if (geometries.length === 0) return null;
    
    // Merge all geometries into one
    let mergedGeometry = mergeGeometries(geometries, false);
    
    // Clean up: merge duplicate vertices (critical for manifold mesh)
    mergedGeometry = mergeVertices(mergedGeometry, 0.0001);
    
    // Recompute normals for proper shading
    mergedGeometry.computeVertexNormals();
    
    // Convert to non-indexed geometry (sometimes helps with manifold issues)
    if (mergedGeometry.index !== null) {
        mergedGeometry = mergedGeometry.toNonIndexed();
        mergedGeometry = mergeVertices(mergedGeometry, 0.0001);
        mergedGeometry.computeVertexNormals();
    }
    
    // Create material
    const material = textMesh ? 
        (textMesh.children[0]?.material?.clone() || new THREE.MeshStandardMaterial()) : 
        new THREE.MeshStandardMaterial();
    
    return new THREE.Mesh(mergedGeometry, material);
}

// Export STL
function exportSTL() {
    if (!textMesh && !baseMesh) {
        MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
        return;
    }

    try {
        const exporter = new STLExporter();
        const mergedMesh = createMergedMesh();
        
        if (!mergedMesh) {
            MSG.textContent = '❌ ไม่สามารถรวม geometry ได้';
            return;
        }

        const stlString = exporter.parse(mergedMesh, { binary: false });
        const blob = new Blob([stlString], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        const tagName = document.querySelector('#tagName').value.trim().replace(/\n/g, '_').substring(0, 30);
        link.download = `tagbag_${tagName || 'text'}.stl`;
        link.click();
        
        MSG.textContent = '✅ ส่งออก STL สำเร็จ';
        
        // Clean up
        mergedMesh.geometry.dispose();
        mergedMesh.material.dispose();
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ เกิดข้อผิดพลาดในการส่งออก STL: ' + e.message;
    }
}

// Export 3MF
function export3MF() {
    if (!textMesh && !baseMesh) {
        MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
        return;
    }

    try {
        const exporter = new ThreeMFExporter();
        const mergedMesh = createMergedMesh();
        
        if (!mergedMesh) {
            MSG.textContent = '❌ ไม่สามารถรวม geometry ได้';
            return;
        }

        mergedMesh.name = 'tagbag_text';
        
        exporter.parse(mergedMesh, (result) => {
            const blob = new Blob([result], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            const tagName = document.querySelector('#tagName').value.trim().replace(/\n/g, '_').substring(0, 30);
            link.download = `tagbag_${tagName || 'text'}.3mf`;
            link.click();
            
            MSG.textContent = '✅ ส่งออก 3MF สำเร็จ';
            
            // Clean up
            mergedMesh.geometry.dispose();
            mergedMesh.material.dispose();
        });
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ เกิดข้อผิดพลาดในการส่งออก 3MF: ' + e.message;
    }
}

// Nudge controls
const NUDGE_STEP = 0.5;

document.getElementById('nudgeLeft')?.addEventListener('click', () => {
    const input = document.getElementById('offsetX');
    input.value = (parseFloat(input.value) || 0) - NUDGE_STEP;
    createText();
});

document.getElementById('nudgeRight')?.addEventListener('click', () => {
    const input = document.getElementById('offsetX');
    input.value = (parseFloat(input.value) || 0) + NUDGE_STEP;
    createText();
});

document.getElementById('nudgeUp')?.addEventListener('click', () => {
    const input = document.getElementById('offsetY');
    input.value = (parseFloat(input.value) || 0) + NUDGE_STEP;
    createText();
});

document.getElementById('nudgeDown')?.addEventListener('click', () => {
    const input = document.getElementById('offsetY');
    input.value = (parseFloat(input.value) || 0) - NUDGE_STEP;
    createText();
});

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
    
    async function loadFonts() {
        listContainer.innerHTML = '';
        styleEl.textContent = '';
        
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
            console.error('เกิดข้อผิดพลาด:', e);
            listContainer.innerHTML = '<div style="padding:20px;color:var(--text-secondary);">เกิดข้อผิดพลาด</div>';
            return;
        }

        fontPaths = fontPaths.filter(path => path.includes(filterPath));

        const seen = new Set();
        let fontIndex = 1;
        for (const fontPath of fontPaths) {
            if (!fontPath || seen.has(fontPath)) continue;
            seen.add(fontPath);
            const fileName = fontPath.split('/').pop().replace(/\.(ttf|otf)$/i, '');
            let safeName = fileName.replace(/[^a-zA-Z0-9]/g, '_');
            if (/^\d/.test(safeName)) {
                safeName = 'font_' + safeName;
            }
            const fontFamilyName = `FontPreview_${safeName}`;
            
            styleEl.textContent += `
                @font-face {
                    font-family: '${fontFamilyName}';
                    src: url('${fontPath}');
                }
            `;

            const optionDiv = document.createElement('div');
            optionDiv.className = 'custom-select-option';
            optionDiv.dataset.value = fontPath;
            optionDiv.innerHTML = `<span style="font-family:'${fontFamilyName}',sans-serif;">${fileName}</span>`;
            optionDiv.addEventListener('click', async () => {
                selectedDiv.textContent = fileName;
                listContainer.style.display = 'none';
                
                MSG.textContent = '⏳ กำลังโหลดฟอนต์...';
                
                try {
                    const fontResp = await fetch(fontPath);
                    const arrayBuffer = await fontResp.arrayBuffer();
                    opentypeFont = opentype.parse(arrayBuffer);
                    loadedFont = null;
                    currentFontPath = fontPath;
                    MSG.textContent = `✅ โหลดฟอนต์: ${fileName}`;
                    createText();
                } catch (error) {
                    console.error('Error loading font:', error);
                    MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ';
                }
            });
            
            listContainer.appendChild(optionDiv);
            fontIndex++;
        }
    }

    await loadFonts();
    
    usePersonalCheckbox.addEventListener('change', async () => {
        selectedDiv.textContent = '-- เลือกฟอนต์ --';
        opentypeFont = null;
        currentFontPath = null;
        // Reload default font
        await loadDefaultFont();
        await loadFonts();
    });

    selectedDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = listContainer.style.display === 'block';
        listContainer.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            const rect = selectedDiv.getBoundingClientRect();
            listContainer.style.position = 'absolute';
            listContainer.style.top = `${rect.bottom + window.scrollY}px`;
            listContainer.style.left = `${rect.left + window.scrollX}px`;
            listContainer.style.width = `${rect.width}px`;
            listContainer.style.zIndex = '10000';
        }
    });

    document.addEventListener('click', (e) => {
        if (!selectedDiv.contains(e.target) && !listContainer.contains(e.target)) {
            listContainer.style.display = 'none';
        }
    });
}

// Font upload handler
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
        
        createText();
        
    } catch (error) {
        console.error('Error loading custom font:', error);
        MSG.textContent = '⚠️ โหลดฟอนต์ไม่สำเร็จ';
    }
});

// Event listeners
document.querySelector('#createText')?.addEventListener('click', createText);
document.querySelector('#exportSTL')?.addEventListener('click', exportSTL);
document.querySelector('#export3MF')?.addEventListener('click', export3MF);
document.querySelector('#resetRotation')?.addEventListener('click', resetRotation);

// Rotation controls - update only rotation without recreating geometry
document.querySelector('#rotateX')?.addEventListener('input', applyRotation);
document.querySelector('#rotateY')?.addEventListener('input', applyRotation);
document.querySelector('#rotateZ')?.addEventListener('input', applyRotation);

// Update line font size UI when text changes
document.querySelector('#tagName')?.addEventListener('input', () => {
    updateLineFontSizeUI();
    createText();
});

// Update line font size UI when default font size changes
document.querySelector('#fontSize')?.addEventListener('input', () => {
    updateLineFontSizeUI();
    createText();
});

// Auto-update on other input changes
['textHeight', 'lineSpacing', 'textColor', 'offsetX', 'offsetY', 
 'enableBase', 'baseWidth', 'baseLength', 'baseHeight', 'cornerRadius', 'baseColor'].forEach(id => {
    document.querySelector(`#${id}`)?.addEventListener('input', createText);
    document.querySelector(`#${id}`)?.addEventListener('change', createText);
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

// Populate font dropdown (but don't create text yet - wait for font to load)
populateFontDropdown();

// Initialize line font size UI (but don't create text yet)
updateLineFontSizeUI();
