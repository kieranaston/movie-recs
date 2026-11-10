#!/usr/bin/env bash
# Build the signed TV APK and copy it into public/, so the website serves it at /tv.
# Needs: JDK 17+, the Android SDK, and the release key in local.properties.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$ROOT/android-tv" && ./gradlew --console=plain assembleRelease)

cp "$ROOT/android-tv/app/build/outputs/apk/release/app-release.apk" "$ROOT/public/movie-recs-tv.apk"
echo "✓ public/movie-recs-tv.apk updated ($(du -h "$ROOT/public/movie-recs-tv.apk" | cut -f1))."
echo "  Deploy to publish it: vercel --prod   (then the TV's Downloader can fetch /tv)"
