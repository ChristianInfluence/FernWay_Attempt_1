# FernWay (Prototype)

This repository contains a minimal prototype web app that uses Google Maps as the primary background, displays a looping MP4 loading screen, and shows a 50% opaque main menu overlay on first load.

Files added:
- `index.html` — main page (replace `YOUR_API_KEY` with your Google Maps API key).
- `styles.css` — basic styles for map, loading, and menu overlays.
- `app.js` — initialization, map callback, overlay toggles.
- `manifest.json` — PWA manifest for installability.
- `service-worker.js` — simple cache-first service worker.

Quick setup

1. Add your Google Maps JavaScript API key into the script tag in `index.html` (replace `YOUR_API_KEY`).
2. Place a looping MP4 at `assets/video.mp4` (create the `assets` folder).
3. Serve the folder over a local web server (some browsers restrict `file://` autoplay and service worker behavior).

Example (Python 3):

```bash
python -m http.server 8000

# Then open http://localhost:8000
```

Notes
- To make the app installable on iOS and desktop, customize `manifest.json` and add proper icons. iOS requires meta tags in `index.html` and additional steps.
- This prototype uses a placeholder `assets/video.mp4` and placeholder icons — add real assets when ready.

# FernWay_Attempt_1
first attempt
