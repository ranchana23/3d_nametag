// png-extrude.js
// Add PNG upload and extrude functionality for Tag3D project
import * as THREE from 'https://esm.sh/three@0.168.0';

export async function addPNGExtrudeToScene({ file, extrudeDepth, scene, addLayer, scale = 1 }) {
    // Load PNG as image
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
    });
    // Draw image to canvas and get pixel data
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    // Convert white/black pixels to shape (trace contour)
    const threshold = 128;
    // Create binary mask for black pixels
    const mask = [];
    for (let y = 0; y < img.height; y++) {
        mask[y] = [];
        for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            // Use average of RGB for threshold
            const r = imageData.data[i];
            const g = imageData.data[i+1];
            const b = imageData.data[i+2];
            const v = (r + g + b) / 3;
            mask[y][x] = v < threshold ? 1 : 0;
        }
    }
    // Improved contour tracing using marching squares
    function getContours(mask) {
        const w = mask[0].length, h = mask.length;
        const contours = [];
        const visited = Array.from({ length: h }, () => Array(w).fill(false));
        function trace(x0, y0) {
            let x = x0, y = y0, dir = 0, start = true;
            const points = [];
            do {
                points.push([x, y]);
                visited[y][x] = true;
                let found = false;
                for (let d = 0; d < 8; d++) {
                    const dx = [-1, 0, 1, 1, 1, 0, -1, -1][d];
                    const dy = [-1, -1, -1, 0, 1, 1, 1, 0][d];
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny][nx] && !visited[ny][nx]) {
                        x = nx; y = ny; found = true; break;
                    }
                }
                if (!found) break;
                if (x === x0 && y === y0 && !start) break;
                start = false;
            } while (points.length < 10000);
            return points;
        }
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (mask[y][x] && !visited[y][x]) {
                    const c = trace(x, y);
                    if (c.length > 2) contours.push(c);
                }
            }
        }
        return contours;
    }
    const allContours = getContours(mask);
    if (allContours.length === 0) return;
    // Sort contours by area (largest first = outer)
    function contourArea(contour) {
        let area = 0;
        for (let i = 0; i < contour.length; i++) {
            const [x1, y1] = contour[i];
            const [x2, y2] = contour[(i + 1) % contour.length];
            area += (x1 * y2 - x2 * y1);
        }
        return Math.abs(area / 2);
    }
    allContours.sort((a, b) => contourArea(b) - contourArea(a));
    // กรองเฉพาะ contour ที่ใหญ่ที่สุด (ถ้า area < 20% ของใหญ่สุด ให้ข้าม)
    const mainArea = contourArea(allContours[0]);
    const minArea = mainArea * 0.2;
    const filteredContours = allContours.filter((c, idx) => idx === 0 || contourArea(c) > minArea);
    // Create shape with holes
    const shape = new THREE.Shape();
    // Outer contour
    const outer = filteredContours[0];
    shape.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length; i++) {
        shape.lineTo(outer[i][0], outer[i][1]);
    }
    shape.lineTo(outer[0][0], outer[0][1]);
    // Holes (inner contours)
    for (let h = 1; h < filteredContours.length; h++) {
        const hole = new THREE.Path();
        hole.moveTo(filteredContours[h][0][0], filteredContours[h][0][1]);
        for (let i = 1; i < filteredContours[h].length; i++) {
            hole.lineTo(filteredContours[h][i][0], filteredContours[h][i][1]);
        }
        hole.lineTo(filteredContours[h][0][0], filteredContours[h][0][1]);
        shape.holes.push(hole);
    }
    // Extrude
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeDepth,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 24
    });
    geometry.computeVertexNormals();
    // Center and scale mesh
    geometry.translate(-img.width/2, -img.height/2, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(scale, scale, scale);
    scene.add(mesh);
    addLayer(mesh, 'PNG Extrude');
}
