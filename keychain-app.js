// keychain-app.js - Personalized Keychain Creator with 3D Preview
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

// 3D Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const canvas = document.getElementById('canvas');
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(50, 40, 60);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
directionalLight2.position.set(-10, -20, -10);
scene.add(directionalLight2);

// Grid helper
const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0xcccccc);
scene.add(gridHelper);

// Keychain meshes
let keychainGroup = null;

// Load default font (Helvetiker)
fontLoader.load(
    'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    function (font) {
        loadedFont = font;
        MSG.textContent = '✅ พร้อมใช้งาน - กด อัพเดทพรีวิว';
        loadFontManifest();
    },
    undefined,
    function (err) {
        console.error('Error loading default font:', err);
        MSG.textContent = '❌ ไม่สามารถโหลดฟอนต์ได้';
    }
);

// Load font manifest and populate dropdown
async function loadFontManifest() {
    try {
        const response = await fetch('font_manifest.json');
        const manifest = await response.json();
        
        const fontSelect = document.getElementById('fontSelect');
        const optionsContainer = document.getElementById('fontDropdownOptions');
        fontSelect.innerHTML = '';
        if (optionsContainer) optionsContainer.innerHTML = '';
        
        manifest.fonts.forEach(fontPath => {
            // Add to hidden select
            const option = document.createElement('option');
            option.value = fontPath;
            const fontName = fontPath.split('/').pop().replace(/\.(ttf|otf)$/i, '');
            option.textContent = fontName;
            fontSelect.appendChild(option);
            
            // Add to custom dropdown
            if (optionsContainer) {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'custom-select-option';
                optionDiv.textContent = fontName;
                optionDiv.dataset.value = fontPath;
                optionDiv.addEventListener('click', () => {
                    fontSelect.value = fontPath;
                    fontSelect.dispatchEvent(new Event('change'));
                    document.getElementById('fontDropdownWrapper').classList.remove('active');
                });
                optionsContainer.appendChild(optionDiv);
            }
        });
        
        fontSelect.value = 'font/iann_b.ttf';
        document.getElementById('fontDropdownSelected').textContent = 
            fontSelect.options[fontSelect.selectedIndex].textContent;
        await loadOpentypeFont('font/iann_b.ttf');
    } catch (error) {
        console.error('Error loading font manifest:', error);
    }
}

// Load opentype font
async function loadOpentypeFont(fontPath) {
    try {
        const response = await fetch(fontPath);
        const arrayBuffer = await response.arrayBuffer();
        opentypeFont = opentype.parse(arrayBuffer);
        MSG.textContent = '✅ โหลดฟอนต์สำเร็จ';
    } catch (error) {
        console.error('Error loading opentype font:', error);
        MSG.textContent = '❌ ไม่สามารถโหลดฟอนต์ได้';
    }
}

