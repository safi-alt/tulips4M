# Tulips for M

A garden of tulips planted in a heart that **grows** and **blooms** with your hands. Inspired by [spiderlily](https://github.com/cupidbity/spiderlily) — same gesture, many more flowers, made to send as a link.

- **Left hand** — pinch out (spread thumb + index) to **grow** the field from the center
- **Right hand** — pinch out to **bloom** the tulips
- The page auto-plays a bloom cycle until you click **use your hands** (or press `D`). The camera is only requested then, so the link opens as a garden rather than a permission popup.

It is a single `index.html` with no build step. Three.js and MediaPipe load from a CDN. The webcam only works over `http://localhost` or `https`.

---

## Send it to her (GitHub Pages)

GitHub Pages is the easiest way to give her a link. Camera access needs HTTPS, which Pages gives you for free.

1. Create a new **public** GitHub repository (for example `Tulips4M`).
2. From this folder:

```bash
git init
git add .
git commit -m "Tulips for M"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Tulips4M.git
git push -u origin main
```

3. On GitHub: **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main** / **/** (root)
4. After a minute the site is live at:

```
https://YOUR_USERNAME.github.io/Tulips4M/
```

Send her that URL. When it opens, the garden plays on its own. She can allow the camera and click **use your hands** to grow and bloom it herself.

Safari and Chrome both work. Firefox is less reliable with MediaPipe hand tracking.

---

## Run it locally

```bash
python3 -m http.server 8642
```

Then open [http://localhost:8642](http://localhost:8642) and allow the camera.

---

## Keys

| Key | Action |
|-----|--------|
| `D` | toggle auto-bloom vs live hands |
| `1` / `2` / `3` | pin bloom at bud / cup / full (debug) |
| `0` | resume the auto cycle |
| `H` | show/hide the technical HUD |
| drag / scroll | orbit / zoom |

Tweak counts, colors, and bloom poses in the `PARAMS` object at the top of `index.html`. It is also `window.PARAMS` in the browser console.

---

## Credit

Hand-tracking interaction and the original piece: [cupidbity/spiderlily](https://github.com/cupidbity/spiderlily).
