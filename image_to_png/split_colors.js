// split_colors.js
// Node.js script to split PNG image into separate black & white images for each color (excluding white background)
// Usage: node split_colors.js input.png

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const colorDiff = require('color-diff');

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
  fs.createReadStream(inputPath)
    .pipe(new PNG())
    .on('parsed', function () {
      const colorMap = {};
      // Scan all pixels, collect colors (excluding white)
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const idx = (this.width * y + x) << 2;
          const r = this.data[idx];
          const g = this.data[idx + 1];
          const b = this.data[idx + 2];
          const a = this.data[idx + 3];
          if (!isWhite(r, g, b, a) && a > 0) {
            const hex = rgbaToHex(r, g, b);
            colorMap[hex] = colorMap[hex] ? colorMap[hex] + 1 : 1;
          }
        }
      }
      // Get up to 4 colors (excluding white)
      const colors = Object.keys(colorMap).sort((a, b) => colorMap[b] - colorMap[a]).slice(0, 4);
      if (colors.length === 0) {
        console.log('No colors found except white.');
        return;
      }
      // For each color, create a new PNG
      colors.forEach((colorHex, i) => {
        const outPng = new PNG({ width: this.width, height: this.height });
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            const idx = (this.width * y + x) << 2;
            const r = this.data[idx];
            const g = this.data[idx + 1];
            const b = this.data[idx + 2];
            const a = this.data[idx + 3];
              // If pixel matches color, set black, else white
              const pixelHex = rgbaToHex(r, g, b);
              if (pixelHex === colorHex && a > 0) {
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
        const outName = path.basename(inputPath, '.png') + `_color${i + 1}.png`;
        outPng.pack().pipe(fs.createWriteStream(outName));
        console.log(`Created: ${outName} for color ${colorHex}`);
      });
    });
}

// CLI usage
if (process.argv.length < 3) {
  console.log('Usage: node split_colors.js input.png');
  process.exit(1);
}

splitColors(process.argv[2]);
