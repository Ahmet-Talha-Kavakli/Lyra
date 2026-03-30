#!/usr/bin/env node

/**
 * GLB Model Optimization Script
 *
 * Compresses all .glb files in public/ using Draco compression
 * Runs during build process to reduce model sizes by 80-90%
 *
 * Installation:
 *   npm install gltf-transform @gltf-transform/core @gltf-transform/extensions
 *
 * Usage:
 *   node scripts/optimize-glb-models.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const outputDir = path.join(__dirname, '../public/models-compressed');

async function optimizeModels() {
  try {
    console.log('🎬 GLB Model Optimization Starting...');

    // Check if we can use gltf-transform (optional)
    let hasGLTFTransform = false;
    try {
      await import('gltf-transform');
      hasGLTFTransform = true;
    } catch (e) {
      console.warn(
        '⚠️  gltf-transform not installed. For optimal compression, run:\n' +
        '   npm install --save-dev gltf-transform @gltf-transform/core @gltf-transform/extensions\n'
      );
    }

    // Find all .glb files
    const glbFiles = fs
      .readdirSync(publicDir)
      .filter(f => f.endsWith('.glb'));

    if (glbFiles.length === 0) {
      console.log('✅ No GLB files found to optimize');
      return;
    }

    console.log(`\n📦 Found ${glbFiles.length} GLB files:`);
    glbFiles.forEach(f => {
      const stats = fs.statSync(path.join(publicDir, f));
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   - ${f} (${sizeMB} MB)`);
    });

    if (!hasGLTFTransform) {
      console.log(
        '\n⏭️  Skipping compression (gltf-transform not installed)\n' +
        'To enable Draco compression, install dependencies:\n' +
        '   npm install --save-dev gltf-transform @gltf-transform/core @gltf-transform/extensions\n'
      );
      return;
    }

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Optimize each model
    const {
      Document,
      NodeIO,
      Verbosity,
    } = await import('gltf-transform');
    const { draco } = await import('@gltf-transform/extensions');

    const io = new NodeIO()
      .setLogger(Verbosity.WARN);

    for (const file of glbFiles) {
      const inputPath = path.join(publicDir, file);
      const outputPath = path.join(outputDir, file);

      try {
        console.log(`\n🔄 Optimizing ${file}...`);

        // Read document
        const document = await io.read(inputPath);

        // Apply Draco compression
        document
          .getRoot()
          .listMeshes()
          .forEach(mesh => {
            mesh.listPrimitives().forEach(prim => {
              draco().encodePrimitive(prim);
            });
          });

        // Write compressed file
        await io.write(outputPath, document);

        // Compare sizes
        const originalStats = fs.statSync(inputPath);
        const compressedStats = fs.statSync(outputPath);
        const originalMB = (originalStats.size / 1024 / 1024).toFixed(2);
        const compressedMB = (compressedStats.size / 1024 / 1024).toFixed(2);
        const reduction = (
          ((originalStats.size - compressedStats.size) / originalStats.size) * 100
        ).toFixed(1);

        console.log(
          `   ✅ ${originalMB} MB → ${compressedMB} MB (${reduction}% reduction)`
        );
      } catch (error) {
        console.error(`   ❌ Error optimizing ${file}:`, error.message);
      }
    }

    console.log(
      '\n✨ Optimization complete!\n' +
      'Compressed models saved to: public/models-compressed/\n' +
      'Update your code to use: /models-compressed/filename.glb\n'
    );

  } catch (error) {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  }
}

optimizeModels();
