// crop_image.js
// ใช้ Node.js + sharp สำหรับ crop รูป PNG ให้สุดขอบ (auto-crop transparency)
// วิธีใช้: node crop_image.js <input.png> <output.png>

const sharp = require('sharp');
const fs = require('fs');

async function autoCrop(inputPath, outputPath) {
    // อ่านรูป
    const image = sharp(inputPath);
    // ใช้ trim() ของ sharp เพื่อตัดขอบโปร่งใสออก
    await image.trim().toFile(outputPath);
    console.log('Crop เสร็จสิ้น:', outputPath);
}

// รับ argument จาก command line
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
    console.log('วิธีใช้: node crop_image.js <input.png> <output.png>');
    process.exit(1);
}

// ตรวจสอบไฟล์
if (!fs.existsSync(inputPath)) {
    console.error('ไม่พบไฟล์:', inputPath);
    process.exit(1);
}

autoCrop(inputPath, outputPath).catch(err => {
    console.error('เกิดข้อผิดพลาด:', err.message);
});
