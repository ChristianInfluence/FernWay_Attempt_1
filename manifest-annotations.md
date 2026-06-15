# manifest.json — line-by-line explanation

- `name`: Friendly app name shown in installer UI and app listings.
- `short_name`: Short label used when space is limited (e.g., home screen).
- `start_url`: URL used when the app is launched from the home screen or installer.
- `display`: `standalone` hides the browser UI to make the web app look like a native app.
- `background_color`: Background color used while the app loads.
- `theme_color`: Color used for the browser UI and task switcher on some platforms.
- `icons`: Array of icon objects used for the app icon; each has `src`, `sizes`, and `type`.

Note: JSON does not support comments, so we place this human-readable explanation in a separate file. Keep `manifest.json` strictly valid JSON.
