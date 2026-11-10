# Movie Recs — Android TV

Native Android TV client (Kotlin, Compose for TV) for the Movie Recs website. It only talks to the
website (`/api/v1`) — Neon and TMDB keys never leave the server, and **the app itself contains no secrets**.

- **Tabs:** Home · Genres · Search · Watchlist · About (attribution)
- **Remote:** D-pad everywhere; Back from content jumps to the tabs, Back on a tab returns Home, Back on Home exits.
  Back from a movie returns focus to the poster you opened.
- **Watchlist:** the shared watchlist; toggles are instant and resync if the server rejects them.

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
- **Previews:** open [`ui/Previews.kt`](app/src/main/java/com/kieranaston/movierecs/ui/Previews.kt) in Android Studio.
- **On the emulator:** with `npm run dev` running, `./gradlew installDebug` rebuilds and reinstalls in a few seconds.

## Build & checks

```bash
./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk (minified)
./gradlew lintDebug         # warnings are errors — keep it at zero
```

Release builds refuse to build without an `https://` base URL.

## Tests

```bash
./gradlew testDebugUnitTest          # JVM: HTTP client (MockWebServer), watchlist repository
./gradlew connectedDebugAndroidTest  # on an emulator/TV: Compose UI + D-pad focus
```

CI runs both (plus lint and the release build) on every push.

## Security model

- **No secrets in the APK.** The app is single-profile and anonymous; it only reads the site's public `/api/v1`.
- Release builds allow HTTPS only and trust only system CAs (`res/xml/network_security_config.xml`). Plain HTTP to
  the emulator host is allowed in debug builds only.
- No backups, no logging of requests; R8 shrinks and obfuscates release builds.
- Requests identify the app (`MovieRecsTV/<version> (<model>)`); image requests to TMDB don't carry it.
- Trailer links are built only from well-formed YouTube video ids.

## Emulator

```bash
SDK=~/Library/Android/sdk
$SDK/emulator/emulator -avd GoogleTV &
./gradlew installDebug
```

## Install on your TV

The website serves the latest APK at **`mrecs.vercel.app/tv`**.

**First install (once per TV):**
1. Install **Downloader** (by AFTVnews) from the Play Store.
2. Settings → Apps → Security & restrictions → Unknown sources → allow **Downloader**.
3. Open Downloader, enter `mrecs.vercel.app/tv`, and choose **Install**.
4. Open **Movie Recs**.

**Updates:** repeat step 3 — it installs in place.

**Publishing a new build:** `scripts/release-tv.sh` builds the APK into `public/`, then `vercel --prod` publishes it.

**From your Mac instead** (TV's developer options → *Network/Wireless debugging* on):

```bash
scripts/install-tv.sh 192.168.1.50   # builds the release APK and installs it over Wi-Fi
```

### Signing

Release builds sign with the key in `local.properties` (`release.*`). Back up `~/.android/movierecs-release.jks`
and its password: a TV only accepts updates signed with the key it was first installed with (a new key means
uninstalling the old app once).
