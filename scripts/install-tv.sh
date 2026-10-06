#!/usr/bin/env bash
# Install (or update) the latest released TV app from your Mac over Wi-Fi.
# Needs: gh (logged in), adb, and "Network/Wireless debugging" enabled on the TV.
#
#   scripts/install-tv.sh 192.168.1.50          # TV's IP (port 5555 assumed)
#   scripts/install-tv.sh 192.168.1.50:37123    # Wireless-debugging port, after `adb pair`
set -euo pipefail

TARGET="${1:?usage: scripts/install-tv.sh <tv-ip[:port]>}"
[[ "$TARGET" == *:* ]] || TARGET="$TARGET:5555"
ADB="${ADB:-$(command -v adb || echo "$HOME/Library/Android/sdk/platform-tools/adb")}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "→ Downloading the latest release…"
gh release download --pattern 'movie-recs-tv.apk*' --dir "$WORK"
(cd "$WORK" && shasum -a 256 -c movie-recs-tv.apk.sha256)

echo "→ Connecting to $TARGET (accept the prompt on the TV the first time)…"
"$ADB" connect "$TARGET" >/dev/null
"$ADB" -s "$TARGET" wait-for-device

echo "→ Installing…"
"$ADB" -s "$TARGET" install -r "$WORK/movie-recs-tv.apk"
echo "✓ Installed. Open Movie Recs on the TV."