// Convert opentype path to Three.js shapes
function opentypePathToShapes(path) {
    const shapes = [];
    const commands = path.commands;
    let currentPath = null;
    let currentShape = null;

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];

        if (cmd.type === 'M') {
            if (currentPath && currentPath !== currentShape) {
                currentShape.holes.push(currentPath);
            } else if (currentPath) {
                shapes.push(currentPath);
            }
            currentPath = new THREE.Shape();
            currentPath.moveTo(cmd.x, -cmd.y);
            currentShape = currentPath;
        } else if (cmd.type === 'L') {
            currentPath.lineTo(cmd.x, -cmd.y);
        } else if (cmd.type === 'C') {
            currentPath.bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y);
        } else if (cmd.type === 'Q') {
            currentPath.quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y);
        } else if (cmd.type === 'Z') {
            if (currentPath && currentPath !== currentShape) {
                currentShape.holes.push(currentPath);
            } else if (currentPath) {
                shapes.push(currentPath);
            }
            currentPath = null;
        }
    }

    if (currentPath) {
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

// Create chamfered box (box with beveled corners like OpenSCAD)
function createChamferedBox(width, height, depth, chamferSize) {
    // Create basic box first
    const boxGeometry = new THREE.BoxGeometry(width, height, depth);
    boxGeometry.translate(width / 2, height / 2, depth / 2); // Position at origin corner
    
    // Create chamfer cutters (45-degree cuts at bottom-left and top-left corners)
    const chamferCutters = [];
    
    // Bottom-left corner chamfer (X=0, Z=0)
    const cutterSize = chamferSize * Math.sqrt(2);
    const cutter1 = new THREE.BoxGeometry(cutterSize, height, cutterSize);
    const mesh1 = new THREE.Mesh(cutter1);
    mesh1.position.set(-cutterSize / 2, height / 2, -cutterSize / 2);
    mesh1.rotation.y = Math.PI / 4;
    mesh1.updateMatrix();
    chamferCutters.push(mesh1);
    
    // Top-left corner chamfer (X=0, Z=depth)
    const cutter2 = new THREE.BoxGeometry(cutterSize, height, cutterSize);
    const mesh2 = new THREE.Mesh(cutter2);
    mesh2.position.set(-cutterSize / 2, height / 2, depth + cutterSize / 2);
    mesh2.rotation.y = -Math.PI / 4;
    mesh2.updateMatrix();
    chamferCutters.push(mesh2);
    
    return boxGeometry; // Return base geometry, chamfers will be applied via CSG
}

// Create keychain box with all features (chamfer, hole, connectors)
function createKeychainBox(params, isFirst, isLast) {
    const {
        boxWidth,
        boxHeight,
        boxLength,
        baseColor,
        firstLink,
        chamferSize = 1
    } = params;
    
    // Adjust length for first element if no link needed
    const actualLength = (isFirst && !firstLink) ? boxLength - 2 : boxLength;
    
    // Constants from OpenSCAD
    const holeDiameter = 10;
    const holeDepth = 5.5;
    const connectorDiameter = 2;
    const linkOuterDiameter = 6;
    const linkInnerDiameter = 3;
    const linkHeight = 4;
    const linkSeparation = 2;
    const supportHeight = 1;
    const supportLength = 2;
    
    // Create base box
    let baseGeometry = new THREE.BoxGeometry(actualLength, boxWidth, boxHeight);
    
    // Apply CSG operations for chamfers and hole
    const evaluator = new Evaluator();
    let baseBrush = new Brush(baseGeometry);
    baseBrush.updateMatrixWorld();
    
    // Chamfer bottom-left corner (X=0, Z=0)
    const cutterSize = chamferSize * Math.sqrt(2);
    const chamfer1Geo = new THREE.BoxGeometry(cutterSize, boxWidth + 2, cutterSize);
    const chamfer1Brush = new Brush(chamfer1Geo);
    chamfer1Brush.position.set(-actualLength / 2 - 0.5, 0, -boxHeight / 2 - 0.5);
    chamfer1Brush.rotation.z = Math.PI / 4;
    chamfer1Brush.updateMatrixWorld();
    baseBrush = new Brush(evaluator.evaluate(baseBrush, chamfer1Brush, SUBTRACTION).geometry);
    baseBrush.updateMatrixWorld();
    
    // Chamfer top-left corner (X=0, Z=boxHeight)
    const chamfer2Geo = new THREE.BoxGeometry(cutterSize, boxWidth + 2, cutterSize);
    const chamfer2Brush = new Brush(chamfer2Geo);
    chamfer2Brush.position.set(-actualLength / 2 - 0.5, 0, boxHeight / 2 + 0.5);
    chamfer2Brush.rotation.z = -Math.PI / 4;
    chamfer2Brush.updateMatrixWorld();
    baseBrush = new Brush(evaluator.evaluate(baseBrush, chamfer2Brush, SUBTRACTION).geometry);
    baseBrush.updateMatrixWorld();
    
    // Create hole if needed (first element with link, or not first element)
    if ((isFirst && firstLink) || !isFirst) {
        const holeGeo = new THREE.CylinderGeometry(holeDiameter / 2, holeDiameter / 2, holeDepth, 32);
        const holeBrush = new Brush(holeGeo);
        holeBrush.rotation.x = Math.PI / 2;
        holeBrush.position.set(-actualLength / 2, 0, 0);
        holeBrush.updateMatrixWorld();
        baseBrush = new Brush(evaluator.evaluate(baseBrush, holeBrush, SUBTRACTION).geometry);
        baseBrush.updateMatrixWorld();
    }
    
    // Clean up geometry
    let finalGeometry = baseBrush.geometry.clone();
    finalGeometry = mergeVertices(finalGeometry);
    finalGeometry = finalGeometry.toNonIndexed();
    
    const group = new THREE.Group();
    
    // Add base mesh
    const baseMesh = new THREE.Mesh(
        finalGeometry,
        new THREE.MeshStandardMaterial({
            color: new THREE.Color(baseColor),
            metalness: 0.1,
            roughness: 0.5
        })
    );
    group.add(baseMesh);
    
    // Add connector cylinder if needed
    if ((isFirst && firstLink) || !isFirst) {
        const connectorGeo = new THREE.CylinderGeometry(connectorDiameter / 2, connectorDiameter / 2, boxWidth, 16);
        const connector = new THREE.Mesh(
            connectorGeo,
            new THREE.MeshStandardMaterial({ color: new THREE.Color(baseColor) })
        );
        connector.rotation.x = Math.PI / 2;
        connector.position.set(-actualLength / 2 + connectorDiameter / 2, 0, 0);
        group.add(connector);
    }
    
    // Add link connector and supports if not last element
    if (!isLast) {
        // Hollow cylinder link
        const outerGeo = new THREE.CylinderGeometry(linkOuterDiameter / 2, linkOuterDiameter / 2, linkHeight, 32);
        const innerGeo = new THREE.CylinderGeometry(linkInnerDiameter / 2, linkInnerDiameter / 2, linkHeight + 0.2, 32);
        
        const outerBrush = new Brush(outerGeo);
        const innerBrush = new Brush(innerGeo);
        outerBrush.updateMatrixWorld();
        innerBrush.updateMatrixWorld();
        
        const hollowResult = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
        let hollowGeo = hollowResult.geometry.clone();
        hollowGeo = mergeVertices(hollowGeo);
        hollowGeo = hollowGeo.toNonIndexed();
        
        const linkMesh = new THREE.Mesh(
            hollowGeo,
            new THREE.MeshStandardMaterial({ color: new THREE.Color(baseColor) })
        );
        linkMesh.rotation.x = Math.PI / 2;
        linkMesh.position.set(actualLength / 2 + linkSeparation, 0, 0);
        group.add(linkMesh);
        
        // Support rectangles
        const supportGeo = new THREE.BoxGeometry(supportLength, linkHeight, supportHeight);
        
        const support1 = new THREE.Mesh(
            supportGeo,
            new THREE.MeshStandardMaterial({ color: new THREE.Color(baseColor) })
        );
        support1.position.set(
            actualLength / 2 + supportLength / 2,
            0,
            linkOuterDiameter / 2 - supportHeight / 2
        );
        group.add(support1);
        
        const support2 = new THREE.Mesh(
            supportGeo.clone(),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(baseColor) })
        );
        support2.position.set(
            actualLength / 2 + supportLength / 2,
            0,
            -linkOuterDiameter / 2 + supportHeight / 2
        );
        group.add(support2);
    }
    
    return group;
}

