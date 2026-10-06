# Movie Recs — Android TV

Native Android TV client (Kotlin, Compose for TV) for the Movie Recs website. It only talks to the
website (`/api/auth` to sign in, `/api/v1` for data) — Neon and TMDB keys never leave the server,
and **the app itself contains no secrets**.

- **Sign-in:** first launch shows a QR code and a short code. Scan it, sign in with Google on your phone, tap **Approve** —
  the TV signs itself in. Manage or revoke TVs at `/account` on the website.
- **Tabs:** Home · Genres · Search · Watchlist · Account (sign out, TMDB/JustWatch attribution)
- **Remote:** D-pad everywhere; Back from content jumps to the tabs, Back on a tab returns Home, Back on Home exits.
  Back from a movie returns focus to the poster you opened.
- **Watchlist:** your account's list, shared with the website; toggles are instant and resync if the server rejects them.

## Setup

Requires JDK 17+ and the Android SDK (`platform-tools`, `platforms;android-37.0`, `build-tools`).

```bash
cp local.properties.example local.properties   # gitignored — SDK path, server URLs, signing key
```

| Property | Used by | Default |
| --- | --- | --- |
| `api.baseUrl` | release | `https://movie-recs-tawny.vercel.app` (must be `https://`) |
| `api.debugBaseUrl` | debug | `api.baseUrl`; use `http://10.0.2.2:3000` for `npm run dev` from the emulator |
| `release.*` | release signing | falls back to the local debug key |

Debug builds install as **Movie Recs Dev** (`…movierecs.debug`), so they sit alongside the release app.

## Playing with the UI

- **All look-and-feel values live in [`ui/theme/Theme.kt`](app/src/main/java/com/kieranaston/movierecs/ui/theme/Theme.kt):**
  colours (`Palette`), sizes and spacing (`Dimens`), focus scale and transition speed (`Motion`).
- **Previews:** open [`ui/Previews.kt`](app/src/main/java/com/kieranaston/movierecs/ui/Previews.kt) in Android Studio
  to see the poster, row, genre tiles and details screen update as you edit.
- **On the emulator:** with `npm run dev` running, `./gradlew installDebug` rebuilds and reinstalls in a few seconds.

## Build & checks

```bash
./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk (minified, ~2.3 MB)
./gradlew lintDebug         # warnings are errors — keep it at zero
```

Release builds refuse to build without an `https://` base URL.

## Tests

```bash
./gradlew testDebugUnitTest          # JVM: HTTP clients (MockWebServer), session, sign-in polling, watchlist
./gradlew connectedDebugAndroidTest  # on an emulator/TV: Keystore encryption, Compose UI + D-pad focus
```

CI runs both (plus lint and the release build) on every push.

## Security model

- **No secrets in the APK.** Each TV gets its own session through the RFC 8628 device flow; it is never shared or
  compiled in. Revoke a TV from `/account` and it returns to the sign-in screen on its next request.
- The session token is encrypted with AES-256-GCM under a non-exportable Android Keystore key before it touches disk.
- Signing out on the TV revokes the session on the server too.
- Release builds allow HTTPS only and trust only system CAs (`res/xml/network_security_config.xml`). Plain HTTP to
  the emulator host is allowed in debug builds only.
- No backups, no logging of requests; R8 shrinks and obfuscates release builds.
- Requests to our server identify the app (`MovieRecsTV/<version> (<model>)`) so the device list is readable; image
  requests to TMDB don't carry it.
- Trailer links are built only from well-formed YouTube video ids.

## Emulator

```bash
SDK=~/Library/Android/sdk
$SDK/emulator/emulator -avd GoogleTV &
./gradlew installDebug
```

## Install on your TV

Every change to `android-tv/` on `main` builds, tests and signs a release
(`.github/workflows/android-release.yml`) and publishes it as a GitHub Release. The site serves the newest one at
**https://movie-recs-tawny.vercel.app/tv**.

**First install (once per TV):**
1. On the TV, install **Downloader** (by AFTVnews) from the Google Play Store.
2. **Settings → Apps → Security & restrictions → Unknown sources** (wording varies by TV) → allow **Downloader**.
3. Open Downloader, enter `movie-recs-tawny.vercel.app/tv`, and choose **Install** when it finishes downloading.
4. Open **Movie Recs** and scan the QR code with your phone to sign in.

**Updates:** repeat step 3. Android updates the app in place and you stay signed in.

**From your Mac instead** (TV's developer options → *Network debugging* on):

```bash
scripts/install-tv.sh 192.168.1.50   # downloads the latest release, checks its SHA-256, installs over Wi-Fi
```

### One-time setup for releases

Repository secrets (*Settings → Secrets and variables → Actions*):

| Secret | Value |
| --- | --- |
| `RELEASE_KEYSTORE_BASE64` | `base64 -i ~/.android/movierecs-release.jks` |
| `RELEASE_STORE_PASSWORD` / `RELEASE_KEY_PASSWORD` | From `local.properties` |
| `RELEASE_KEY_ALIAS` | `movierecs` |

Vercel environment variable `GITHUB_RELEASES_TOKEN`: a
[fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to **only this repository** and
**Contents: Read-only**. It never leaves the server; `/tv` redirects to GitHub's short-lived signed download link.
Renew it before it expires.

The workflow refuses to publish an APK signed with any key other than the release key (its certificate SHA-256 is pinned
in the workflow), because a TV only accepts updates signed with the key it was first installed with.

Back up `~/.android/movierecs-release.jks` and its password (in `local.properties`): updates must be signed with the
same key, otherwise you'd have to uninstall before installing.
