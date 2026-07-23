#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="${1:-/Users/kinopoint/Downloads/horizon foto}"
EDITED_DIR="$SOURCE_ROOT/horiz foto video phone edit"
OUTPUT_ROOT="assets/media"
FULL_DIR="$OUTPUT_ROOT/full"
WEB_DIR="$OUTPUT_ROOT/web"
VIDEO_DIR="$OUTPUT_ROOT/video"
POSTER_DIR="$OUTPUT_ROOT/posters"
WORK_DIR="$(mktemp -d /tmp/horizon-media.XXXXXX)"
SOURCE_LIST="$WORK_DIR/sources.txt"
USED_STEMS="$WORK_DIR/stems.txt"
MANIFEST="$WORK_DIR/manifest.ndjson"

trap 'rm -rf "$WORK_DIR"' EXIT
mkdir -p "$FULL_DIR" "$WEB_DIR" "$VIDEO_DIR" "$POSTER_DIR" assets/data
: > "$SOURCE_LIST"
: > "$USED_STEMS"
: > "$MANIFEST"

slugify() {
  local stem="$1"
  local slug
  slug="$(printf '%s' "$stem" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  if [[ -z "$slug" ]]; then slug="untitled-frame"; fi
  printf '%s' "$slug"
}

add_still() {
  local file="$1"
  local stem slug
  stem="$(basename "${file%.*}")"
  slug="$(slugify "$stem")"
  if grep -Fqx "$slug" "$USED_STEMS"; then return; fi
  printf '%s\n' "$slug" >> "$USED_STEMS"
  printf '%s|%s\n' "$slug" "$file" >> "$SOURCE_LIST"
}

while IFS= read -r -d '' file; do add_still "$file"; done < <(
  find "$EDITED_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.heic' \) -print0 | sort -z
)
while IFS= read -r -d '' file; do add_still "$file"; done < <(
  find "$SOURCE_ROOT" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) -print0 | sort -z
)
while IFS= read -r -d '' file; do add_still "$file"; done < <(
  find "$SOURCE_ROOT" -maxdepth 1 -type f -iname '*.cr3' -print0 | sort -z
)

while IFS='|' read -r slug source; do
  full="$FULL_DIR/$slug.jpg"
  web="$WEB_DIR/$slug.webp"
  preview="$WORK_DIR/$slug-preview.jpg"
  if [[ ! -s "$full" || ! -s "$web" ]]; then
    sips -s format jpeg -s formatOptions 84 -Z 2400 "$source" --out "$full" >/dev/null
    sips -Z 1600 "$full" --out "$preview" >/dev/null
    cwebp -quiet -mt -q 78 -metadata none "$preview" -o "$web"
  fi
  jpegtran -copy none -optimize -outfile "$WORK_DIR/$slug-clean.jpg" "$full"
  mv "$WORK_DIR/$slug-clean.jpg" "$full"
  width="$(sips -g pixelWidth "$full" 2>/dev/null | awk '/pixelWidth/{print $2}')"
  height="$(sips -g pixelHeight "$full" 2>/dev/null | awk '/pixelHeight/{print $2}')"
  printf '{"id":"%s","type":"photo","src":"assets/media/web/%s.webp","download":"assets/media/full/%s.jpg","width":%s,"height":%s}\n' "$slug" "$slug" "$slug" "$width" "$height" >> "$MANIFEST"
done < "$SOURCE_LIST"

video_index=0
while IFS= read -r -d '' source; do
  video_index=$((video_index + 1))
  stem="$(basename "${source%.*}")"
  slug="$(slugify "$stem")"
  target="$VIDEO_DIR/$slug.mp4"
  poster="$POSTER_DIR/$slug.webp"
  ffmpeg -nostdin -y -v error -i "$source" -map 0:v:0 -map '0:a:0?' \
    -vf "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))':force_original_aspect_ratio=decrease" \
    -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -profile:v high -level 4.1 \
    -c:a aac -b:a 128k -movflags +faststart "$target"
  ffmpeg -nostdin -y -v error -ss 00:00:02 -i "$target" -frames:v 1 -vf "scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))':force_original_aspect_ratio=decrease" "$WORK_DIR/$slug-poster.jpg"
  cwebp -quiet -mt -q 80 -metadata none "$WORK_DIR/$slug-poster.jpg" -o "$poster"
  duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$target" | awk '{printf "%.1f", $1}')"
  dims="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$target")"
  width="${dims%x*}"
  height="${dims#*x}"
  printf '{"id":"%s","type":"video","src":"assets/media/video/%s.mp4","poster":"assets/media/posters/%s.webp","download":"assets/media/video/%s.mp4","width":%s,"height":%s,"duration":%s}\n' "$slug" "$slug" "$slug" "$slug" "$width" "$height" "$duration" >> "$MANIFEST"
done < <(find "$EDITED_DIR" -maxdepth 1 -type f \( -iname '*.mov' -o -iname '*.mp4' -o -iname '*.m4v' \) -print0 | sort -z)

node scripts/write-gallery-data.mjs "$MANIFEST"
du -sh "$OUTPUT_ROOT"
