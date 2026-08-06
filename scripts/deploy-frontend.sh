#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
frontend_dir="$repo_dir/frontend"
dist_dir="$frontend_dir/dist"
public_dir="$repo_dir/backend/public"

npm --prefix "$frontend_dir" install
npm --prefix "$frontend_dir" run build
node "$frontend_dir/scripts/verify-dist-assets.mjs" "$dist_dir"

# Publish fingerprinted chunks first. Existing chunks are deliberately retained:
# open tabs may still request the previous build's lazy chunks.
mkdir -p "$public_dir/assets"
rsync -a "$dist_dir/assets/" "$public_dir/assets/"

# Keep index.html until every dependency referenced by the new build is live.
rsync -a --exclude assets --exclude index.html "$dist_dir/" "$public_dir/"

index_tmp="$public_dir/.index.html.next"
cp "$dist_dir/index.html" "$index_tmp"
node "$frontend_dir/scripts/verify-dist-assets.mjs" "$public_dir" "$index_tmp"
mv "$index_tmp" "$public_dir/index.html"

# The SSR renderer loads index.html into memory; refresh it after the atomic swap.
if command -v pm2 >/dev/null 2>&1 && pm2 describe index >/dev/null 2>&1; then
  pm2 restart index >/dev/null
fi

echo "Frontend deployed: assets first, index.html last."
