#!/bin/bash
# TEMPO Slider - ストア提出用 ZIP パッケージ作成

set -e

cd "$(dirname "$0")/.."

VERSION=$(grep '"version"' src/manifest.json | head -1 | sed 's/[^0-9.]//g')
OUT_DIR="dist"
OUT_FILE="$OUT_DIR/tempo-slider-${VERSION}.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

# src/ 内の必要ファイルのみを ZIP に。_metadata 等は除外
cd src
zip -r "../$OUT_FILE" . \
  -x "_metadata/*" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "icons/icon-small.svg" \
  -x "icons/icon.svg"
cd ..

echo ""
echo "✅ Created: $OUT_FILE"
echo "   Size: $(du -h "$OUT_FILE" | cut -f1)"
