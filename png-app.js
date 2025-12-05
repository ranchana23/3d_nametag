// png-app.js - PNG to STL converter with 3D preview
import * as THREE from 'https://esm.sh/three@0.168.0';
import { OrbitControls } from 'https://esm.sh/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'https://esm.sh/three@0.168.0/examples/jsm/exporters/STLExporter.js';

const MSG = document.querySelector('#msg');
const INFO = document.querySelector('#info');
const canvas = document.querySelector('#preview');

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f7f8);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(50, 50, 100);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 1));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
dirLight.position.set(60, -60, 160);
scene.add(dirLight);

// Grid
const gridHelper = new THREE.GridHelper(200, 20, 0xcccccc, 0xe5e5e5);
scene.add(gridHelper);

// Global variables
let converter = new PNGToSTLConverter();
let currentMesh = null;
let currentSTLBlob = null;

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

// Enable/disable downsample inputs
document.querySelector('#enableDownsample').addEventListener('change', (e) => {
    document.querySelector('#maxPixels').disabled = !e.target.checked;
});

// Generate STL from image
document.querySelector('#generateBtn').addEventListener('click', async () => {
    const fileInput = document.querySelector('#imageFile');
    const file = fileInput.files[0];
    
    if (!file) {
        MSG.textContent = '❌ กรุณาเลือกไฟล์รูปภาพ';
        return;
    }
    
    MSG.textContent = '⏳ กำลังสร้างโมเดล 3D...';
    INFO.textContent = '';
    document.querySelector('#downloadSTL').disabled = true;
    
    try {
        // Get options
        const thickness = parseFloat(document.querySelector('#thickness').value) || 2.0;
        const threshold = parseInt(document.querySelector('#threshold').value) || 128;
        const sizeMode = document.querySelector('input[name="sizeMode"]:checked').value;
        const sizeValue = parseFloat(document.querySelector('#sizeValue').value) || 50;
        const enableDownsample = document.querySelector('#enableDownsample').checked;
        const maxPixels = enableDownsample ? parseInt(document.querySelector('#maxPixels').value) : null;
        
        const options = {
            thickness: thickness,
            threshold: threshold,
            max_px: maxPixels
        };
        
        if (sizeMode === 'width') {
            options.width_mm = sizeValue;
        } else if (sizeMode === 'height') {
            options.height_mm = sizeValue;
        }
        
        // Generate STL
        const stlBlob = await converter.generateSTL(file, options);
        currentSTLBlob = stlBlob;
        
        // Show STL in preview
        await loadSTLPreview(stlBlob);
        
        // Show file info
        const sizeMB = (stlBlob.size / (1024 * 1024)).toFixed(2);
        INFO.textContent = `📊 ขนาดไฟล์: ${sizeMB} MB | ความหนา: ${thickness} mm`;
        
        MSG.textContent = '✅ สร้างโมเดล 3D สำเร็จ!';
        document.querySelector('#downloadSTL').disabled = false;
        
    } catch (error) {
        console.error(error);
        MSG.textContent = `❌ เกิดข้อผิดพลาด: ${error.message}`;
        INFO.textContent = '';
    }
});

// Load STL and show in preview
async function loadSTLPreview(stlBlob) {
    // Remove old mesh
    if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh.geometry.dispose();
        currentMesh.material.dispose();
        currentMesh = null;
    }
    
    // Load STL from blob
    const arrayBuffer = await stlBlob.arrayBuffer();
    const geometry = parseSTL(arrayBuffer);
    
    // Center geometry
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    
    // Create mesh
    const material = new THREE.MeshStandardMaterial({
        color: 0x696FC7,
        metalness: 0.1,
        roughness: 0.5,
        emissive: 0x696FC7,
        emissiveIntensity: 0.15
    });
    
    currentMesh = new THREE.Mesh(geometry, material);
    scene.add(currentMesh);
    
    // Adjust camera
    const box = new THREE.Box3().setFromObject(currentMesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;
    
    camera.position.set(distance * 0.5, distance * 0.5, distance);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}

// Parse binary STL
function parseSTL(arrayBuffer) {
    const dataView = new DataView(arrayBuffer);
    
    // Skip header (80 bytes)
    const triangleCount = dataView.getUint32(80, true);
    
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const normals = [];
    
    let offset = 84;
    for (let i = 0; i < triangleCount; i++) {
        // Normal (12 bytes)
        const nx = dataView.getFloat32(offset, true); offset += 4;
        const ny = dataView.getFloat32(offset, true); offset += 4;
        const nz = dataView.getFloat32(offset, true); offset += 4;
        
        // Vertices (36 bytes)
        for (let j = 0; j < 3; j++) {
            const x = dataView.getFloat32(offset, true); offset += 4;
            const y = dataView.getFloat32(offset, true); offset += 4;
            const z = dataView.getFloat32(offset, true); offset += 4;
            
            vertices.push(x, y, z);
            normals.push(nx, ny, nz);
        }
        
        // Attribute byte count (2 bytes)
        offset += 2;
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    return geometry;
}

// Download STL
document.querySelector('#downloadSTL').addEventListener('click', () => {
    if (!currentSTLBlob) {
        MSG.textContent = '❌ ยังไม่มีไฟล์ให้ดาวน์โหลด';
        return;
    }
    
    const fileInput = document.querySelector('#imageFile');
    const originalName = fileInput.files[0]?.name || 'model';
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(currentSTLBlob);
    a.download = `${baseName}.stl`;
    a.click();
    URL.revokeObjectURL(a.href);
    
    MSG.textContent = '✅ ดาวน์โหลด STL สำเร็จ';
});

// Preview image when selected
document.querySelector('#imageFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        MSG.textContent = `📁 เลือกไฟล์: ${file.name}`;
        INFO.textContent = '';
    }
});
