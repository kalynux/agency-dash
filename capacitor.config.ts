/**
 * Capacitor shell configuration (CAPACITOR-PLAN.md → P2.2).
 *
 * This file is read by the `cap` CLI at sync time, not by the app bundle — it is
 * the one place outside `src/platform/` that knows about the native shell.
 */
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * On-device development against a LAN backend (`npm run sync:android:lan`).
 *
 * The WebView origin is `https://agency.wi-mall.internal`, so a call to a plain
 * `http://192.168.x.x:8022` dev API is mixed content and the WebView drops it
 * before it reaches the network — which looks exactly like the backend being
 * down. This flag is the only thing that relaxes it, it is off by default, and
 * `npm run build:mobile` never sets it. Cleartext also needs the Android side's
 * permission: android/app/src/debug/AndroidManifest.xml, which is debug-only and
 * therefore cannot reach a release build.
 */
const lanDev = process.env.CAP_LAN_DEV === '1';

const config: CapacitorConfig = {
  // No hyphen here on purpose: an Android package segment must be a valid Java
  // identifier, so `com.wi-mall.agency` is rejected by the toolchain. The
  // hyphenated brand lives in appName and the hostname, which both allow it.
  appId: 'com.wi_mall.agency',
  appName: 'Wi-Agency',

  // Vite's build output. `base: './'` in vite.config.ts is what makes this work:
  // the WebView loads index.html from the filesystem, so absolute asset paths
  // would resolve against the server root and 404.
  webDir: 'dist',

  server: {
    // `https` for every real build; `http` ONLY for a LAN-dev sync, and only
    // because of mixed content.
    //
    // `allowMixedContent` below buys the *blockable* class — `fetch`, XHR — so
    // the whole API works from an https page against the plain-http dev
    // backend. It does not buy images. Chromium auto-upgrades a mixed <img> to
    // https and blocks it when that fails, which the dev backend guarantees
    // since it has no TLS. Read off the device (P5b.4):
    //
    //   Mixed Content: … requested an insecure image
    //   'http://100.124.149.1:8022/api/files/…jpg'. This request has been
    //   BLOCKED; the content must be served over HTTPS.
    //
    // …while every `/api/…` call beside it logs the milder "should also be
    // served over HTTPS" and succeeds. That asymmetry is the whole reason every
    // avatar, logo and thumbnail was blank on device while the app otherwise
    // worked, and no header on the backend can reach it: the request is killed
    // in the renderer before it is sent.
    //
    // Matching the page's scheme to the API's removes the mismatch at the root
    // rather than trying to get an exception for it. The cost is that the page
    // is no longer a secure context — which costs nothing here, because every
    // web API that would care (clipboard, geolocation, push) already goes
    // through `src/platform/` to a native plugin on device, and web push is
    // switched off on native by P2.6.
    //
    // ⚠ Release builds are untouched: `lanDev` is false unless CAP_LAN_DEV=1,
    // production's API is https, and there is no mixed content to answer for.
    androidScheme: lanDev ? 'http' : 'https',

    // D1 — a custom hostname rather than `localhost`.
    //
    // The WebView INTERCEPTS every request to this host and serves the bundled
    // files instead of hitting the network, so it must be a name the app never
    // needs to reach for real. `.internal` is reserved for private use and can
    // never route publicly — that is precisely why it was chosen. Pointing this
    // at a live domain would make that domain unreachable from inside the app.
    //
    // Resulting origins, all of which must be in the backend's ALLOWED_ORIGINS
    // before anything native can talk to the API (the D2 ticket):
    //   Android         → https://agency.wi-mall.internal
    //   Android LAN dev → http://agency.wi-mall.internal   (the scheme above)
    //   iOS             → capacitor://agency.wi-mall.internal
    hostname: 'agency.wi-mall.internal',
  },

  android: {
    // False for every build that is not an explicit LAN-dev sync. In production
    // the API is https, so a standing mixed-content allowance would only ever
    // hide a misconfigured base URL — and quietly permit an on-path downgrade.
    allowMixedContent: lanDev,
  },

  plugins: {
    SplashScreen: {
      // Dismissed explicitly from src/platform/shell/splash.ts once React has
      // painted, so the user never sees the gap between the splash going away
      // and the first frame arriving.
      //
      // Auto-hide stays ON as a backstop, not as the mechanism. If the bundle
      // throws before main.tsx runs, the explicit hide never happens — and with
      // auto-hide off that is an app permanently stuck behind its own logo, the
      // one failure mode with no way out for the user. Two seconds is longer
      // than the explicit path ever takes, so in practice it never fires.
      launchAutoHide: true,
      launchShowDuration: 2000,

      // The app's own light background (`--background: 214 42% 99%`) and dark
      // one (`222 47% 6%`), so the splash and the first frame are the same
      // colour. NB the plan named index.html's `theme-color` (#0e9f6e) here —
      // that green predates the Dispatch Cobalt identity and is stale; a green
      // splash would hand off to a blue app.
      backgroundColor: '#fcfdfe',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
