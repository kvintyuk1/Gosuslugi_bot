#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/concat_mascot.sh            # uses default order
#   ./scripts/concat_mascot.sh a.webm b.webm c.webm  # uses given order

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG_DIR="$REPO_ROOT/src/img"
OUT="$IMG_DIR/robotmax-all.webm"

# Default file order — edit if your fragments must be in a different sequence
FILES=("maxae.webm" "chyhae.webm" "dymae.webm" "stoit.webm" "zitxnyv.webm")
if [ "$#" -gt 0 ]; then
  FILES=("$@")
fi

for f in "${FILES[@]}"; do
  if [ ! -f "$IMG_DIR/$f" ]; then
    echo "Error: fragment not found: $IMG_DIR/$f" >&2
    exit 1
  fi
done

LIST="$IMG_DIR/ffconcat_list.txt"
rm -f "$LIST"
for f in "${FILES[@]}"; do
  echo "file '$f'" >> "$LIST"
done

# Try stream copy first (fast, no re-encoding)
if ffmpeg -v error -f concat -safe 0 -i "$LIST" -c copy "$OUT"; then
  echo "Created $OUT (stream copy)."
  exit 0
fi

# If stream copy fails (different codecs/params), re-encode to webm (VP9 + Opus)
echo "Stream copy failed — re-encoding to WebM (VP9 + Opus). This may take a while..."
ffmpeg -y -f concat -safe 0 -i "$LIST" -c:v libvpx-vp9 -b:v 0 -crf 30 -c:a libopus "$OUT"

if [ -f "$OUT" ]; then
  echo "Created $OUT (re-encoded)."
else
  echo "Failed to create $OUT" >&2
  exit 1
fi
