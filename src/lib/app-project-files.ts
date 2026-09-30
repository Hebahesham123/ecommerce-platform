import type { AppTheme } from "./app-theme";
import type { GeneratedFile } from "./app-theme-codegen";

/**
 * The project around the code.
 *
 * The generator writes screens: a folder of TypeScript that nothing knows how
 * to run. These are the files that make it a project — what npm installs, what
 * the phone shows before our code starts, what the stores identify the app by,
 * and what to actually do with the folder once it has been downloaded.
 *
 * They are generated rather than kept in the repository for the same reason
 * the screens are: the app's name, its colour and its address all come from the
 * theme, and a file that has to be edited by hand after every download is a
 * file that will be wrong.
 */

/**
 * A name a package manager and a phone will both accept.
 *
 * Store names have spaces, apostrophes and Arabic in them; npm names and
 * Android application ids have none of those. This keeps what it can and falls
 * back to something that works, rather than producing a project that will not
 * install.
 */
function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "shop";
}

/** com.something.shop — letters and dots only, which is all Android allows. */
function bundleId(name: string): string {
  const id = slug(name).replace(/-/g, "");
  return `com.${id || "shop"}.shop`;
}

const json = (path: string, value: unknown): GeneratedFile => ({
  path,
  language: "json",
  contents: `${JSON.stringify(value, null, 2)}\n`,
});

/**
 * What npm has to install for any of the generated code to run.
 *
 * Pinned to one Expo SDK's own versions rather than to whatever is newest. A
 * React Native project with mismatched native modules does not fail at install
 * — it fails at build, on a machine that is not this one, with an error about
 * a header file.
 */
function packageJson(theme: AppTheme): GeneratedFile {
  return json("package.json", {
    name: slug(theme.settings.storeName),
    version: "1.0.0",
    main: "index.js",
    private: true,
    scripts: {
      start: "expo start",
      android: "expo run:android",
      ios: "expo run:ios",
    },
    dependencies: {
      expo: "~52.0.0",
      "expo-status-bar": "~2.0.0",
      // Metro's asset plugin needs this at build time even when nothing in
      // the app imports it directly — a release build fails without it, with
      // an error that does not mention the icon or splash it is really about.
      "expo-asset": "~11.0.1",
      // The editor's gradients and icons, drawn natively rather than faked.
      "expo-linear-gradient": "~14.0.2",
      "react-native-svg": "15.8.0",
      react: "18.3.1",
      "react-native": "0.76.6",
      "react-native-safe-area-context": "4.12.0",
      "react-native-screens": "~4.4.0",
      "react-native-webview": "13.12.5",
      "@react-native-async-storage/async-storage": "1.23.1",
    },
    devDependencies: {
      "@babel/core": "^7.25.2",
      "@types/react": "~18.3.12",
      typescript: "~5.3.3",
    },
  });
}

/**
 * What the phone shows before our code runs, and what the stores know the app
 * by.
 *
 * The bundle identifier is the one value here that can never be changed after
 * publishing: it is how Apple and Google know this app is this app, and a new
 * one is a new listing with none of the reviews or the installs.
 */
function appJson(theme: AppTheme): GeneratedFile {
  const id = bundleId(theme.settings.storeName);
  return json("app.json", {
    expo: {
      name: theme.settings.storeName || "Shop",
      slug: slug(theme.settings.storeName),
      version: "1.0.0",
      orientation: "portrait",
      userInterfaceStyle: "light",
      // No icon or splash image is named, and that is deliberate. Naming a file
      // that is not there fails the build, and the first build is the one that
      // has to succeed — it is how anyone finds out whether this works on a
      // real phone at all. Expo's placeholder carries it until there is
      // something better. The colours are set either way, so even the
      // placeholder opens in the shop's own colour rather than in white.
      splash: {
        resizeMode: "contain",
        backgroundColor: theme.settings.accent || "#ffffff",
      },
      ios: { supportsTablet: true, bundleIdentifier: id },
      android: {
        adaptiveIcon: { backgroundColor: theme.settings.accent || "#ffffff" },
        package: id,
      },
    },
  });
}

/** Two builds: one to put on a phone today, one the stores will accept. */
function easJson(): GeneratedFile {
  return json("eas.json", {
    cli: { version: ">= 12.0.0" },
    build: {
      // Installs straight onto a phone from a link. No store, no review.
      preview: { distribution: "internal", android: { buildType: "apk" } },
      production: { autoIncrement: true },
    },
    submit: { production: {} },
  });
}

function entry(): GeneratedFile {
  return {
    path: "index.js",
    language: "js",
    contents: `import { registerRootComponent } from "expo";

// Boot fetches the shop's current theme, then loads App with it.
import Boot from "./Boot";

// Registers the root component and sets up the dev client in one call, so
// nothing else has to know which of the two it is running under.
registerRootComponent(Boot);
`,
  };
}

function babelConfig(): GeneratedFile {
  return {
    path: "babel.config.js",
    language: "js",
    contents: `module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
`,
  };
}

function tsconfig(): GeneratedFile {
  return json("tsconfig.json", {
    extends: "expo/tsconfig.base",
    compilerOptions: { strict: true },
  });
}

function gitignore(): GeneratedFile {
  return {
    path: ".gitignore",
    language: "md",
    contents: `node_modules/
.expo/
dist/
*.log

# Signing keys and service accounts. Never these: anyone holding them can
# publish an update to your app.
*.keystore
*.p8
*.p12
google-services.json
GoogleService-Info.plist
`,
  };
}

/** What to do with the folder, for somebody who has never built an app. */
function readme(theme: AppTheme, baseUrl: string): GeneratedFile {
  const name = theme.settings.storeName || "Shop";
  return {
    path: "README.md",
    language: "md",
    contents: `# ${name} — mobile app

Generated from the app theme. Arranging a section in the dashboard is what
writes the code for it, so this folder is an **output**: download it again
after a change rather than editing it here and losing the edit next time.

## See it on your own phone

\`\`\`bash
npm install
npx expo start
\`\`\`

Install **Expo Go** from the App Store or Play Store, scan the QR code, and the
app opens on your phone. No Android Studio, no Xcode, no developer account.

## Build something you can send to someone

\`\`\`bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android
\`\`\`

That produces an APK — a file anyone with an Android phone can install from a
link. It is the fastest way to put this in a real person's hands.

\`--profile production\` builds what the stores accept instead.

## Before you submit to a store

- Add your own icon and splash. This project deliberately names neither, so
  the first build cannot fail on a missing file — it uses Expo's placeholder
  in your accent colour. To replace it: put \`icon.png\` (1024x1024, no
  transparency) and \`splash.png\` in \`assets/\`, then add
  \`"icon": "./assets/icon.png"\` and \`"image": "./assets/splash.png"\`
  (inside \`splash\`) to \`app.json\`.
- Check the bundle id in \`app.json\`. **It can never be changed after
  publishing** — a different one is a different listing, with none of the
  reviews or installs.
- Apple rejects apps that are mostly a website in a wrapper (their rule 4.2).
  The home screen, the product screens and the reels are what answer that, so
  they need to be the parts carrying the app.

## Where it gets its data

This app talks to \`${baseUrl}\`. That address is baked in at generation time,
so if the shop moves to another domain, download the folder again.
`,
  };
}

/** Everything that turns the generated screens into a runnable project. */
export function projectFiles(theme: AppTheme, baseUrl: string): GeneratedFile[] {
  return [
    packageJson(theme),
    appJson(theme),
    easJson(),
    entry(),
    babelConfig(),
    tsconfig(),
    gitignore(),
    readme(theme, baseUrl),
  ];
}
