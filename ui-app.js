// ui-app.js — preview + STL export one-piece
import * as THREE from 'https://esm.sh/three@0.168.0';
import { OrbitControls } from 'https://esm.sh/three@0.168.0/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'https://esm.sh/three@0.168.0/examples/jsm/exporters/STLExporter.js';
import { ThreeMFExporter } from './3MFExporter.js';
import { SVGLoader } from 'https://esm.sh/three@0.168.0/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'https://esm.sh/three@0.168.0/examples/jsm/utils/BufferGeometryUtils.js';

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

// let mergedMesh = null;
// ลบบรรทัด: let mergedMesh = null;
let baseMesh = null;
let textMesh = null;


// Config
function cfg() {
    return {
        style: document.querySelector('#style')?.value || 'raised',
        text: document.querySelector('#text').value || 'Ranchana',
        letterHeight: parseFloat(document.querySelector('#letterHeight').value) || 3.0,
        baseHeight: parseFloat(document.querySelector('#baseHeight').value) || 2.0,
        outline: parseFloat(document.querySelector('#outline').value) || 4.0,
        mmPerUnit: parseFloat(MM_PER_UNIT_INPUT.value) || 0.25,
        // รู
        earPlacement: document.querySelector('#earPlacement')?.value || 'side',
        earEnabled: document.querySelector('#earEnabled').value === 'true',
        earSide: document.querySelector('#earSide').value,
        holeDiameter: parseFloat(document.querySelector('#holeDiameter').value) || 6.0,
        earRingThickness: parseFloat(document.querySelector('#earRingThickness').value) || 2.0,
        earAttachOverlap: parseFloat(document.querySelector('#earAttachOverlap').value) || 2.0,
        earYShift: parseFloat(document.querySelector('#earYShift').value) || 0.0,

        // กว้างรวมเป้าหมาย (mm)
        totalWidth: parseFloat(document.querySelector('#totalWidth')?.value),
        letterSpacing: parseFloat(document.querySelector('#letterSpacing')?.value) || 0.0,

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
async function loadDefaultFont() {
    if (fontBuffer) return;
    const resp = await fetch('./iann_b.ttf');
    if (!resp.ok) throw new Error(`โหลด iann_b.ttf ไม่ได้ (HTTP ${resp.status})`);
    const buf = await resp.arrayBuffer();
    if (!isLikelyFontBuffer(buf)) throw new Error('ไฟล์ iann_b.ttf ไม่ใช่ TTF/OTF');
    fontBuffer = buf;
    MSG.textContent = 'ใช้ฟอนต์ Default (iann_b.ttf)';
}
// รวม path ของข้อความแบบกำหนด letter-spacing (mm) + รองรับ kerning
function buildTextPathWithSpacing(font, text, fontSize, letterSpacingMM, mmPerUnit) {
    const path = new opentype.Path();
    if (!text || !font) return path;

    // letterSpacing ใน "หน่วย path" (font space หลังคูณ fontSize/unitsPerEm)
    // เราทำให้ spacingMM (mm) -> font units โดย spacingFU = mm / mmPerUnit
    // แต่เพราะ getPath ใช้หน่วย path (font units * fontSize/unitsPerEm),
    // เราจะใช้ spacingPath = spacingFU * (fontSize / font.unitsPerEm)
    const spacingFU = letterSpacingMM / mmPerUnit; // font units
    const scale = fontSize / font.unitsPerEm;      // font units -> path units
    const spacingPath = spacingFU * scale;         // path units

    const glyphs = font.stringToGlyphs(text);
    let x = 0;
    const y = 0;

    for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];

        // เพิ่ม path ของ glyph นี้
        const gp = g.getPath(x, y, fontSize);
        gp.commands.forEach(cmd => path.commands.push(cmd));

        // ระยะขยับสำหรับ glyph ถัดไป = advance + kerning + letterSpacing
        let advance = (g.advanceWidth || 0) * scale;

        // kerning (ใน font units) -> path units
        if (i < glyphs.length - 1) {
            const next = glyphs[i + 1];
            const kernFU = font.getKerningValue ? font.getKerningValue(g, next) : 0; // font units
            const kernPath = kernFU * scale;
            advance += kernPath;
        }

        // เพิ่ม letter spacing (path units)
        advance += spacingPath;

        x += advance;
    }

    return path;
}

