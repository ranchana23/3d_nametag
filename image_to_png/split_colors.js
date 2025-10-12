// split_colors.js
// Node.js script to split PNG image into separate black & white images for each color (excluding white background)
// Usage: node split_colors.js input.png

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const colorDiff = require('color-diff');
const quantize = require('quantize');

// Helper: Convert RGBA to hex
function rgbaToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Helper: Check if pixel is white (background)
function isWhite(r, g, b, a) {
  return a > 0 && r > 250 && g > 250 && b > 250;
}

// Main function
function splitColors(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.png') {
    fs.createReadStream(inputPath)
      .pipe(new PNG())
      .on('parsed', function () {
        processImage(this.width, this.height, this.data, inputPath, ext, true);
      });
  } else if (ext === '.jpg' || ext === '.jpeg') {
    const jpegData = fs.readFileSync(inputPath);
    const raw = jpeg.decode(jpegData, { useTArray: true });
    // Convert to RGBA (add alpha=255)
    const rgbaData = Buffer.alloc(raw.width * raw.height * 4);
    for (let i = 0, j = 0; i < raw.data.length; i += 3, j += 4) {
      rgbaData[j] = raw.data[i];
      rgbaData[j + 1] = raw.data[i + 1];
      rgbaData[j + 2] = raw.data[i + 2];
      rgbaData[j + 3] = 255;
    }
    processImage(raw.width, raw.height, rgbaData, inputPath, ext, false);
  } else {
    console.log('Unsupported file type. Use PNG or JPG.');
    process.exit(1);
  }
}

function processImage(width, height, data, inputPath, ext, isPng) {
  // 1. สร้าง array ของ pixel ที่ไม่ใช่สีขาว
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      if (!isWhite(r, g, b, a) && a > 0) {
        pixels.push([r, g, b]);
      }
    }
  }
  // 2. ใช้ quantize ลดจำนวนสีเหลือไม่เกิน 4 สี
  let palette = [];
  const maxColors = 4; // ปรับจำนวนสีหลักที่ต้องการ
  if (pixels.length > 0) {
    palette = quantize(pixels, Math.min(maxColors, pixels.length)).palette();
  }
  if (palette.length === 0) {
    console.log('No colors found except white.');
    return;
  }
  // 3. สำหรับแต่ละสีใน palette สร้างไฟล์ขาวดำ
  palette.forEach((colorArr, i) => {
    const colorHex = rgbaToHex(colorArr[0], colorArr[1], colorArr[2]);
    const outPng = new PNG({ width, height });
  const threshold = 128; // ปรับ threshold ให้สูงขึ้น
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        // เทียบสีด้วยระยะ Euclidean
        const dist = Math.sqrt(
          Math.pow(r - colorArr[0], 2) +
          Math.pow(g - colorArr[1], 2) +
          Math.pow(b - colorArr[2], 2)
        );
        if (dist < threshold && a > 0) {
          outPng.data[idx] = 0;
          outPng.data[idx + 1] = 0;
          outPng.data[idx + 2] = 0;
          outPng.data[idx + 3] = a;
        } else {
          outPng.data[idx] = 255;
          outPng.data[idx + 1] = 255;
          outPng.data[idx + 2] = 255;
          outPng.data[idx + 3] = a;
        }
      }
    }
    const outName = path.basename(inputPath, ext) + `_color${i + 1}.png`;
    outPng.pack().pipe(fs.createWriteStream(outName));
    console.log(`Created: ${outName} for color ${colorHex}`);
  });
}


// CLI usage
if (process.argv.length < 3) {
  console.log('Usage: node split_colors.js input.png');
  process.exit(1);
}

splitColors(process.argv[2]);
