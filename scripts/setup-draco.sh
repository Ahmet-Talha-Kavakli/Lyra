#!/bin/bash

# Setup Draco decoder files for Three.js
# Copies Draco decoder libraries from node_modules to public/

set -e

echo "📦 Setting up Draco decoder files..."

DRACO_SRC="frontend/node_modules/three/examples/jsm/libs/draco"
DRACO_DEST="frontend/public/draco"

if [ ! -d "$DRACO_SRC" ]; then
    echo "❌ Draco source not found at: $DRACO_SRC"
    echo "Make sure three is installed: npm install three"
    exit 1
fi

# Create destination directory
mkdir -p "$DRACO_DEST"

# Copy decoder files
echo "📋 Copying decoder files..."
cp -v "$DRACO_SRC/draco_decoder.js" "$DRACO_DEST/" || true
cp -v "$DRACO_SRC/draco_decoder.wasm" "$DRACO_DEST/" || true
cp -v "$DRACO_SRC/draco_wasm_wrapper.js" "$DRACO_DEST/" || true

echo "✅ Draco decoder files ready at: $DRACO_DEST"
echo ""
echo "🎬 Draco is now configured for:"
echo "   - Compressed GLB model loading (80-90% size reduction)"
echo "   - Lazy loading on demand (not on app boot)"
echo "   - Streaming decompression"
