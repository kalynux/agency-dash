# Release signing and App Links — Wi-Agency (`com.wi_mall.agency`)

Everything about producing a publishable Android artifact. Set up 2026-09-09.

---

## 1 · The upload key

```
C:/Users/Fante/keystores/wi-agency/wi-agency-release.jks
alias: wi-agency   ·   RSA 4096   ·   PKCS12   ·   valid 10,000 days (to ~2053)
SHA-256: 68:78:95:25:16:3B:FD:BB:C8:38:14:FD:F1:F2:61:B6:0C:92:2E:46:85:34:B6:DB:E7:86:ED:D6:BB:17:7B:F5
```

Deliberately **outside the repository**. `android/.gitignore` also refuses
`keystore.properties`, `*.jks` and `*.keystore`, so a copy dropped into the tree by
accident cannot be committed either.

### 🔴 Back it up before the first Play upload

This file and its password are the only things that can publish an update to this
package. Copy both to somewhere durable that is not this laptop — a password
manager entry with the `.jks` as an attachment is the usual answer.

The blast radius is smaller than it used to be: with **Play App Signing** (mandatory
for new apps) Google holds the real app-signing key, so a lost *upload* key can be
reset through Play Console support rather than ending the app. Losing it is still an
outage measured in days.

Credentials live in `android/keystore.properties`, which is git-ignored:

```properties
storeFile=C:/Users/Fante/keystores/wi-agency/wi-agency-release.jks
storePassword=…
keyAlias=wi-agency
keyPassword=…
```

**On CI, do not check that file out.** `app/build.gradle` prefers Gradle properties
when they exist, so set these instead:

```
ORG_GRADLE_PROJECT_WIAGENCY_STORE_FILE
ORG_GRADLE_PROJECT_WIAGENCY_STORE_PASSWORD
ORG_GRADLE_PROJECT_WIAGENCY_KEY_ALIAS
ORG_GRADLE_PROJECT_WIAGENCY_KEY_PASSWORD
```

With neither source present the release build still runs and is simply **unsigned** —
so a checkout with no secrets stays usable for anyone who is not publishing.

---

## 2 · Building

```bash
npm run build            # the web bundle
npx cap sync android     # copy it into android/app/src/main/assets/public
cd android

./gradlew assembleRelease   # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease     # → app/build/outputs/bundle/release/app-release.aab
```

**Play takes the `.aab`.** The `.apk` is for sideloading and internal testing.

`minifyEnabled` and `shrinkResources` are on. Keep every
`app/build/outputs/mapping/release/mapping.txt` that you upload a build with, or the
crash reports for that version are unreadable — Play Console accepts it under the
release's *ReTrace / deobfuscation file*.

### If AAPT2 dies

```
convertShrunkResourcesToBinaryRelease → AAPT2 Daemon startup failed
Please check if you installed the Windows Universal C Runtime.
```

Seen once here, under memory pressure with three builds running at once. The message
is AAPT2's generic "my daemon died" and usually is **not** about the C runtime.
Re-run with `--no-parallel --max-workers=1` on a quiet machine; it succeeded on the
first retry. If it repeats on an idle machine, then install the Microsoft Visual C++
2015–2022 redistributable and try again.

### Verifying what you built

```bash
"$ANDROID_HOME"/build-tools/36.0.0/apksigner verify --print-certs --verbose \
  app/build/outputs/apk/release/app-release.apk
```

Expect `v2 scheme: true` and the SHA-256 above. **`v1 scheme: false` is correct** —
JAR signing is only consulted below API 24 and `minSdkVersion` is 24.

---

## 3 · Versioning

`versionCode` and `versionName` are literals in `app/build.gradle`; nothing derives
them from `package.json`. Currently `1` / `"1.0.0"`.

`versionCode` must **increase on every upload** and can never be reused or lowered —
Play rejects a duplicate, and there is no way to free a number once it is spent.
Bump it before every upload, including a re-upload of a rejected build.

---

## 4 · App Links (`public/.well-known/assetlinks.json`)

The `autoVerify="true"` intent filter in `app/src/main/AndroidManifest.xml` claims
`https://agency.wi-mall.com/*`. It does nothing until the asset-links file is live
and names a fingerprint matching the installed build.

### Where it must be served

```
https://agency.wi-mall.com/.well-known/assetlinks.json
```

- **https** with a chain that validates.
- **No redirect**, not even `www.` → apex or a trailing slash. Android fetches that
  exact URL and gives up on a 3xx.
- `Content-Type: application/json`, publicly readable — no auth, no geo-block, no
  Cloudflare challenge. The verifier is not a browser and will not solve one.

Vite copies `public/` into `dist/` verbatim, so deploying the site publishes it.

```bash
curl -sSI https://agency.wi-mall.com/.well-known/assetlinks.json   # 200, no 3xx
```

### The fingerprints in it

`sha256_cert_fingerprints` is an array; every build that must claim the links needs
its own entry. Extra entries are harmless, a missing one silently means "this build
does not own that domain".

| Entry | Covers |
|---|---|
| `CE:E3:…:D5:74` | the **debug** keystore (`~/.android/debug.keystore`) — local `npm run build:apk` installs |
| `68:78:…:7B:F5` | the **upload key** above — sideloaded release APKs and internal distribution |

### ⚠ A third entry is needed once the app is on Play

Play App Signing re-signs the app with Google's key, so a Store install is **not**
signed by the upload key and will not verify until Google's fingerprint is added.

Get it after the first upload — **Play Console → Test and release → Setup →
App signing → App signing key certificate → SHA-256** — add it to the array,
redeploy the site, then confirm on a device:

```bash
adb shell pm verify-app-links --re-verify com.wi_mall.agency
adb shell pm get-app-links com.wi_mall.agency      # expect: verified
```

Until then nothing breaks; Android declines to verify and links open the browser.
The custom scheme needs no server-side proof and works throughout:

```bash
adb shell am start -a android.intent.action.VIEW -d "wiagency://shipments/665f0c…"
```
