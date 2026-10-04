# Usage guide

This guide covers installing, running, and using every skin and widget, plus troubleshooting. For the project layout and how to build your own skin, see the [README](../README.md).

---

## 1. Requirements

| Need | Why | Notes |
|------|-----|-------|
| **Windows 10 / 11** | The media panel, terminal, launcher and notifications use Windows APIs | Tested on Windows 11 at 1920×1080 |
| **Node.js 18+** | To install and run | `node -v` to check |
| **Ollama** *(optional)* | Free local research engine | [ollama.com](https://ollama.com), then `ollama pull qwen3:8b` |
| **Anthropic API key** *(optional)* | Cloud research engine (Claude) | [console.anthropic.com](https://console.anthropic.com) |

You don't need either research engine to use the rest of the HUD.

## 2. Install & launch

```bash
git clone https://github.com/mayurcybercz/custom-huds.git
cd custom-huds
npm install
npm start
```

After the first install, you can double-click **`Start Custom HUDs.vbs`** to launch without a console window.

To start a specific skin: `set HUD_SKIN=v2-lofi && npm start` (cmd) or `$env:HUD_SKIN='v2-lofi'; npm start` (PowerShell).

## 3. Everyday controls (all skins)

| Action | How |
|--------|-----|
| Show / hide the HUD from anywhere | **Ctrl + Alt + Space** |
| Hide to tray | Close the window, or press **—** |
| Quit completely | **⏻**, or tray icon → *Quit* |
| Switch skin | Tray icon → *Skin*, or **⚙** → *Skin* |
| Start with Windows | Tray icon → *Start with Windows*, or **⚙** |
| Maximize a panel | Double-click its header, or press **⤢** |
| Restore a panel / close a dialog | **Esc** |
| Settings (skin, research engine, startup) | **⚙** |

## 4. Skins

### NEXUS (v1): hacker HUD
Cyan-on-black Iron-Man style HUD with a boot sequence, hex-grid background and scanlines. Tech headlines scroll in the top bar, and live CPU / MEM readouts sit at the top right.

### LO-FI (v2): cozy anime / lo-fi
Frosted glass cards over an animated city. The sky follows the **real time of day**: dawn, day, dusk, then night with stars and the moon.

| Control | What it does |
|---------|--------------|
| **✿ / ☂ / ☾** (top right) | Weather: sakura petals (warm light, sun rays), rain (overcast light, rain sound, lightning and thunder, drops on the glass), or clear sky |
| **🔊 / 🔉 / 🔇** | Ambient sound volume (rain and thunder) |
| **⌨** or **Ctrl + `** | Drop-down terminal (Esc or Ctrl + ` again hides it) |
| Double-click the greeting | Set the name it greets you with |
| **Daily rings** (top right) | Today's progress: 🍅 focus sessions (goal 4), 💧 water, ✓ tasks done, plus kcal eaten |
| **tasks / projects** tabs | One card holds both; it remembers the last tab |

### SATOYAMA (v3): a living Japanese village
The whole desktop is a pixel-art village with a temple on the hill, thatched farmhouses, paddies, a creek and a forest. The HUD is reduced to quiet one-colour rails at the edges that fade while you're not using them.

**Scene modes** (left button on the dock):

| Mode | What you get |
|------|--------------|
| ⟳ **Auto day** (default) | The whole day as six scenes, 1½–2½ minutes each, about 12½ minutes per day. Dawn mist at the temple, morning, midday with kids and a kite, coming home at dusk, the evening (a festival unless it rained), then the forest late at night. Every third day is rainy. ⏭ (or **N**) skips to the next scene. |
| 🌅 Dawn · ☀️ Midday · 🌆 Dusk | Hold that moment |
| 🏮 **Festival night** | Lantern strings, bon-odori dancers circling the yagura, a drummer, a food stall, kids with sparklers, the bonfire, taiko and flute |
| ☔ Rainy afternoon | Overcast light, umbrellas, rain on the thatch and the creek |
| 🌲 Forest night | Fireflies, the toad family out of their hut, an owl, kajika frogs |
| 🕰️ Real clock | Follows your computer clock. The festival is on Saturdays and during Obon (13–16 Aug) |

The temple bell rings at 6:00, 12:00 and 18:00 scene time. The camera drifts by itself, toward the temple at dawn, the square at midday, the fields at dusk and the forest late at night.

**Things you can touch:**

| Do this | What happens |
|---------|--------------|
| Hold the mouse on the **dog** (by the path) and rub | It wags, sticks its tongue out, hearts float up, and it pants happily (sometimes a small "wuf") |
| Rub the **cat** (on a veranda by day, on a roof at night) | It closes its eyes and purrs |
| Hover the **kids** | They wave and jump. Clicking the sky by day makes them all run around |
| Click the **kite** | It does a loop |
| Move through the **water**, or click it | Ripples follow your mouse, and a click makes a splash and maybe a fish jump |
| Brush the **rice**, **bamboo** or the big **camphor tree** | Stalks part around the cursor and rustle; the tree drops leaves |
| Get close to the **sparrows** on a roof, or the flock in the sky | They scatter |
| Drag across a **cloud** | You push it along |
| Click the **night sky** | A shooting star |
| Click the **bell house** on the hill | The bell rings |
| Click the **bamboo pump** by the creek | It tips early |
| Hover a **toad** (forest, at night) | It croaks; click it and it hops |
| Hover the **owl** | It turns and hoots |
| Move near **fireflies** | They drift toward you |
| Wave over the **festival lanterns** | They sway |

**Dock** (bottom centre):
- 🔭 📝 🍱 ✦ 🚀 🌸 🐾 open research, notes, meals, projects, launcher, anime or the companion as a sheet over the centre. Click outside the sheet or press Esc to close it.
- ⌨ opens the drop-down terminal.
- 🔊 sets the volume (sound is on by default). **M** mutes, and muting fully pauses audio to save CPU.
- ● cycles the HUD colour: washi, sakura, matcha, lantern or sora.
- ◐ (or **H**) hides the HUD so it's just the village.

**Sound:** everything is synthesised live:
- the creek, wind, rain on thatch, bonfire and festival crowd
- birds (uguisu, sparrows, kite-hawk, crows), cicadas, crickets, frogs, toads and the owl
- the bamboo pump, the temple bell, wind chimes, taiko and flute
- the dog and cat

Sounds are placed left or right by where they are in the scene, and get quieter when the camera is far away. Run `npm run fetch-audio` once to add two CC0 recordings: children playing (very quiet, daytime only) and a real temple bell from Hida no Sato. Without them, the bell is synthesised and there are no children's voices.

**CPU:** the village is drawn at 640×348 and scaled up. It runs at 30 fps while you use the mouse, 20 fps otherwise, and 15 fps after a minute idle, which is roughly 3–4% of a modern CPU.

## 5. Widgets

### Schedule ("today")
Your daily timetable.
- **Add a block:** set the start time (end defaults to +1h), pick how it repeats, type a title, and press **Enter**.
  - Repeat options: *every day*, *weekdays*, *weekends*, or *today only*.
- The top shows **NOW** (with time left) and **NEXT** (with a countdown). The current block glows and shows a progress bar.
- Tick a block's circle to mark it done for today; your pet gets XP. Hover a block and press **✕** to delete it.
- You get a desktop notification **5 minutes before** each block starts.

### Focus (Pomodoro)
- **START / PAUSE**, **↺** reset, **⏭** skip to the next phase.
- Focus is 25 min, short break 5, and every 4th break is long (15).
- Link a task from the dropdown; the completion notification names it.
- Finished sessions count toward today's total and the focus ring, and make the pet happy.
- The timer **keeps running** through reloads, skin switches and restarts. If it finished while the HUD was closed, it's credited when you come back.

### Water
- Click the glass (or **+250 ml** / **+500**) to log a drink; **−** undoes a glass. Set your daily **goal** in the field.
- The bars show the last 7 days; full-colour days hit the goal.
- Between 08:00 and 22:00, if you fall behind pace, you get at most one reminder per hour.

### Meals
- Pick the meal (it defaults to the right one for the time of day), type what you ate, and press **Enter**.
  - End with a number to log calories: `paneer wrap 450`.
- Recent meals appear as **chips**; click one to log it again.
- Use **‹ ›** to view other days. **Double-click the kcal total** to set your daily goal.

### Inspiration (image wall)
An auto-scrolling wall of images. Hover to pause, scroll the wheel to move, and click an image to open its page.
- **⚙** edits the sources, one per line:
  - `pin: https://www.pinterest.com/<user>/<board>/` for a **public** Pinterest board
  - `wh: anime rain` for a Wallhaven search (**SFW only**)
- **↻** reshuffles and refreshes. It also refreshes on its own every 30 min.

### Launcher
- **Add:** drag apps, shortcuts, folders, files or links onto the card, or press **+** to type a URL or path.
- **Launch:** click a tile, or press **Alt + 1…9** for the first nine tiles.
- **Right-click** a tile to rename it. Clear the name to remove the tile.

### Notes
- An autosaved scratchpad; **Tab** inserts spaces. **⇄** toggles a markdown preview.
- **+** adds a note. Double-click a tab to rename it, and middle-click it to delete it.

### Tasks
- Type a task and press **Enter**. Prefix with `!` for high priority or `!!` for critical; click the priority tag to cycle it.
- Tick a task to complete it (the pet gets XP). Hover it and press **✕** to delete it.

### Projects
- Type a name and press **Enter**. Click a project to set its progress, status (active / paused / blocked / shipped), notes and a link.
- Hitting **100%** ships it, and the pet celebrates.

### Research
1. Type a topic and press **Enter**. The engine plans searches, reads the web, and streams a briefing as tiles.
2. Briefings are saved in **history** (the last 20). Links open in your browser.

Pick the engine in **⚙**:
- **Local (Ollama):** free and private. Needs the Ollama app running. A briefing takes about 1 min once the model is loaded.
- **Cloud (Claude):** faster and better briefings, billed to your Anthropic key. The key is encrypted with Windows DPAPI.

### Now playing / Audio-Video
Shows whatever Windows is playing (the Spotify app, YouTube or Crunchyroll in a browser…) with album art, progress and **⏮ ⏯ ⏭**.
- Spotify and Crunchyroll need DRM, so they can't play *inside* the HUD. Play them normally and control them from here.

### Companion (pet)
- It hatches about a minute after first launch.
- **FEED / PLAY / SLEEP / CLEAN** raise its stats, which decay in real time (even while the HUD is closed). Click it to pet it, and double-click its name to rename it.
- It earns XP from completed tasks, shipped projects, focus sessions, schedule blocks, water goals and meals, and grows from baby to teen to adult.
- Each skin colours it differently, but it's the same pet everywhere.
- It never dies; if you neglect it, it just gets sad.

### Terminal
A real PowerShell session.
- **Ctrl+Shift+C / Ctrl+Shift+V** copy and paste. Plain **Ctrl+C** interrupts.
- If the shell exits, press any key to restart it.

### System *(NEXUS)*
CPU sparkline plus per-thread bars, RAM, disk and uptime.

### AI // Tech feed *(NEXUS)*
Headlines from Hacker News, The Verge AI, TechCrunch AI, Ars Technica and MIT Technology Review. They refresh every 15 min (↻ refreshes now).

### Anime
- **airing:** popular episodes from the last 12h and the next 24h (AniList). **CR ▶** opens the show on Crunchyroll.
- **news:** Anime News Network, Crunchyroll News and MyAnimeList.

## 6. Your data

Everything lives in one file that every skin shares:

```
%APPDATA%\custom-huds\data.json
```

**To back up, copy that file.** To reset, quit the HUD and delete it.

Coming from the old NEXUS//HUD build? Your data was copied automatically from `%APPDATA%\nexus-hud`. Once you've checked everything, you can delete that old folder.

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| Research says **"Ollama offline"** | Start the Ollama app, then reopen ⚙ and save. Check with `ollama list`. |
| Research says **"Web search returned nothing"** | You're offline, or the search engines are rate-limiting. Wait a minute and retry. |
| Research is slow | The model is partly on the CPU. Close GPU-heavy apps, or pick a smaller model in ⚙. |
| No notifications (water / focus / schedule) | Windows Settings → System → Notifications: make sure they're on and *Do not disturb* is off. |
| Image wall is empty or a source "failed" | Pinterest boards must be public. Check the board URL, or try a different `wh:` search. |
| A launcher tile won't open | The file or app moved. Right-click the tile, clear its name to remove it, then drag the new location in. |
| Media panel says **NO SIGNAL** | Nothing is registered with Windows media controls. Start playback in Spotify or a browser tab. |
| The HUD is hidden and won't come back | Press **Ctrl+Alt+Space**, or click the tray icon. |
| Something looks off after an update | Tray → *Reload*. If that doesn't fix it, quit and relaunch. |
| Hotkey conflict | Another app owns Ctrl+Alt+Space. Change `TOGGLE_HOTKEY` in `main.js`. |
