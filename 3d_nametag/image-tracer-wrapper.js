// image-tracer-wrapper.js
// Wrapper for image-tracer-js to convert PNG to SVG for extrusion
// ImageTracer is loaded globally from index.html

export async function pngToSVG(file, options = {}) {
    // Load PNG as image
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
    });
    // Draw image to canvas and flip vertically
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    // Flip vertically
    ctx.save();
    ctx.translate(0, img.height);
    ctx.scale(1, -1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    // Use image-tracer-js to convert to SVG string
    const svgString = window.ImageTracer.imagedataToSVG(ctx.getImageData(0, 0, img.width, img.height), options);
    return svgString;
}
