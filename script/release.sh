#!/usr/bin/env bash
# Builds the two release assets into dist/:
#   install.sh               the installer, stamped with this release's URLs
#   amalicode-bundle.tar.gz  plugin, launcher and the same stamped installer
#
#   script/release.sh <version> <download-base> <latest-base>
#
# download-base is where this release's assets live, e.g.
#   https://github.com/<org>/<repo>/releases/download/v0.1.0
# latest-base is where `amalicode upgrade` looks, e.g.
#   https://github.com/<org>/<repo>/releases/latest/download
set -euo pipefail

version="${1:?version required}"
download_base="${2:?download base URL required}"
latest_base="${3:?latest base URL required}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist="$root/dist"

rm -rf "$dist"
mkdir -p "$dist/bundle/plugin" "$dist/bundle/launcher"

sed \
  -e "s|__AMALICODE_VERSION__|$version|" \
  -e "s|__BUNDLE_URL__|$download_base/amalicode-bundle.tar.gz|" \
  -e "s|__LATEST_INSTALLER_URL__|$latest_base/install.sh|" \
  "$root/install.sh" >"$dist/install.sh"
if grep -q "__[A-Z_]*__" "$dist/install.sh"; then
  echo "install.sh still has unstamped placeholders" >&2
  exit 1
fi
chmod 755 "$dist/install.sh"

cp "$dist/install.sh" "$dist/bundle/install.sh"
cp "$root/launcher/amalicode" "$dist/bundle/launcher/"
cp -R "$root/plugin/src" "$root/plugin/themes" "$root/plugin/package.json" "$dist/bundle/plugin/"
cp "$root/README.md" "$root/NOTICE" "$dist/bundle/"

tar -czf "$dist/amalicode-bundle.tar.gz" -C "$dist/bundle" .
rm -rf "$dist/bundle"
(cd "$dist" && sha256sum install.sh amalicode-bundle.tar.gz >SHA256SUMS)
ls -l "$dist"
