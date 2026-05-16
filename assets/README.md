# Assets Required for EAS Build

EAS build requires these files. Create them before running `eas build`.

## Required files

### icon.png
- Size: 1024×1024 px
- Format: PNG, no transparency
- Used for: iOS App Store, Android

### adaptive-icon.png  
- Size: 1024×1024 px
- Format: PNG, can have transparency
- Used for: Android adaptive icon foreground

### splash.png
- Size: 1284×2778 px (or any portrait ratio)
- Format: PNG
- Background color: #fef6ff (set in app.json)

## Quick placeholder (for testing only)

You can generate minimal placeholder icons with any image editor,
or use a service like https://www.appicon.co

For a test APK, a simple 1024×1024 purple square (#bdb2ff) works fine.

## For production

Design proper icons before submitting to stores.
