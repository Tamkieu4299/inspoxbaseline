# Baseline hub QR (manual share)

This folder is **not** published on the live mini app. Use it to send the link to friends (Zalo, email, print, etc.).

| File | Purpose |
|------|---------|
| `hub-qr.png` | QR code → `http://14.225.212.3:3002/` |

**Regenerate** after the URL changes (from repo root):

```bash
cd baseline-hub
npx --yes qrcode -o share/hub-qr.png "http://14.225.212.3:3002/"
```

On your Mac, the file is also at:

`baseline-hub/share/hub-qr.png`