// Create single keychain element with letter
function createKeychainElement(letter, params, isFirst, isLast) {
    const {
        boxWidth,
        boxHeight,
        boxLength,
        letterSize,
        letterHeight,
        baseColor,
        letterColor,
        firstLink
    } = params;
    
    // Adjust length for first element if no link needed
    const actualLength = (isFirst && !firstLink) ? boxLength - 2 : boxLength;
    
    // Create box with chamfer, hole, and connectors
    const boxGroup = createKeychainBox(params, isFirst, isLast);
    
    // Create text
    const textShapes = getTextShapes(letter, letterSize);
    
    if (textShapes.length > 0) {
        // Calculate text position (from OpenSCAD)
        const textX = (isFirst && !firstLink) ? 
            actualLength / 2 + 0.6 : 
            boxLength / 2 + 2;
        
        if (letterHeight > 0) {
            // Raised letter (positive height)
            let letterGeometry = new THREE.ExtrudeGeometry(textShapes, {
                depth: letterHeight,
                bevelEnabled: false,
                curveSegments: 12
            });
            
            // Center text
            letterGeometry.computeBoundingBox();
            const textWidth = letterGeometry.boundingBox.max.x - letterGeometry.boundingBox.min.x;
            const textHeight = letterGeometry.boundingBox.max.y - letterGeometry.boundingBox.min.y;
            
            // Clean geometry
            letterGeometry = mergeVertices(letterGeometry);
            letterGeometry = letterGeometry.toNonIndexed();
            
            // Position on top of box
            letterGeometry.translate(
                -actualLength / 2 + textX - textWidth / 2,
                -textHeight / 2,
                boxHeight / 2
            );
            
            const letterMesh = new THREE.Mesh(
                letterGeometry,
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(letterColor),
                    metalness: 0.1,
                    roughness: 0.5
                })
            );
            boxGroup.add(letterMesh);
            
        } else if (letterHeight < 0) {
            // Recessed letter (negative height) - cut into top surface
            let letterGeometry = new THREE.ExtrudeGeometry(textShapes, {
                depth: Math.abs(letterHeight) + 0.1,
                bevelEnabled: false,
                curveSegments: 12
            });
            
            // Center text
            letterGeometry.computeBoundingBox();
            const textWidth = letterGeometry.boundingBox.max.x - letterGeometry.boundingBox.min.x;
            const textHeight = letterGeometry.boundingBox.max.y - letterGeometry.boundingBox.min.y;
            
            // Clean geometry
            letterGeometry = mergeVertices(letterGeometry);
            letterGeometry = letterGeometry.toNonIndexed();
            
            // Position inside box (recessed from top)
            letterGeometry.translate(
                -actualLength / 2 + textX - textWidth / 2,
                -textHeight / 2,
                boxHeight / 2 + letterHeight
            );
            
            const letterMesh = new THREE.Mesh(
                letterGeometry,
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(letterColor),
                    metalness: 0.1,
                    roughness: 0.5
                })
            );
            boxGroup.add(letterMesh);
        }
    }
    
    return boxGroup;
}

