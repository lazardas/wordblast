# Deep Link Setup

## What works immediately (no setup)

Custom scheme links work as soon as the APK is installed:

```
wordblast://challenge/ABC123
```

The share button in the app sends this scheme link.
When recipient taps it and has the app → opens directly into match.
When recipient doesn't have app → nothing happens (they need to install first).

---

## What requires a domain (for viral growth)

HTTPS universal links require hosting two files:

### Android — assetlinks.json

Host at: `https://wordblast.app/.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.wordblast.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FROM_EAS"]
  }
}]
```

Get your SHA256 after first EAS build:
```bash
eas credentials --platform android
```

### iOS — apple-app-site-association

Host at: `https://wordblast.app/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "details": [{
      "appID": "YOURTEAMID.com.wordblast.app",
      "paths": ["/challenge/*"]
    }]
  }
}
```

---

## Free hosting option (Vercel, 2 min)

1. Create `/public/.well-known/assetlinks.json` with content above
2. Create `/public/.well-known/apple-app-site-association` with content above
3. Push to GitHub → deploy to Vercel → point wordblast.app domain

---

## Until you have a domain

The share message includes both:
- The https:// link (shows nicely in WhatsApp preview)
- The wordblast:// scheme (works if app installed)

For testing: share the scheme link directly.
For production: set up the domain + assetlinks.
