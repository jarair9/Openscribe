#!/usr/bin/env bash
# Convert the OFL handwriting families that fill the style gaps the bundled set
# does not cover (marker, sketch print, neat print, bold script). Each face is
# generated into a throwaway directory and lands as fonts/bundles/<id>.json;
# add the new file to fonts/index.ts to make it selectable.
#
# Needs Bun and the vendored generator in tools/tegaki.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/tools/tegaki/packages/generator"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

gen() {
  local family="$1" id="$2"
  if [ -f "$ROOT/fonts/bundles/$id.json" ]; then echo "== $id already converted"; return; fi
  echo "== $id start $(date +%T)"
  (cd "$GEN" && bun --conditions=tegaki@dev src/cli/index.ts generate \
    "$family" -o "$OUT/$id" 2>&1 | tail -3)
  (cd "$ROOT" && node scripts/prepare-stroke-font.mjs \
    --input "$OUT/$id" --id "$id" --family "$family" 2>&1 | tail -1)
  echo "== $id done $(date +%T)"
}

gen "Patrick Hand"          patrick-hand
gen "Architects Daughter"   architects-daughter
gen "Permanent Marker"      permanent-marker
gen "Indie Flower"          indie-flower
gen "Gochi Hand"            gochi-hand
gen "Kalam"                 kalam
gen "Shadows Into Light"    shadows-into-light
gen "Nothing You Could Do"  nothing-you-could-do
gen "Neucha"                neucha
gen "Pacifico"              pacifico
echo "ESSENTIALS DONE"
