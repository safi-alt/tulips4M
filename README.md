# Tulips for M

A garden of tulips planted in a heart that **grows** and **blooms** with your hands. Inspired by [spiderlily](https://github.com/cupidbity/spiderlily).

- **Left hand** — pinch out (spread thumb + index) to **grow** the field from the center
- **Right hand** — pinch out to **bloom** the tulips
- **Grow / Bloom sliders** work without a camera
- **Choose a tulip** opens the variety catalogue (shape and colour)
- **View a bloom** moves in for a close look; **Return to garden** goes back

It is static files only (HTML, CSS, JS, one HDR). Three.js r166, Anime.js 3.2.2 and MediaPipe load from a CDN. The webcam only works over `http://localhost` or `https`.

---

## Send it to her (GitHub Pages)

Relative paths (`./js/`, `./assets/`) work at the repo root or under `https://USER.github.io/Tulips4M/`.

1. Create a public GitHub repository named `Tulips4M`.
2. From this folder:

```bash
git add .
git commit -m "More realistic blooming tulips"
git push -u origin main
```

3. GitHub → **Settings → Pages** → Deploy from branch **main** / **root**.

The link will be `https://YOUR_USERNAME.github.io/Tulips4M/`.

---

## Run it locally

```bash
python3 -m http.server 8642
```

Open [http://localhost:8642](http://localhost:8642).

---

## Keys

| Key | Action |
|-----|--------|
| `D` | auto garden vs live hands |
| `1` / `2` / `3` / `4` | pin bud / loosening / cup / full |
| `0` | resume the auto cycle |
| `H` | technical HUD (includes measured FPS) |
| drag / scroll | orbit / zoom |

---

## Optional artist asset

The procedural flowers work without extra files. A later upgrade could load a textured tulip `.glb` with **separate petal meshes** or **matching bloom morph targets** (closed, loosening, cup, open), plus albedo / roughness / normal maps in the 2k range. Keep petals as unique objects so hand-driven bloom can still scrub.

---

## Credit

Hand-tracking interaction: [cupidbity/spiderlily](https://github.com/cupidbity/spiderlily).  
Environment lighting: Three.js `venice_sunset` HDRI (r166 examples).
