# NEXUS//HUD

A full-desktop HUD for Windows 11, built with Electron. It has interchangeable **skins** that run on one shared engine and a shared library of reusable **widgets** (gadgets).

## Skins

| Skin | Version | Status | Look | Widgets |
|------|---------|--------|------|---------|
| [`v1-nexus`](skins/v1-nexus) | 1.0.0 | ✅ stable | Hacker / Iron-Man HUD: cyan on black, hex grid, scanlines, arc-reactor clock, boot sequence | clock\*, sys, pet, research, terminal, todo, projects, media, tech, anime |
| `v2-lofi` | 2.0.0 | 🚧 planned | Anime / lo-fi: soft pastels, night-city wallpaper, rounded cozy widgets | v1 widgets plus schedule, meals, water, image feed, pomodoro, launcher, notes |

\* = skin-specific widget; all others come from the shared library.

To switch skins, use **tray icon → Skin**, or ⚙ → *Skin* inside the HUD. To launch straight into one skin, set `NEXUS_SKIN=v1-nexus` before running `npm start`.

## Shared widgets

| Widget | What it does |
|--------|--------------|
| `sys` | CPU sparkline and per-thread bars, RAM, disk, uptime |
| `pet` | Tamagotchi companion. Stats decay in real time (even while the app is closed); finishing tasks and projects gives XP. Sprite colors come from the skin |
| `research` | Research agent with streamed, tiled briefings and history. Local engine: Ollama + web search (free). Cloud engine: Claude + web search (API key) |
| `terminal` | Real PowerShell (node-pty + xterm.js) |
| `todo` | Tasks with priorities (`!` high, `!!` critical) |
| `projects` | Projects with progress, status, notes and link |
| `media` | Now playing for any Windows media session (Spotify, browser tabs…) with controls and album art |
| `tech` | AI / tech news (HN, The Verge, TechCrunch, Ars, MIT TR) |
| `anime` | Airing schedule from AniList with Crunchyroll links, plus anime news |

## Run

```bash
npm install
npm start
```

You can also double-click **`Start NEXUS.vbs`** (no console window).

- **Ctrl + Alt + Space** shows or hides the HUD. Closing the window hides it to the tray.
- Double-click a panel header (or press ⤢) to maximize it; Esc restores it.
- Tray / ⚙: skin, research engine, start with Windows.

### Research engines

- **Local (default):** a local Ollama model plans the queries and writes the briefing. Results come from a hidden browser window (DuckDuckGo, then Bing) plus the Wikipedia API. It's free and needs no key; just have the Ollama app running (qwen3:8b is preferred).
- **Cloud:** Claude with server-side web search. You need an Anthropic API key, which is stored encrypted with Windows DPAPI.

## Project layout

```
main.js, preload.js        Electron main process + the safe window.nexus bridge
src/main/                  Engine: store, skins, feeds, sysinfo, terminal (pty), media poller, research (Claude/Ollama), websearch
shared/core/               Renderer core: util (DOM helpers, event bus, cssVar), modal/settings, hud (skin bootstrap)
shared/widgets/            Reusable widgets, each exporting mount({ panel, body, meta, slot })
shared/styles/widgets.css  Widget styles, themed through CSS variables
skins/<id>/                A skin: skin.json, index.html (layout), styles.css (palette + chrome), js/app.js (+ skin-only widgets)
```

### Making a skin

1. Copy a skin folder to `skins/vN-name/` and edit `skin.json`.
2. In `index.html`, place panels with `data-widget="todo"` etc. Each needs a `[data-body]` element and optionally `data-slot="meta|refresh|history|tabs"` and `data-max`.
3. In `styles.css`, set the palette variables on `:root`: `--accent --accent2 --accent3 --ok --warn --danger --text --strong --dim --faint --line --panel --glow --mono --display`, plus optional `--pet-*` and `--term-*`.
4. In `js/app.js`, call `bootHud({ ...widgets, myCustomWidget })`.

All data lives in `%APPDATA%\nexus-hud\nexus-data.json` and is shared by every skin.

## Changelog

- **v1.0.0**: First release. NEXUS hacker skin with 10 widgets, local and cloud research, and an engine restructured so every skin shares its widgets.
