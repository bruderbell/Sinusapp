# 🫁 Sinus Tracker PWA

A Progressive Web App for tracking sinus pain. Works offline, installs to your Android home screen.
All data stored locally in your browser — nothing leaves your device.

---

## How to get it on your phone

### Option A — GitHub Pages (recommended, free, permanent)

1. Create a free account at https://github.com
2. New repository → name it `sinus-tracker` → set to **Public**
3. Upload all four files (`index.html`, `app.js`, `sw.js`, `manifest.json`)
4. Go to **Settings → Pages → Source → main branch / root** → Save
5. Your URL will be: `https://yourusername.github.io/sinus-tracker`
6. Open that URL in Chrome on your phone
7. Chrome will show **"Add to Home Screen"** banner, or tap the three-dot menu → **Add to Home Screen**

Done — it appears on your home screen like a real app, works offline.

### Option B — Netlify (even easier)

1. Go to https://netlify.com → sign up free
2. Drag the folder containing these 4 files onto the Netlify dashboard
3. You get a URL instantly (e.g. `https://random-name.netlify.app`)
4. Open it in Chrome on your phone → Add to Home Screen

---

## Files

| File | Purpose |
|---|---|
| `index.html` | App UI and styles |
| `app.js` | All logic, localStorage data layer |
| `sw.js` | Service worker — enables offline use |
| `manifest.json` | PWA metadata (icon, name, theme) |

---

## Features

- Multi-select pain location chips
- 0–10 severity slider with colour feedback  
- Daily allergy pill toggle
- Medication checklist + free-text field
- Notes field (triggers, weather, barometric pressure…)
- Full history view with delete
- CSV export (for sharing with your doctor/allergist)
- Works fully offline after first load
- Installable to Android home screen

---

## Daily reminder

PWA scheduled notifications require a server component. 
**Simplest approach:** set a repeating alarm in your phone's Clock app labelled "Log sinus symptoms".