// Create full keychain
function createKeychain() {
    const text = document.getElementById('nameText').value || 'ALBERTO';
    const letterSize = parseFloat(document.getElementById('letterSize').value) || 10;
    const letterHeight = parseFloat(document.getElementById('letterHeight').value) || 1;
    const boxHeight = parseFloat(document.getElementById('boxHeight').value) || 6;
    const boxWidth = parseFloat(document.getElementById('boxWidth').value) || 12;
    const boxLength = parseFloat(document.getElementById('boxLength').value) || 15;
    const firstLink = document.getElementById('firstLink').checked;
    const spacing = parseFloat(document.getElementById('spacing').value) || 1;
    const baseColor = document.getElementById('baseColor').value;
    const letterColor = document.getElementById('letterColor').value;
    
    if (!text) {
        MSG.textContent = '⚠️ กรุณาใส่ข้อความ';
        return;
    }
    
    if (!loadedFont && !opentypeFont) {
        MSG.textContent = '⚠️ กรุณารอโหลดฟอนต์';
        return;
    }
    
    try {
        // Remove old keychain
        if (keychainGroup) {
            scene.remove(keychainGroup);
            keychainGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            keychainGroup = null;
        }
        
        keychainGroup = new THREE.Group();
        
        const params = {
            boxWidth,
            boxHeight,
            boxLength,
            letterSize,
            letterHeight,
            baseColor,
            letterColor,
            firstLink
        };
        
        let xOffset = 0;
        const firstElementLength = (firstLink ? boxLength : boxLength - 2);
        
        // Create each letter element
        for (let i = 0; i < text.length; i++) {
            const letter = text[i];
            const isFirst = (i === 0);
            const isLast = (i === text.length - 1);
            
            const element = createKeychainElement(letter, params, isFirst, isLast);
            element.position.x = xOffset;
            keychainGroup.add(element);
            
            // Calculate next position
            if (i === 0) {
                xOffset += firstElementLength + spacing;
            } else {
                xOffset += boxLength + spacing;
            }
        }
        
        // Center the keychain
        const totalLength = xOffset - spacing;
        keychainGroup.position.x = -totalLength / 2;
        keychainGroup.position.y = -boxWidth / 2;
        
        scene.add(keychainGroup);
        
        // Update dimensions
        updateDimensions(totalLength, boxWidth, boxHeight);
        
        MSG.textContent = '✅ สร้างพรีวิวสำเร็จ!';
    } catch (error) {
        console.error('Error creating keychain:', error);
        MSG.textContent = '❌ เกิดข้อผิดพลาด: ' + error.message;
    }
}

