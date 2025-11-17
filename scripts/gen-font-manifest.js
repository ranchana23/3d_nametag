#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'font');
const OUT_FILE = path.join(FONT_DIR, 'manifest.json');

function walk(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      results.push(...walk(full));
    } else if (it.isFile()) {
      const ext = path.extname(it.name).toLowerCase();
      if (ext === '.ttf' || ext === '.otf') {
        // make relative path from repo root
        results.push(path.relative(path.join(__dirname, '..'), full).replace(/\\/g, '/'));
      }
    }
  }
  return results;
}

const fonts = walk(FONT_DIR).sort();
fs.writeFileSync(OUT_FILE, JSON.stringify(fonts, null, 2) + '\n', 'utf8');
console.log('Wrote', OUT_FILE, 'with', fonts.length, 'fonts');
