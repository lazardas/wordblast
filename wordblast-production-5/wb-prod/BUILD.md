# Word Blast — Build APK via EAS (no local Android SDK needed)

EAS builds in the cloud. You only need Node + the EAS CLI.
The APK download link is sent to your email / Expo dashboard.

---

## Step 1 — Install tools (one time)

```bash
npm install -g eas-cli
```

---

## Step 2 — Login to Expo

```bash
eas login
```

Create a free account at expo.dev if you don't have one.

---

## Step 3 — Link project to EAS

```bash
cd wordblast
eas init
```

This generates a projectId and writes it into app.json automatically.

---

## Step 4 — Create placeholder icons (required)

EAS will fail without icon files. Quickest option:

```bash
# Mac/Linux — creates a solid color PNG placeholder
python3 -c "
from PIL import Image
img = Image.new('RGB', (1024,1024), color=(189,178,255))
img.save('assets/icon.png')
img.save('assets/adaptive-icon.png')
img2 = Image.new('RGB', (1284,2778), color=(254,246,255))
img2.save('assets/splash.png')
"
```

Or just copy any 1024×1024 PNG into assets/ and name it icon.png.

---

## Step 5 — Build APK

```bash
eas build --platform android --profile preview
```

- Takes ~10 minutes (cloud build)
- No Android SDK needed on your machine
- When done: download link appears in terminal + expo.dev dashboard
- Install APK directly on your Android phone

---

## Step 6 — Test deep links on the APK

After installing the APK, test the challenge flow:

```bash
# From another terminal / ADB
adb shell am start -W -a android.intent.action.VIEW \
  -d "wordblast://challenge/TEST12" com.wordblast.app
```

Or share a challenge link from inside the app — the custom scheme
`wordblast://challenge/MATCHID` works immediately after install.

The HTTPS universal links (`https://wordblast.app/challenge/ID`)
require hosting the assetlinks.json file — see DEEP_LINKS.md.

---

## Production build (for Play Store)

```bash
eas build --platform android --profile production
```

This produces an .aab (Android App Bundle) for Play Store submission.

---

## iOS build

```bash
eas build --platform ios --profile production
```

Requires Apple Developer account ($99/yr).
