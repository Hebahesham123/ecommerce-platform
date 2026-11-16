# BeautyBar — Flutter app

The Flutter version of the BeautyBar shopping app. It draws itself from the
same live "app pack" as the React Native app: theme, home sections, tabs and
screens come from `GET /api/storefront/app-theme` every time it opens, so
changes made in the dashboard reach installed apps without a new build.

See `PORTING.md` for how the code is organised.

## Which server it talks to

`lib/core/api.dart` → `apiBase = https://srv2120209.hstgr.cloud/api/storefront`
(our own server; nothing goes to Vercel or Supabase).

Pictures from `/media/*` and `cdn.shopify.com` are loaded through the
server's resizer (`/_next/image`), as small WebP copies sized for the screen.

`assets/bundled_pack.json` is the theme the app shows before the live one
arrives (first launch, or offline). Refresh it from the server before a
release:

```
curl -s https://srv2120209.hstgr.cloud/api/storefront/app-theme | jq .data > assets/bundled_pack.json
```

## Build

```
flutter pub get
flutter build apk --release        # APK for direct install
flutter build appbundle --release  # for Google Play
```

Raise `version:` in `pubspec.yaml` before every release (the number after
`+` must go up, or phones refuse the update).

## Signing key (not in git)

`android/app/build.gradle.kts` signs with `android/app/release-shared.keystore`.
That file is **deliberately not committed**: whoever holds it can publish
updates that phones accept as BeautyBar. Get it from the team password
manager and put it in `android/app/` before building a release. Before
publishing on Google Play, replace it with a proper upload key and enable
Play App Signing (see the security roadmap, item 0.5).
