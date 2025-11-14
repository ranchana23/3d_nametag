// nametag.mjs — Node 18+, ESM
import fs from 'fs';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import opentype from 'opentype.js';
import { DOMParser as XMlDOMParser } from '@xmldom/xmldom';
import ClipperLib from 'clipper-lib';

global.DOMParser = XMlDOMParser;

// dynamic import สำหรับ three-3mf-exporter
const { exportTo3MF } = await import('three-3mf-exporter');


// ---------- CONFIG ----------
const CONFIG = {
  text: process.env.TEXT || 'Anna',
  fontPath: process.env.FONT || './Butterfly.ttf',

  // ขนาดหลัก
  letterHeight: 3.0,   // mm
  baseHeight: 2.0,     // mm
  outline: 6.0,        // mm

  // ปีกฐาน + รูแขวน
  earEnabled: true,
  earSide: 'left',         // 'left' | 'right'
  holeDiameter: 6.0,       // mm
  earRingThickness: 2.0,   // mm
  earAttachOverlap: 2.0,   // mm
  earYShift: 0.0,          // mm

  fontSize: 100,
  output3mf: (t) => `nametag_${t}.3mf`,
  outputSTLBase: (t) => `nametag_${t}_base.stl`,
  outputSTLLetters: (t) => `nametag_${t}_letters.stl`,
};

// หน่วยฟอนต์ -> mm
const MM_PER_UNIT = 0.25;

// ---------- Helpers ----------
function svgFromOpenType(pathData) {
  return `<svg xmlns="http://www.w3.org/2000/svg">
    <path d="${pathData}" fill="#000" stroke="none" fill-rule="nonzero"/>
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
    if (c.type === 'M') {
      if (current.length) { contours.push(current); current = []; }
      penX = startX = c.x; penY = startY = c.y; add(penX, penY);
    } else if (c.type === 'L') {
      penX = c.x; penY = c.y; add(penX, penY);
    } else if (c.type === 'Q') {
      const x0 = penX, y0 = penY;
      for (let i = 1; i <= step; i++) {
        const t = i / step, mt = 1 - t;
        const x = mt * mt * x0 + 2 * mt * t * c.x1 + t * t * c.x;
        const y = mt * mt * y0 + 2 * mt * t * c.y1 + t * t * c.y;
        add(x, y);
      }
      penX = c.x; penY = c.y;
    } else if (c.type === 'C') {
      const x0 = penX, y0 = penY;
      for (let i = 1; i <= step; i++) {
        const t = i / step, mt = 1 - t;
        const x = mt * mt * mt * x0 + 3 * mt * mt * t * c.x1 + 3 * mt * t * t * c.x2 + t * t * t * c.x;
        const y = mt * mt * mt * y0 + 3 * mt * mt * t * c.y1 + 3 * mt * t * t * c.y2 + t * t * t * c.y;
        add(x, y);
      }
      penX = c.x; penY = c.y;
    } else if (c.type === 'Z') {
      if (current.length) { contours.push(current); current = []; }
      penX = startX; penY = startY;
    }
  }
  if (current.length) contours.push(current);
  return contours;
}
function polygonToShape(poly) {
  const s = new THREE.Shape();
  poly.forEach((p, i) => (i ? s.lineTo(p.X, p.Y) : s.moveTo(p.X, p.Y)));
  s.closePath();
  return s;
}

// ---------- Main ----------
(async () => {
  // 1) text → SVG → Shapes
  const font = await opentype.load(CONFIG.fontPath);
  const otPath = font.getPath(CONFIG.text, 0, 0, CONFIG.fontSize);
  const svg = svgFromOpenType(otPath.toPathData(3));
  const shapes = toShapesFromSVG(svg);

  // 2) ตัวอักษร
  const textGeom = new THREE.ExtrudeGeometry(shapes, {
    depth: CONFIG.letterHeight,
    bevelEnabled: false,
    curveSegments: 24,
    steps: 1
  });
  textGeom.scale(MM_PER_UNIT, -MM_PER_UNIT, 1);
  textGeom.computeVertexNormals();

  // 3) ฐาน offset
  const contours = samplePathCommands(otPath.commands, 16);
  const CLIP = 100;
  const offsetter = new ClipperLib.ClipperOffset(2, 0.25);
  for (const c of contours) {
    offsetter.AddPath(
      c.map(pt => ({ X: pt.X * CLIP, Y: pt.Y * CLIP })),
      ClipperLib.JoinType.jtRound,
      ClipperLib.EndType.etClosedPolygon
    );
  }
  const outPaths = [];
  offsetter.Execute(outPaths, (CONFIG.outline / MM_PER_UNIT) * CLIP);

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

  // 4) ปีกฐาน + รูแขวน
  if (CONFIG.earEnabled) {
    const rHole = CONFIG.holeDiameter * 0.5;
    const rOuter = rHole + CONFIG.earRingThickness;
    const rOuterFU = rOuter / MM_PER_UNIT;
    const rHoleFU = rHole / MM_PER_UNIT;
    const yCenterFU = (minY + maxY) * 0.5 + (CONFIG.earYShift / MM_PER_UNIT);
    const attachFU = CONFIG.earAttachOverlap / MM_PER_UNIT;
    const cxFU = (CONFIG.earSide === 'right')
      ? (maxX + rOuterFU - attachFU)
      : (minX - rOuterFU + attachFU);
    const earShape = new THREE.Shape();
    earShape.absarc(cxFU, yCenterFU, rOuterFU, 0, Math.PI * 2, false);
    const earHole = new THREE.Path();
    earHole.absarc(cxFU, yCenterFU, rHoleFU, 0, Math.PI * 2, false);
    earShape.holes.push(earHole);
    baseShapes.push(earShape);
  }

  // 5) Extrude เป็นฐาน
  let baseGeom = new THREE.ExtrudeGeometry(baseShapes, {
    depth: CONFIG.baseHeight,
    bevelEnabled: false,
    curveSegments: 18,
    steps: 1
  });
  baseGeom.scale(MM_PER_UNIT, -MM_PER_UNIT, 1);
  baseGeom.computeVertexNormals();
  baseGeom.translate(0, 0, -CONFIG.baseHeight);

  // 6) รวมเป็น group (2 bodies)
  const mergedForCenter = BufferGeometryUtils.mergeGeometries(
    [baseGeom.clone(), textGeom.clone()], false
  );
  const box = new THREE.Box3().setFromBufferAttribute(
    mergedForCenter.getAttribute('position')
  );
  const center = box.getCenter(new THREE.Vector3());

  const baseMesh = new THREE.Mesh(baseGeom); baseMesh.name = 'Base';
  const textMesh = new THREE.Mesh(textGeom); textMesh.name = 'Letters';
  baseMesh.position.sub(center);
  textMesh.position.sub(center);

  const group = new THREE.Group();
  group.add(baseMesh);
  group.add(textMesh);

  // ถ้าแกนผิด ลองเปิดใช้
  // group.rotateX(Math.PI);

  // 7) Export 3MF
  const exporter3MF = new ThreeMFExporter();
  const ab = exporter3MF.parse(group);
  const output = (typeof ab === 'string') ? ab : Buffer.from(ab);
  fs.writeFileSync(CONFIG.output3mf(CONFIG.text), output);



  console.log('✅ Exported 3MF:', CONFIG.output3mf(CONFIG.text));
})();
