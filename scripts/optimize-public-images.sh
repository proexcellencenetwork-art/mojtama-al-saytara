#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/public/og-social.png"
OUTPUT="$ROOT/public/images"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to generate responsive image variants." >&2
  exit 1
fi
if [[ ! -f "$SOURCE" ]]; then
  echo "Original brand artwork not found: $SOURCE" >&2
  exit 1
fi
mkdir -p "$OUTPUT"

for width in 480 1200; do
  height=$((width * 630 / 1200))
  ffmpeg -hide_banner -loglevel error -y -i "$SOURCE" -vf "scale=${width}:${height}:flags=lanczos" -frames:v 1 -c:v libwebp -quality 82 -compression_level 6 "$OUTPUT/brand-community-${width}.webp"
  ffmpeg -hide_banner -loglevel error -y -i "$SOURCE" -vf "scale=${width}:${height}:flags=lanczos" -frames:v 1 -c:v libaom-av1 -still-picture 1 -crf 34 -b:v 0 -cpu-used 6 -row-mt 1 -f avif "$OUTPUT/brand-community-${width}.avif"
done

printf 'Responsive image variants created from %s\n' "$SOURCE"
ls -lh "$OUTPUT"/brand-community-*
