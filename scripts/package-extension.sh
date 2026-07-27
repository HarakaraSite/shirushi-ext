#!/usr/bin/env bash
set -euo pipefail

target="${1:-public}"
project_root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$project_root/shirushi-webext"
version="$(node -p "require(process.argv[1]).version" "$source_dir/manifest.json")"
output_dir="$project_root/dist"
stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/shirushi-webext-package.XXXXXX")/extension"

case "$target" in
  public)
    manifest_source="$source_dir/manifest.json"
    protocol_source="$source_dir/server-protocols.js"
    output_file="$output_dir/shirushi-$version.xpi"
    ;;
  dev)
    manifest_source="$source_dir/manifest.dev.json"
    protocol_source="$source_dir/server-protocols.dev.js"
    output_file="$output_dir/shirushi-dev-$version.xpi"
    ;;
  *)
    printf 'Usage: %s [public|dev]\n' "$0" >&2
    exit 2
    ;;
esac

mkdir -p "$stage_dir" "$output_dir"
cp "$manifest_source" "$stage_dir/manifest.json"
cp "$source_dir/background.js" "$source_dir/i18n.js" "$source_dir/popup.html" \
  "$source_dir/popup.js" "$source_dir/options.html" "$source_dir/options.js" \
  "$source_dir/search.html" "$source_dir/search.js" "$stage_dir/"
cp "$protocol_source" "$stage_dir/server-protocols.js"
cp -R "$source_dir/_locales" "$source_dir/icons" "$stage_dir/"

(cd "$stage_dir" && zip -FS -X -q -r "$output_file" .)
unzip -t "$output_file" >/dev/null
printf 'Created %s\n' "$output_file"