// Update dimension display
function updateDimensions(length, width, height) {
    const volume = (length * width * height).toFixed(2);
    DIM_TEXT.innerHTML = `
        Size: ${length.toFixed(2)} x ${width.toFixed(2)} x ${height.toFixed(2)} mm<br>
        Volume: ${volume} mm³
    `;
}

// Export functions
function exportSTL() {
    if (!keychainGroup) {
        MSG.textContent = '⚠️ กรุณาสร้างพรีวิวก่อน';
        return;
    }
    
    try {
        const exporter = new STLExporter();
        const stlString = exporter.parse(keychainGroup, { binary: false });
        const blob = new Blob([stlString], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'keychain.stl';
        link.click();
        MSG.textContent = '✅ ส่งออก STL สำเร็จ!';
    } catch (error) {
        console.error('Error exporting STL:', error);
        MSG.textContent = '❌ ไม่สามารถส่งออก STL ได้';
    }
}

function export3MF() {
    if (!keychainGroup) {
        MSG.textContent = '⚠️ กรุณาสร้างพรีวิวก่อน';
        return;
    }
    
    try {
        const exporter = new ThreeMFExporter();
        const data = exporter.parse(keychainGroup);
        const blob = new Blob([data], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'keychain.3mf';
        link.click();
        MSG.textContent = '✅ ส่งออก 3MF สำเร็จ!';
    } catch (error) {
        console.error('Error exporting 3MF:', error);
        MSG.textContent = '❌ ไม่สามารถส่งออก 3MF ได้';
    }
}

// Custom font dropdown (same as tag.html)
function setupFontDropdown() {
    const wrapper = document.getElementById('fontDropdownWrapper');
    const selected = document.getElementById('fontDropdownSelected');
    const options = document.getElementById('fontDropdownOptions');
    const hiddenSelect = document.getElementById('fontSelect');

    if (!wrapper || !selected || !options || !hiddenSelect) return;

    // Toggle dropdown
    selected.addEventListener('click', () => {
        wrapper.classList.toggle('active');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('active');
        }
    });

    // Sync hidden select with custom dropdown
    hiddenSelect.addEventListener('change', async () => {
        const selectedOption = hiddenSelect.options[hiddenSelect.selectedIndex];
        selected.textContent = selectedOption.textContent;
        MSG.textContent = '⏳ กำลังโหลดฟอนต์...';
        await loadOpentypeFont(hiddenSelect.value);
    });
}

// Event listeners
document.getElementById('updateBtn').addEventListener('click', createKeychain);
document.getElementById('exportSTL').addEventListener('click', exportSTL);
document.getElementById('export3MF').addEventListener('click', export3MF);

// Setup font dropdown
setupFontDropdown();

// Resize handler
function handleResize() {
    const main = document.querySelector('main');
    if (main && canvas) {
        const width = main.clientWidth;
        const height = main.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

window.addEventListener('resize', handleResize);
// Initial resize
setTimeout(handleResize, 100);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
