# demo-kit — booth video and presenter kit

Everything needed to put Grower Settlement into the IFPA looping reel and to
walk someone through the live demo. Built the same way as
`../../grower-harvesting/demo-kit`; the scene list and the recorder's `actions`
map are the parts specific to this app.

| File | What it is |
|---|---|
| `scenes.mjs` | **Source of truth** for the video: scene order, seconds per scene, captions, voice-over lines. Edit this, then re-run the scripts below. |
| `record.mjs` | Drives the running app with Playwright and records the tour (1920×1080) plus the title card. Writes WebM and, when an H.264 ffmpeg is available, MP4. |
| `write-script.mjs` | Regenerates `voiceover-script.md`, injects the script into `cheat-sheet.html`, and writes the single-file `grower-settlement-cheat-sheet.html` (plus an artifact-ready copy in `out/`). |
| `scratch-vo.mjs` | Lays a Windows text-to-speech read over the tour so pacing can be checked before a real voice is recorded. |
| `voiceover-script.md` | Generated. The narrator's copy with timecodes. |
| `interstitial.html` | The 12 s "Up next" title card shown between clips, identical across the Bluestem apps; only `?next=` changes. Open in a browser (`?loop=1` to loop) or let `record.mjs` render it. |
| `cheat-sheet.html` | Presenter cheat sheet source: click path, what to say, cast, Q&A, resets, plus the voice-over script (injected from `scenes.mjs`). |
| `grower-settlement-cheat-sheet.html` | **Generated.** The same sheet as one self-contained file (fonts and logos inlined). This is the one to share with the team. |
| `assets/` | Poppins woff2 and the RSM marks so the HTML pages work offline. |
| `out/` | Rendered videos, timing JSON and the scratch VO (git-ignored). |

This folder is its own npm package (like `web/` and `api/`): run `npm install`
here once to get Playwright. It pins the Playwright version whose Chromium is
already installed on this machine; `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` keeps
the install from fetching another.

## Render the video

The app's demo data is baked in at build time and runs from January 1 to the
day it was exported, so export it first on the day you record. Set the env
vars from PowerShell, not Git Bash.

```powershell
# 1. fresh demo data (from api/) — regenerates web/public/demo/*.json for today
npm run export:demo

# 2. production build in static-data, mock-auth mode (from web/); the dev server
#    hangs on this OneDrive checkout, vite preview is reliable
$env:VITE_DATA_MODE = 'static'; $env:VITE_AUTH_MODE = 'mock'; $env:VITE_BASE = '/'
npm run build
npx vite preview --port 5198 --strictPort      # leave running

# 3. record (new terminal, from the repo root)
node demo-kit/record.mjs                        # tour + title card → demo-kit/out/
node demo-kit/record.mjs --only tour --no-captions
node demo-kit/write-script.mjs                  # voiceover-script.md + cheat sheets
node demo-kit/scratch-vo.mjs                    # optional: TTS pacing check
```

`record.mjs` uses Playwright's full Chromium (`channel: 'chromium'`) so the
recording matches a real browser. For MP4 it needs an ffmpeg with libx264: set
`$env:FFMPEG`, put `ffmpeg` on PATH, or `pip install imageio-ffmpeg`. Without
one you still get WebM.

Each scene is held for exactly the seconds in `scenes.mjs`, so cuts land on the
scripted timecodes; the recorder warns if an action runs long. A magenta slate
covers the page until scene 1 starts and the MP4 is trimmed at the last slate
frame, so the picture starts on the first scene regardless of load time.

Nothing the recorder does mutates data: it navigates, filters, switches tabs
and hovers. The one button it presses is **Simulate truck RFID scan** on the
Inbound Gate, which fills a ticket held in page state until the next
navigation (the scan is seeded so every take shows the same truck). It never
clicks Download PDF, Email to grower, Generate preview or Capture departure,
and the browser context refuses any request that is not a GET to the app.

## Change the script

Edit `scenes.mjs`, then:

```powershell
node demo-kit/write-script.mjs    # refresh voiceover-script.md and see the wpm check
node demo-kit/record.mjs          # re-record so the cuts land on the new timecodes
node demo-kit/scratch-vo.mjs      # confirm every scene still has spare time
```

Keep each scene's narration under `seconds × 2.5` words; the generator flags any
line that is over, and the scratch read reports the spare seconds per scene.

## Before the show

The hosted demo (grower-settlement.rsmd365.com) bakes its data at deploy time.
Redeploy (push to `main`, or Retry deployment in Cloudflare Pages) a day or two
before the show so the dashboard's current week has activity; the cheat sheet
tells presenters how to tell when that has not happened.
