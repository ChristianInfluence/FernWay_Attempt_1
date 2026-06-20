# FernWay (Prototype)

This repository contains a minimal prototype web app that uses MapLibre with OpenFreeMap vector data as the primary background, displays a looping MP4 loading screen, and shows a polished menu overlay on first load.

The app requests browser location permission and uses continuous geolocation updates to move a user-location marker and accuracy circle as the device moves.

Files added:
- `index.html` — main page and MapLibre library setup.
- `styles.css` — basic styles for map, loading, and menu overlays.
- `app.js` — initialization, map callback, overlay toggles.
- `assets/fernway-logo.png` — optimized FernWay brand artwork.
- `manifest.json` — PWA manifest for installability.
- `service-worker.js` — simple cache-first service worker.

Quick setup

1. Serve the folder over a local web server (some browsers restrict `file://` autoplay and service worker behavior).

Example (Python 3):

```bash
python -m http.server 8000

# Then open http://localhost:8000
```

Notes
- The map uses MapLibre and OpenFreeMap vector data, so no API key is required.
- Location tracking works on `localhost` during development. Production deployments must use HTTPS and require the user's permission.
- Keep the required OpenStreetMap and OpenFreeMap attribution visible. For production, review the provider's terms or self-host the vector data.
- To make the app installable on iOS and desktop, customize `manifest.json` and add proper icons. iOS requires meta tags in `index.html` and additional steps.
- `FernWay.mp4` is used as the full-screen loading animation.
- The manifest still uses placeholder icons — add production icons when ready.

# FernWay_Attempt_1
first attempt
