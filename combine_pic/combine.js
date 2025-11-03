// โปรแกรมรวมรูป PNG เป็นรูปเดียวขนาด 1:1 ด้วย Node.js และ sharp
// วิธีใช้: node combine.js <input_folder> <output_file>

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function combineImages(inputFolder, outputFile) {
    // อ่านไฟล์ PNG ทั้งหมด
    const files = fs.readdirSync(inputFolder)
        .filter(f => f.toLowerCase().endsWith('.png'));
    if (files.length === 0) {
        throw new Error('ไม่พบไฟล์ PNG ในโฟลเดอร์นี้');
    }

    // กำหนดขนาดตาราง (เช่น 9 รูป = 3x3)
    const gridSize = Math.ceil(Math.sqrt(files.length));

    // อ่านขนาดรูปแรก (สมมติว่าทุกไฟล์ขนาดเท่ากัน)
    const firstImage = await sharp(path.join(inputFolder, files[0])).metadata();
    const imgWidth = firstImage.width;
    const imgHeight = firstImage.height;

    // สร้าง canvas ขนาด gridSize x gridSize
    const canvasWidth = imgWidth * gridSize;
    const canvasHeight = imgHeight * gridSize;

    // เตรียม composite array
    const compositeArr = [];
    for (let i = 0; i < files.length; i++) {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        compositeArr.push({
            input: path.join(inputFolder, files[i]),
            top: row * imgHeight,
            left: col * imgWidth
        });
    }

    // สร้าง canvas โปร่งใสและรวมรูป
    await sharp({
        create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .composite(compositeArr)
    .png()
    .toFile(outputFile);

    console.log('รวมรูปเสร็จสิ้น:', outputFile);
}

// รับ argument จาก command line
const [inputFolder, outputFile] = process.argv.slice(2);
if (!inputFolder || !outputFile) {
    console.log('วิธีใช้: node combine.js <input_folder> <output_file>');
    process.exit(1);
}

combineImages(inputFolder, outputFile)
    .catch(err => {
        console.error('เกิดข้อผิดพลาด:', err.message);
    });
