# Custom HUDs

Skinnable, full-desktop HUDs for Windows 11, built with Electron. Every **skin** is a complete look and layout running on one shared engine, with a shared library of reusable **widgets** (gadgets). Your data (tasks, pet, research history…) is shared by all skins, so switching skins never loses anything.

📖 **[Usage guide](docs/USAGE.md)**: install, controls, every widget, and troubleshooting.

## Skins

| Skin | Version | Status | Look | Widgets |
|------|---------|--------|------|---------|
| [`v1-nexus`](skins/v1-nexus) · **NEXUS** | 1.0.0 | ✅ stable | Hacker / Iron-Man HUD: cyan on black, hex grid, scanlines, arc-reactor clock, boot sequence | clock\*, sys, pet, research, terminal, todo, projects, media, tech, anime |
| [`v2-lofi`](skins/v2-lofi) · **LO-FI** | 2.1.0 | ✅ stable | Cozy anime / lo-fi: frosted glass cards over a city that follows the real time of day; weather changes the lighting (petals, rain with sound and lightning, clear); daily rings | hero\*, schedule, pomodoro, water, meals, images, launcher, notes, todo + projects (tabbed), research, media, anime, pet, terminal (drop-down) |
| [`v3-satoyama`](skins/v3-satoyama) · **SATOYAMA** | 3.0.0 | ✅ new | A living Japanese village as the desktop: realistic pixel art with dynamic light, an auto day cycle (dawn → festival night → forest), scene modes, villagers, a pettable dog and cat, toads, fireflies, a full soundscape; one-colour HUD at the edges | vclock\*, schedule, todo, pomodoro, water, media + on-demand sheets: research, notes, meals, projects, launcher, anime, pet, terminal |

\* = skin-specific widget; all others come from the shared library.

To switch skins, use **tray icon → Skin**, or ⚙ → *Skin*. To launch straight into one skin, set `HUD_SKIN=v3-satoyama` before running `npm start`.

The v3 design notes, with live samples, are in [docs/design/v3-satoyama.html](docs/design/v3-satoyama.html).

## Shared widgets

| Widget | Since | What it does |
|--------|-------|--------------|
| `todo` | v1 | Tasks with priorities (`!` high, `!!` critical) |
| `projects` | v1 | Projects with progress, status, notes and link |
| `research` | v1 | Research agent with streamed, tiled briefings and history. Local engine: Ollama + web search (free). Cloud engine: Claude + web search (API key) |
| `terminal` | v1 | Real PowerShell (node-pty + xterm.js) |
| `pet` | v1 | Tamagotchi companion. Stats decay in real time; tasks, focus sessions, water and meals keep it happy and give XP |
| `media` | v1 | Now playing for any Windows media session (Spotify, browser tabs…) with controls and album art |
| `sys` | v1 | CPU sparkline and per-thread bars, RAM, disk, uptime |
| `tech` | v1 | AI / tech news (HN, The Verge, TechCrunch, Ars, MIT TR) |
| `anime` | v1 | Airing schedule from AniList with Crunchyroll links, plus anime news |
| `schedule` | v2 | Daily timetable with blocks that repeat daily, on weekdays, weekends or once. Shows now / next, lets you tick blocks off, reminds you 5 min before each |
| `pomodoro` | v2 | Focus timer (25/5/15) linked to a task. Survives reloads; counts sessions per day |
| `water` | v2 | Tap-to-log water with an animated glass, 7-day history, and gentle reminders when you're behind pace |
| `meals` | v2 | Meal log per day (type `oats 350` and the trailing number is kcal), recent-meal chips, kcal goal |
| `images` | v2 | Auto-scrolling image wall from Pinterest boards (RSS) and Wallhaven searches (SFW only) |
| `launcher` | v2 | Tiles for apps, folders, files and sites. Drag & drop to add; Alt+1…9 to launch |
| `notes` | v2 | Tabbed scratchpad with autosave and markdown preview |

## Run

```bash
git clone https://github.com/mayurcybercz/custom-huds.git
cd custom-huds
npm install
npm run fetch-audio   # optional: CC0 recordings (children, temple bell) for the SATOYAMA skin
npm start
```

You can also double-click **`Start Custom HUDs.vbs`** (no console window).

- **Ctrl + Alt + Space** shows or hides the HUD. Closing the window hides it to the tray.
- Double-click a panel header (or press ⤢) to maximize it; Esc restores it.
- Tray / ⚙: skin, research engine, start with Windows.

