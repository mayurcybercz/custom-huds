# Usage guide

This guide covers installing, running and using every widget, plus troubleshooting. For the project layout and how to build your own skin, see the [README](../README.md).

---

## 1. Requirements

| Need | Why | Notes |
|------|-----|-------|
| **Windows 10 / 11** | The media panel, terminal and launcher use Windows APIs | Tested on Windows 11 at 1920×1080 |
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

After the first install, you can double-click **`Start NEXUS.vbs`** to launch without a console window.

To start a specific skin: `set NEXUS_SKIN=v1-nexus && npm start` (cmd) or `$env:NEXUS_SKIN='v1-nexus'; npm start` (PowerShell).

## 3. Everyday controls

| Action | How |
|--------|-----|
| Show / hide the HUD from anywhere | **Ctrl + Alt + Space** |
| Hide to tray | Close the window, or press **—** at the top right |
| Quit completely | **⏻** at the top right, or tray icon → *Quit* |
| Switch skin | Tray icon → *Skin*, or **⚙** → *Skin* |
| Start with Windows | Tray icon → *Start with Windows*, or **⚙** |
| Maximize a panel | Double-click its header, or press **⤢** |
| Restore a panel / close a dialog | **Esc** |
| Settings | **⚙** at the top right |

## 4. Widgets

### Clock *(v1 only)*
Arc-reactor clock with the seconds on the ring. The bars show how much of the **day, week, month and year** has passed.

### System
Live CPU (a 2-minute sparkline plus one bar per thread: cyan is normal, amber is busy, red is maxed), RAM, system-drive usage and uptime. It updates every 2 seconds.

### Companion (pet)
Your Tamagotchi, **BYTE**.
- It hatches about a minute after first launch.
- **FEED / PLAY / SLEEP / CLEAN** raise its stats. They decay in real time, even while the HUD is closed, so check in daily.
- Click the pet to pet it. Double-click its name to rename it.
- Finishing a task gives it **+10 XP**, and shipping a project gives **+60 XP**. It grows from baby to teen to adult as it levels up.
- It never dies. If you neglect it, it just gets sad and messy.

### Research Core
Type a topic and press **Enter** (or **ENGAGE**).
1. The engine plans search queries and searches the web. The status line shows each query.
2. It reads the top pages, then streams a briefing in tiles: TL;DR, key facts, comparisons, sources.
3. Finished briefings are saved in the **history** dropdown (the last 20).

Press **ABORT** to stop. Links open in your normal browser.

**Choosing an engine (⚙ → Research engine):**
- **Local: Ollama.** Free and private. It needs the Ollama app running and at least one chat model installed. A briefing takes about 1 minute once the model is loaded; the first run after starting Ollama is slower.
- **Cloud: Claude.** Better and faster briefings, billed to your Anthropic account. Paste your key in ⚙; it's encrypted with Windows DPAPI and never written in plain text.

### Terminal
A real PowerShell session that starts in your home folder.
- **Ctrl+Shift+C / Ctrl+Shift+V** copy and paste. Plain **Ctrl+C** interrupts, as usual.
- If the shell exits, press any key to restart it.
- Reloading the HUD keeps the same shell session running.

### Tasks
- Type and press **Enter** to add a task.
- Prefix with `!` for **HI** priority or `!!` for **critical**.
- Click the priority tag to cycle it, and click the box to complete a task (your pet gets XP).
- Hover a task and press **✕** to delete it.
- Open tasks sort by priority, with completed ones at the bottom.

### Projects
- Type a project name and press **Enter**. Click a project to expand it, where you can:
  - Drag the **progress** slider. At 100%, it's marked **SHIPPED**.
  - Set the **status**: active, paused, blocked or shipped.
  - Keep **notes** and a **link** (opened with ↗).

### Audio / Video
Shows whatever Windows thinks is playing: the **Spotify app**, **YouTube / Crunchyroll in a browser**, VLC and so on. You get title, artist, album art and progress, with **⏮ ⏯ ⏭** controls.
- The SPOTIFY ↗ / CRUNCHYROLL ↗ buttons open those sites in your browser.
- Spotify and Crunchyroll can't play inside the HUD because they need DRM. Play them normally and control them from here.

### AI // Tech feed
Headlines from Hacker News (150+ points), The Verge AI, TechCrunch AI, Ars Technica and MIT Technology Review. It refreshes every 15 minutes (↻ refreshes now). Click a headline to open it. In v1, the headlines also scroll in the top-bar ticker.

### Anime
- **AIRING:** popular episodes that aired in the last 12 hours or air in the next 24, from AniList. **CR ▶** opens the show on Crunchyroll.
- **NEWS:** Anime News Network, Crunchyroll News and MyAnimeList.

## 5. Your data

Everything (tasks, projects, pet, research history, settings) is in one file:

```
%APPDATA%\nexus-hud\nexus-data.json
```

All skins share it, so switching skins keeps your stuff. **To back up, copy that file.** To reset, quit the HUD and delete the file.

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| Research says **"Ollama offline"** | Start the Ollama app (tray icon), then reopen ⚙ and save. Check with `ollama list`. |
| Research says **"Web search returned nothing"** | You're offline, or the search engines are rate-limiting. Wait a minute and retry. |
| Research is slow | The model is partly running on the CPU. Close GPU-heavy apps, or pick a smaller model in ⚙. |
| Media panel says **NO SIGNAL** | Nothing is registered with Windows media controls. Start playback in Spotify or a browser tab. |
| A feed shows **"unreachable: X"** | That site's RSS was down or blocked. The other sources still load. |
| The HUD is hidden and won't come back | Press **Ctrl+Alt+Space**, or click the tray icon. |
| Something looks broken after an update | Tray → *Reload*. If that doesn't fix it, quit and relaunch. |
| Hotkey doesn't work | Another app may own Ctrl+Alt+Space. Change `TOGGLE_HOTKEY` in `main.js`. |
