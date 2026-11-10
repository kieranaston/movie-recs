#!/usr/bin/env bash
# Build the TV app locally and install (or update) it on your TV over Wi-Fi.
# Needs: JDK 17+, the Android SDK, adb, and "Network/Wireless debugging" enabled on the TV.
#
#   scripts/install-tv.sh 192.168.1.50          # TV's IP (port 5555 assumed)
#   scripts/install-tv.sh 192.168.1.50:37123    # Wireless-debugging port, after `adb pair`
set -euo pipefail

TARGET="${1:?usage: scripts/install-tv.sh <tv-ip[:port]>}"
[[ "$TARGET" == *:* ]] || TARGET="$TARGET:5555"
ADB="${ADB:-$(command -v adb || echo "$HOME/Library/Android/sdk/platform-tools/adb")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT/android-tv/app/build/outputs/apk/release/app-release.apk"

echo "→ Building the release APK…"
(cd "$ROOT/android-tv" && ./gradlew --console=plain assembleRelease)

echo "→ Connecting to $TARGET (accept the prompt on the TV the first time)…"
"$ADB" connect "$TARGET" >/dev/null
"$ADB" -s "$TARGET" wait-for-device

echo "→ Installing…"
"$ADB" -s "$TARGET" install -r "$APK"
echo "✓ Installed. Open Movie Recs on the TV."
