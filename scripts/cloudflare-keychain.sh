#!/bin/bash
set -euo pipefail
set +x
umask 077
script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
cache_dir="$script_dir/../.cache/cloudflare-keychain"
mkdir -p "$cache_dir"
if [[ ! -x "$cache_dir/helper" || "$script_dir/cloudflare-keychain.swift" -nt "$cache_dir/helper" ]]; then
  /usr/bin/xcrun swiftc -swift-version 5 -module-cache-path "$cache_dir/modules" "$script_dir/cloudflare-keychain.swift" -o "$cache_dir/helper"
fi
cd "$script_dir/.."
exec "$cache_dir/helper" "$@"