// --- Geometry ---
async function buildGeometries() {
    if (!fontBuffer) await loadDefaultFont();
    const font = opentype.parse(fontBuffer);
    const fontSize = 100;
    const c = cfg();

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

    // ใช้ path แบบมี letter spacing
    const otPath = buildTextPathWithSpacing(font, c.text, fontSize, c.letterSpacing, c.mmPerUnit);
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
            depth: c.letterHeight, bevelEnabled: false, curveSegments: 24, steps: 1
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
            const rHole = c.holeDiameter * 0.5;
            const rHoleFU = rHole / c.mmPerUnit;

            if ((c.earPlacement || 'side') === 'side') {
                // ---------- แบบเดิม: หูด้านข้าง ----------
                const rOuter = rHole + c.earRingThickness;
                const rOuterFU = rOuter / c.mmPerUnit;
                const yCenterFU = (minY + maxY) / 2 + (c.earYShift / c.mmPerUnit);
                const attachFU = c.earAttachOverlap / c.mmPerUnit;
                const cxFU = (c.earSide === 'right')
                    ? (maxX + rOuterFU - attachFU)
                    : (minX - rOuterFU + attachFU);

                const earShape = new THREE.Shape();
                earShape.absarc(cxFU, yCenterFU, rOuterFU, 0, Math.PI * 2, false);
                const earHole = new THREE.Path();
                earHole.absarc(cxFU, yCenterFU, rHoleFU, 0, Math.PI * 2, false);
                earShape.holes.push(earHole);
                baseShapes.push(earShape);
            } else {
                // ---------- ใหม่: เจาะรู "ในกรอบ" ----------
                const wallFU = (c.earRingThickness / c.mmPerUnit) || 0; // ใช้เป็นระยะห่างจากขอบ
                const yCenterFU = (minY + maxY) / 2 + (c.earYShift / c.mmPerUnit);
                const cxFU = (c.earSide === 'right')
                    ? (maxX - wallFU - rHoleFU)
                    : (minX + wallFU + rHoleFU);

                // เจาะรูลงใน shape หลัก: เลือก shape ที่มีพื้นที่มากสุด (มักเป็นชิ้นนอก)
                let targetShape = baseShapes[0];
                if (baseShapes.length > 1) {
                    targetShape = baseShapes.reduce((a, b) =>
                        (a.getArea ? a.getArea() : 0) > (b.getArea ? b.getArea() : 0) ? a : b
                    );
                }
                const inner = new THREE.Path();
                inner.absarc(cxFU, yCenterFU, rHoleFU, 0, Math.PI * 2, false);
                targetShape.holes.push(inner);
            }
        }


        const baseGeom = new THREE.ExtrudeGeometry(baseShapes, {
            depth: c.baseHeight, bevelEnabled: false, curveSegments: 18, steps: 1
        });
        baseGeom.scale(c.mmPerUnit, -c.mmPerUnit, 1);
        baseGeom.computeVertexNormals();
        baseGeom.translate(0, 0, -c.baseHeight);

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
            // ถ้ารูอยู่ขวา -> ขยับตัวอักษรไปทางซ้าย (ค่าลบ), ถ้ารูอยู่ซ้าย -> ขยับไปขวา
            textOffsetXFU = (c.earSide === 'right') ? -keepAwayFU : keepAwayFU;
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

            const wallFU = (c.earRingThickness / c.mmPerUnit) || 0; // ระยะจากขอบกรอบ
            const yCenterFU = (minY + maxY) / 2 + (c.earYShift / c.mmPerUnit);
            const cxFU = (c.earSide === 'right')
                ? (maxX - wallFU - rHoleFU)
                : (minX + wallFU + rHoleFU);

            // รูจริงเพียง "วงเดียว" และทำเป็น clockwise เพื่อเป็น hole ชัดเจน
            const inner = new THREE.Path();
            inner.absarc(cxFU, yCenterFU, rHoleFU, 0, Math.PI * 2, true /* clockwise */);
            frameShapeFU.holes.push(inner);
        }




        // --- โหมดหูด้านข้างเดิม (อยู่หลังจากนี้ตามโค้ดคุณ)
        if (c.earEnabled && (c.earPlacement || 'side') === 'side') {
            const rHole = c.holeDiameter * 0.5;
            const rOuter = rHole + c.earRingThickness;
            const rOuterFU = rOuter / c.mmPerUnit;
            const rHoleFU = rHole / c.mmPerUnit;
            const yCenterFU = (minY + maxY) / 2 + (c.earYShift / c.mmPerUnit);
            const attachFU = c.earAttachOverlap / c.mmPerUnit;
            const cxFU = (c.earSide === 'right') ? (maxX + rOuterFU - attachFU) : (minX - rOuterFU + attachFU);

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


async function refresh() {
    try {
        const { textGeom, baseGeom } = await buildGeometries();

        // สเกลให้ตรงความกว้างรวม (ถ้ากำหนด)
        const c = cfg();
        scaleToTargetWidth(baseGeom, textGeom, c.totalWidth);

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

        // สร้าง base mesh (ต้องมีเสมอ)
        baseMesh = new THREE.Mesh(
            baseGeom,
            new THREE.MeshStandardMaterial({
                color: new THREE.Color(c.baseColor),
                metalness: 0.0,
                roughness: 0.9
            })
        );
        scene.add(baseMesh);

        // สำหรับ raised: มี textGeom; สำหรับ cutout: textGeom อาจว่าง -> ข้าม
        if (hasVerts(textGeom)) {
            textMesh = new THREE.Mesh(
                textGeom,
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(c.textColor),
                    metalness: 0.0,
                    roughness: 0.7
                })
            );
            scene.add(textMesh);
        }

        // fit view (ใช้เฉพาะ mesh ที่มีอยู่จริง)
        const tempGroup = new THREE.Group();
        tempGroup.add(baseMesh.clone());
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

// Viewport controls
function setCameraView(view) {
    // คำนวณ centroid จาก baseMesh/textMesh
    const tempGroup = new THREE.Group();
    if (baseMesh) tempGroup.add(baseMesh.clone());
    if (textMesh) tempGroup.add(textMesh.clone());
    const box = new THREE.Box3().setFromObject(tempGroup);
    tempGroup.clear();
    if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;
    const centroid = box.getCenter(new THREE.Vector3());
    const sizeVec = box.getSize(new THREE.Vector3());
    const size = sizeVec.length();
    let pos = { x: centroid.x, y: centroid.y, z: centroid.z };
    switch(view) {
        case 'top':
            pos.z += size;
            break;
        case 'bottom':
            pos.z -= size;
            break;
        case 'front':
            pos.y -= size;
            break;
        case 'back':
            pos.y += size;
            break;
        case 'side':
            pos.x += size;
            break;
        default:
            pos.z += size;
    }
    camera.position.set(pos.x, pos.y, pos.z);
    controls.target.copy(centroid);
    controls.update();
}
document.querySelectorAll('#viewport-controls button').forEach(btn => {
    btn.addEventListener('click', e => {
        setCameraView(btn.dataset.view);
    });
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
        scaleToTargetWidth(baseGeom, textGeom, c.totalWidth);
        centerPair(baseGeom, textGeom);

        // helper: เช็คว่า geometry มีจุดจริงไหม
        const hasVerts = (g) => g && g.attributes && g.attributes.position && g.attributes.position.count > 0;

        // สร้าง base mesh (ต้องมีเสมอ)
        const newBaseMesh = new THREE.Mesh(
            baseGeom,
            new THREE.MeshStandardMaterial({
                color: new THREE.Color(c.baseColor),
                metalness: 0.0,
                roughness: 0.9
            })
        );
        scene.add(newBaseMesh);

        // สำหรับ raised: มี textGeom; สำหรับ cutout: textGeom อาจว่าง -> ข้าม
        if (hasVerts(textGeom)) {
            const newTextMesh = new THREE.Mesh(
                textGeom,
                new THREE.MeshStandardMaterial({
                    color: new THREE.Color(c.textColor),
                    metalness: 0.0,
                    roughness: 0.7
                })
            );
            scene.add(newTextMesh);
        }
        MSG.textContent = '✅ เพิ่ม nametag ในเฟรมแล้ว';
    } catch (e) {
        console.error(e);
        MSG.textContent = 'มีข้อผิดพลาดตอนเพิ่ม nametag (ดู Console)';
    }
});
document.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('input', () => { if (el.id !== 'font') refresh(); });
});
document.querySelector('#font').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    if (!isLikelyFontBuffer(buf)) { MSG.textContent = '❌ ต้องเป็น .ttf หรือ .otf'; return; }
    fontBuffer = buf; MSG.textContent = `โหลดฟอนต์: ${f.name}`; await refresh();
});
document.querySelector('#exportSTL').addEventListener('click', () => {
    try {
        // mesh อาจยังไม่ถูกสร้าง (กรณี refresh ล้มเหลว ฯลฯ)
        if (!baseMesh && !textMesh) {
            MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก (ลองกด Refresh ก่อน)';
            return;
        }

        const hasVerts = (geom) =>
            geom && geom.attributes && geom.attributes.position && geom.attributes.position.count > 0;

        const geoms = [];
        if (baseMesh?.geometry && hasVerts(baseMesh.geometry)) {
            geoms.push(baseMesh.geometry.clone());
        }
        if (textMesh?.geometry && hasVerts(textMesh.geometry)) {
            geoms.push(textMesh.geometry.clone());
        }

        if (geoms.length === 0) {
            MSG.textContent = '❌ ไม่มี geometry ให้ส่งออก';
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
        a.download = `nametag_${(document.querySelector('#text').value || 'Ranchana')}.stl`;
        a.click();
        URL.revokeObjectURL(a.href);

        MSG.textContent = '✅ ส่งออก STL สำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ ส่งออก STL ไม่สำเร็จ';
    }
});

// เพิ่ม event สำหรับ export 3MF
document.querySelector('#export3MF').addEventListener('click', () => {
    try {
        if (!baseMesh && !textMesh) {
            MSG.textContent = '❌ ยังไม่มีโมเดลให้ส่งออก (ลองกด Refresh ก่อน)';
            return;
        }
        const hasVerts = (geom) =>
            geom && geom.attributes && geom.attributes.position && geom.attributes.position.count > 0;
        const geoms = [];
        if (baseMesh?.geometry && hasVerts(baseMesh.geometry)) {
            geoms.push(baseMesh.geometry.clone());
        }
        if (textMesh?.geometry && hasVerts(textMesh.geometry)) {
            geoms.push(textMesh.geometry.clone());
        }
        if (geoms.length === 0) {
            MSG.textContent = '❌ ไม่มี geometry ให้ส่งออก';
            return;
        }
        const mergedForExport = BufferGeometryUtils.mergeGeometries(geoms, false);
        if (!mergedForExport) {
            MSG.textContent = '❌ รวมชิ้นงานไม่สำเร็จ';
            return;
        }
        // ใช้ ThreeMFExporter (mock)
        const exporter = new ThreeMFExporter();
        const group = new THREE.Group();
        group.add(new THREE.Mesh(mergedForExport));
        const model = exporter.parse(group);
        if (!model || typeof model !== 'string') {
            MSG.textContent = '❌ 3MF export ยังไม่รองรับในเดโมนี้';
            return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([model], { type: 'model/3mf' }));
        a.download = `nametag_${(document.querySelector('#text').value || 'Ranchana')}.3mf`;
        a.click();
        URL.revokeObjectURL(a.href);
        MSG.textContent = '✅ ส่งออก 3MF สำเร็จ';
    } catch (e) {
        console.error(e);
        MSG.textContent = '❌ ส่งออก 3MF ไม่สำเร็จ';
    }
});



// Start
await loadDefaultFont();
applyStyleUI();   // ✅ แสดง UI ให้ตรงกับสไตล์เริ่มต้น
await refresh();