### Research engines

- **Local (default):** a local Ollama model plans the queries and writes the briefing. Results come from a hidden browser window (DuckDuckGo, then Bing) plus the Wikipedia API. It's free and needs no key; just have the Ollama app running (qwen3:8b is preferred).
- **Cloud:** Claude with server-side web search. You need an Anthropic API key, which is stored encrypted with Windows DPAPI.

## Project layout

```
main.js, preload.js        Electron main process + the safe window.hud bridge
src/main/                  Engine: store, skins, feeds, images, sysinfo, terminal (pty), media poller, research (Claude/Ollama), websearch
shared/core/               Renderer core: util (DOM helpers, event bus, cssVar, notify), modal/settings, hud (skin bootstrap, tabbed cards),
                           ambience (WebAudio: rain, thunder, 24 synthesised village voices, ambient layers, CC0 sample playback)
shared/widgets/            Reusable widgets, each exporting mount({ panel, body, meta, slot, opts })
shared/styles/             widgets.css (v1 widgets) + gadgets.css (v2 gadgets), themed through CSS variables
skins/<id>/                A skin: skin.json, index.html (layout), styles.css (palette + chrome), js/app.js (+ skin-only widgets)
skins/v3-satoyama/js/      engine/ (world art, sky, actors, scenery, effects, compositor), director (day cycle & modes),
                           soundscape, pointer; audio/ holds optional CC0 recordings
```

### Making a skin

1. Copy a skin folder to `skins/vN-name/` and edit `skin.json`.
2. In `index.html`, place panels with `data-widget="todo"` etc. Each needs a `[data-body]` element and optionally `data-slot="meta|refresh|history|tabs|config"` and `data-max`.
   - Wording can be overridden per skin with `data-opts`, e.g. `data-opts='{"text":{"run":"search"}}'` on the research panel.
   - To put several widgets in one card as tabs, use a `data-tabcard` section with `data-tab` buttons and one `[data-widget]` pane per tab.
3. In `styles.css`, set the palette variables on `:root`: `--accent --accent2 --accent3 --ok --warn --danger --text --strong --dim --faint --line --panel --glow --mono --display --radius`, plus optional `--pet-*` (companion sprite) and `--term-*` (terminal).
4. In `js/app.js`, call `bootHud({ ...widgets, myCustomWidget })`.

Widgets talk through a small event bus (`todo:done`, `pomo:done`, `water:goal`, `meal:add`, `schedule:done`, `tech:headlines`, `sys:stats`…), so skins can react to anything (tickers, rings, pet rewards).

All data lives in `%APPDATA%\custom-huds\data.json` and is shared by every skin.

## Changelog

- **v3.0.0**: New **SATOYAMA** skin.
  - A pixel-art Japanese village drawn at 640×348 and scaled 3×, with:
    - a light map (lanterns, windows and the bonfire light their surroundings) and bloom
    - a creek that reflects the lit village, swaying bamboo and rice, and a working bamboo pump
  - An auto day cycle of six scenes (1½–2½ minutes each), plus fixed modes: dawn, midday, dusk, festival night, rainy afternoon, forest night and real clock.
  - Villagers on daily schedules, kids and a kite, bon-odori dancers, a dog and cat you can pet, a toad family, fireflies, birds, an owl, and shooting stars on click.
  - A full soundscape, all synthesised, with optional CC0 recordings for children and the temple bell.
  - A one-colour edge HUD that fades when idle, a dock with on-demand sheets, and adaptive frame rate (30/20/15 fps).
- **v2.1.0**: Weather changes the lighting in LO-FI.
  - Rain brings an overcast sky, a storm deck, lit-window halos, droplets on the glass, lightning with thunder, and ambient rain sound.
  - Petals bring warm spring light and sun rays.
- **v2.0.0**
  - Renamed the project to **Custom HUDs**; NEXUS is now the name of the v1 skin. Existing data migrates automatically from `%APPDATA%\nexus-hud`.
  - New **LO-FI** skin.
  - Seven new shared gadgets: schedule, pomodoro, water, meals, image wall, launcher and notes.
  - Engine additions: tabbed cards, per-skin wording (`data-opts`), a drop-down terminal, desktop notifications, and pet rewards for healthy habits.
- **v1.0.0**: First release. NEXUS hacker skin with 10 widgets, local and cloud research, and an engine restructured so every skin shares its widgets.
