// tag-app.js - Rectangle Tag Creator with 3D Preview
import * as THREE from 'https://esm.sh/three@0.168.0';
import { OrbitControls } from 'https://esm.sh/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'https://esm.sh/three@0.168.0/examples/jsm/exporters/STLExporter.js';
import { ThreeMFExporter } from './3MFExporter.js';

const MSG = document.querySelector('#msg');
const DIM_TEXT = document.querySelector('#dim-text');

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

    try {
        // Create base shape
        const shape = createRoundedRectShape(width, length, cornerRadius);

        // Add hole if enabled
        if (enableHole) {
            const holeRadius = holeDiameter / 2;
            const holeX = width / 2 - holeOffset;
            const holeY = length / 2 - holeOffset;
            
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

        // Create and add new mesh
        currentMesh = new THREE.Mesh(geometry, material);
        currentMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat
        scene.add(currentMesh);

        // Update dimension text
        DIM_TEXT.textContent = `${width} × ${length} × ${height} mm`;
        MSG.textContent = '✅ สร้าง Rectangle สำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ เกิดข้อผิดพลาด: ' + e.message;
    }
}

// Export STL
function exportSTL() {
    if (!currentMesh) {
        MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก';
        return;
    }

    try {
        const exporter = new STLExporter();
        const stl = exporter.parse(currentMesh);
        const blob = new Blob([stl], { type: 'model/stl' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rectangle_tag.stl';
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
        const clonedMesh = currentMesh.clone();
        exportScene.add(clonedMesh);

        const exporter = new ThreeMFExporter();
        const blob = await exporter.parse(exportScene);
        
        if (!blob) {
            MSG.textContent = '❌ สร้างไฟล์ 3MF ไม่สำเร็จ';
            return;
        }

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rectangle_tag.3mf';
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

// Event listeners
document.querySelector('#createRect').addEventListener('click', createRectangle);
document.querySelector('#exportSTL').addEventListener('click', exportSTL);
document.querySelector('#export3MF').addEventListener('click', export3MF);

// Auto-update on input change
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
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
