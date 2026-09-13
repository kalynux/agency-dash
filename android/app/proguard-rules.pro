# R8 rules for com.wi_mall.agency.
#
# Enabled with `minifyEnabled true` in build.gradle (2026-09-09). Read this
# before adding anything: most of what a Capacitor app needs is ALREADY applied
# and repeating it here only makes the file look like it is doing more than it is.
#
# Applied automatically, from the libraries' own consumer rules:
#   · @capacitor/android — keeps every `@CapacitorPlugin` class, its
#     `@PluginMethod` / `@PermissionCallback` / `@ActivityCallback` members, and
#     anything extending `com.getcapacitor.Plugin`. That covers all thirteen
#     linked plugins, including the two @aparajita ones.
#   · firebase-messaging — keeps its Service and the reflective entry points FCM
#     uses to deliver a background message.
#   · AndroidX — keeps what the framework instantiates by name.
#
# The web bundle is not affected by any of this. Everything under
# assets/public is data to the Android build; the JavaScript is minified by
# Vite/Rollup at `npm run build`, not by R8.

# ─── Crash reports that name a line ──────────────────────────────────────────
# Without these a release stack trace is a list of one-letter class names and no
# line numbers, which makes the first production crash report unactionable.
# `-renamesourcefileattribute` keeps the obfuscation of the file NAME while
# leaving the mapping usable — the standard pairing.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── The WebView bridge ──────────────────────────────────────────────────────
# Capacitor's bridge is annotated and therefore already kept, but any class
# exposed to JavaScript through @JavascriptInterface is reached by NAME from the
# web layer, where R8 cannot see the call. This is the generic form of that rule
# and costs nothing if no such class exists.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Silence, with a reason ──────────────────────────────────────────────────
# The OkHttp/Conscrypt platform classes are optional at runtime and referenced
# defensively; they are absent on Android and R8 warns about every one. This is
# the documented suppression, not a blanket `-dontwarn`.
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
