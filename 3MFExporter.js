// 3MF Exporter with Multi-Material Support for Bambu Lab
import * as THREE from 'https://esm.sh/three@0.168.0';

export class ThreeMFExporter {
    parse(scene, options = {}) {
        const files = {};
        const materials = [];
        const objects = [];
        let objectId = 2; // Start from 2 because basematerials is id=1

        console.log('🎨 Starting 3MF Export...');

        // Collect all meshes and their materials
        scene.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const geometry = child.geometry.clone();
                geometry.applyMatrix4(child.matrixWorld);
                
                // Get color from material
                const color = child.material.color;
                const colorHex = this.rgbToHex(color.r, color.g, color.b);
                
                console.log(`📦 Found mesh: ${child.name}, Color: ${colorHex}`);
                
                // Check if material already exists
                let materialIndex = materials.findIndex(m => m.color === colorHex);
                if (materialIndex === -1) {
                    materials.push({
                        color: colorHex,
                        name: child.name || `Material ${materials.length + 1}`
                    });
                    materialIndex = materials.length - 1;
                    console.log(`  ✨ New material added: ${colorHex} at index ${materialIndex}`);
                } else {
                    console.log(`  ♻️ Reusing material: ${colorHex} at index ${materialIndex}`);
                }

                // Convert geometry to vertices and triangles
                const vertices = [];
                const triangles = [];
                const position = geometry.attributes.position;

                if (position) {
                    // Get vertices
                    for (let i = 0; i < position.count; i++) {
                        vertices.push({
                            x: position.getX(i),
                            y: position.getY(i),
                            z: position.getZ(i)
                        });
                    }

                    // Get triangles
                    if (geometry.index) {
                        const indices = geometry.index.array;
                        for (let i = 0; i < indices.length; i += 3) {
                            triangles.push({
                                v1: indices[i],
                                v2: indices[i + 1],
                                v3: indices[i + 2]
                            });
                        }
                    } else {
                        for (let i = 0; i < position.count; i += 3) {
                            triangles.push({
                                v1: i,
                                v2: i + 1,
                                v3: i + 2
                            });
                        }
                    }

                    objects.push({
                        id: objectId++,
                        name: child.name || `Object ${objectId}`,
                        vertices: vertices,
                        triangles: triangles,
                        materialIndex: materialIndex // Store the material index (0-based)
                    });
                    
                    console.log(`  📊 Object created: ID=${objectId-1}, Vertices=${vertices.length}, Triangles=${triangles.length}, MaterialIndex=${materialIndex}`);
                }
            }
        });

        console.log(`\n📋 Summary: ${objects.length} objects, ${materials.length} materials`);
        materials.forEach((mat, idx) => {
            console.log(`  Material ${idx}: ${mat.color} (${mat.name})`);
        });

        // Generate 3MF model XML
        const modelXML = this.generateModelXML(objects, materials);
        files['3D/3dmodel.model'] = modelXML;

        // Generate .rels files
        files['_rels/.rels'] = this.generateRootRels();
        files['3D/_rels/3dmodel.model.rels'] = this.generateModelRels();

        // Generate [Content_Types].xml
        files['[Content_Types].xml'] = this.generateContentTypes();

        // Create ZIP file
        return this.createZip(files);
    }

    rgbToHex(r, g, b) {
        const toHex = (n) => {
            const hex = Math.round(n * 255).toString(16).toUpperCase();
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    generateModelXML(objects, materials) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n';
        
        // Resources section with materials
        xml += '  <resources>\n';
        
        // Add base materials (colors)
        if (materials.length > 0) {
            xml += '    <basematerials id="1">\n';
            materials.forEach((mat, index) => {
                const color = mat.color.replace('#', '');
                xml += `      <base name="${this.escapeXML(mat.name)}" displaycolor="${color}" />\n`;
                console.log(`  🎨 Material ${index}: ${mat.name} = ${color}`);
            });
            xml += '    </basematerials>\n';
        }
        
        // Add objects - each object will have its own material assigned
        objects.forEach((obj) => {
            // pindex is the 0-based index into the basematerials list
            xml += `    <object id="${obj.id}" name="${this.escapeXML(obj.name)}" type="model" pid="1" pindex="${obj.materialIndex}">\n`;
            xml += '      <mesh>\n';
            xml += '        <vertices>\n';
            
            obj.vertices.forEach((v) => {
                xml += `          <vertex x="${v.x.toFixed(3)}" y="${v.y.toFixed(3)}" z="${v.z.toFixed(3)}" />\n`;
            });
            
            xml += '        </vertices>\n';
            xml += '        <triangles>\n';
            
            obj.triangles.forEach((t) => {
                xml += `          <triangle v1="${t.v1}" v2="${t.v2}" v3="${t.v3}" />\n`;
            });
            
            xml += '        </triangles>\n';
            xml += '      </mesh>\n';
            xml += '    </object>\n';
            console.log(`  📦 Object ${obj.id}: "${obj.name}" using material index ${obj.materialIndex}`);
        });
        
        xml += '  </resources>\n';
        
        // Build section - add all objects to the build plate
        xml += '  <build>\n';
        objects.forEach((obj) => {
            xml += `    <item objectid="${obj.id}" />\n`;
        });
        xml += '  </build>\n';
        
        xml += '</model>';
        
        console.log('\n✅ 3MF XML generated successfully!');
        return xml;
    }

    generateRootRels() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;
    }

    generateModelRels() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
    }

    generateContentTypes() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;
    }

    escapeXML(str) {
        return str.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    async createZip(files) {
        // Use JSZip library
        const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
        const zip = new JSZip();

        // Add all files to zip
        for (const [path, content] of Object.entries(files)) {
            zip.file(path, content);
        }

        // Generate blob
        const blob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });
        
        return blob;
    }
}