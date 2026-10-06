/**
 * Records the Grower Settlement booth video with Playwright.
 *
 *   node demo-kit/record.mjs                       # tour + interstitial
 *   node demo-kit/record.mjs --only tour           # just the app tour
 *   node demo-kit/record.mjs --only interstitial   # just the title card
 *   node demo-kit/record.mjs --base http://localhost:5198 --no-captions
 *
 * The app must be running at --base (default http://localhost:5198) as a
 * production build in static data mode — see demo-kit/README.md.
 *
 * Output (demo-kit/out/):
 *   grower-settlement-tour.webm / .mp4   the tour (length = sum of scenes.mjs seconds), 1920×1080
 *   interstitial.webm / .mp4             the 12 s title card between clips
 *   tour-timings.json                    measured scene boundaries (for VO alignment)
 *
 * MP4 (H.264) needs an ffmpeg with libx264. The script looks for, in order:
 * $FFMPEG, `ffmpeg` on PATH, the one bundled with Python's imageio-ffmpeg.
 * Playwright's own ffmpeg is VP8/WebM-only, so without one of those you get WebM.
 *
 * Nothing here mutates demo data: the tour only navigates, filters, switches
 * tabs and hovers. The one button it presses is "Simulate truck RFID scan" on
 * the Inbound Gate, which fills a ticket held in page state and is gone on the
 * next navigation. It never clicks Download PDF, Email to grower, Generate
 * preview or Capture departure. As a backstop the browser context refuses any
 * request that is not a GET to the app's own origin.
 */
import { chromium } from 'playwright'
import { mkdirSync, renameSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { SCENES, VIDEO, TOTAL_SECONDS } from './scenes.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = parseArgs(process.argv.slice(2))
const BASE = (args.base ?? 'http://localhost:5198').replace(/\/$/, '')
const OUT = resolve(args.out ?? join(here, 'out'))
const CAPTIONS = !args['no-captions']
const ONLY = args.only ?? 'all'
const { width: W, height: H } = VIDEO.frame

mkdirSync(OUT, { recursive: true })

const rsmWhite = 'data:image/png;base64,' + readFileSync(join(here, 'assets', 'rsm-logo-white.png')).toString('base64')

// Who and what the tour opens. All of it is in the app's seed data.
const TOUR = {
  // Castillo has both contract types, and is the grower whose statement closes the tour
  contractSearch: 'Castillo',
  contractNumber: 'CT-2026-0002',
  poolSettlement: 'ST000078',
  statementGrower: 'Castillo Family Growers',
  // The gate scan picks its grower with Math.random. Seeding it just before the
  // click makes every take show the same truck: Sunrise Berry Farms (whose gate
  // contract number matches the register) on a fictional carrier.
  gateSeed: 46,
}

// ---------------------------------------------------------------------------
// Overlay injected into the app: a visible cursor, the lower-third caption and
// the closing card. Everything lives under window.__demo so scenes can call it.
// ---------------------------------------------------------------------------
const OVERLAY = String.raw`
(() => {
  if (window.__demo) return;
  const Z = 2147483000;
  const css = document.createElement('style');
  css.textContent = ${JSON.stringify(`
    #__demo-cursor{position:fixed;left:0;top:0;width:28px;height:28px;z-index:${2147483600};pointer-events:none;
      transform:translate(-9999px,-9999px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));will-change:transform}
    .__demo-ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;z-index:${2147483500};
      pointer-events:none;border:3px solid #009CDE;opacity:.9;animation:__demo-rip .55s ease-out forwards}
    @keyframes __demo-rip{from{transform:scale(.25);opacity:.9}to{transform:scale(1.15);opacity:0}}
    #__demo-caption{position:fixed;left:252px;bottom:40px;z-index:${2147483400};display:flex;align-items:stretch;
      opacity:0;transform:translateY(14px);transition:opacity .35s ease,transform .35s ease;pointer-events:none;
      font-family:'Segoe UI',system-ui,sans-serif;max-width:900px}
    #__demo-caption.on{opacity:1;transform:translateY(0)}
    #__demo-caption .bar{width:6px;background:#009CDE;border-radius:3px 0 0 3px;flex:none}
    #__demo-caption .box{background:rgba(0,21,61,.94);color:#fff;padding:12px 22px 13px 18px;border-radius:0 8px 8px 0;
      box-shadow:0 12px 32px rgba(0,21,61,.35)}
    #__demo-caption .t{font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:22px;line-height:1.2;letter-spacing:-.005em}
    #__demo-caption .s{font-size:14.5px;color:#C9D1DB;margin-top:3px;line-height:1.35}
    #__demo-end{position:fixed;inset:0;z-index:${2147483450};background:#00153D;color:#fff;opacity:0;transition:opacity .5s ease;
      font-family:'Segoe UI',system-ui,sans-serif;display:grid;place-items:center}
    #__demo-end.on{opacity:1}
    #__demo-end .inner{display:flex;flex-direction:column;align-items:center;gap:18px;transform:translateY(-20px)}
    #__demo-end .wm{font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:58px;letter-spacing:-.01em;line-height:1;display:flex;align-items:center;gap:16px}
    #__demo-end .wm .stem{color:#3F9C35}
    #__demo-end .title{font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:92px;letter-spacing:-.015em;line-height:1.05;margin-top:12px}
    #__demo-end .tag{font-family:Poppins,'Segoe UI',sans-serif;font-weight:600;font-size:34px;color:#009CDE;margin-top:4px}
    #__demo-end .campus{font-size:17px;color:#9FB0CC;letter-spacing:.08em;text-transform:uppercase;margin-top:26px}
    #__demo-end .rsm{position:absolute;right:72px;bottom:56px;display:flex;align-items:center;gap:12px;color:#C9D1DB;font-size:15px}
    #__demo-end .rsm img{height:30px;width:auto;display:block}
    #__demo-end .inner > *{opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s ease}
    #__demo-end.on .inner > *{opacity:1;transform:none}
    #__demo-end.on .inner > :nth-child(2){transition-delay:.15s}
    #__demo-end.on .inner > :nth-child(3){transition-delay:.3s}
    #__demo-end.on .inner > :nth-child(4){transition-delay:.45s}
    #__demo-end.on .rsm{transition-delay:.6s}
  `)};
  const mark = (size) => '<svg viewBox="40 30 200 220" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    '<path d="M62 232 Q75 150 150 130" stroke="#009CDE" stroke-width="26" stroke-linecap="round" fill="none"/>' +
    '<g transform="translate(155 108) rotate(-45)"><path d="M-72 0 C-40 -50 40 -50 72 0 C40 50 -40 50 -72 0 Z" fill="#3F9C35"/>' +
    '<path d="M-45 0 L45 0" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/></g></svg>';
  const mount = () => {
    document.head.appendChild(css);
    const cur = document.createElement('div');
    cur.id = '__demo-cursor';
    cur.innerHTML = '<svg viewBox="0 0 28 28" width="28" height="28"><path d="M4 2.5 L4 22.5 L9.3 17.6 L13 26 L16.6 24.4 L12.9 16.2 L20.5 16.2 Z" fill="#fff" stroke="#00153D" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const cap = document.createElement('div');
    cap.id = '__demo-caption';
    cap.innerHTML = '<div class="bar"></div><div class="box"><div class="t"></div><div class="s"></div></div>';
    document.body.appendChild(cap);
    window.addEventListener('mousemove', (e) => { cur.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = '__demo-ripple';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  window.__demo = {
    caption(title, sub) {
      const el = document.getElementById('__demo-caption'); if (!el) return;
      const swap = () => { el.querySelector('.t').textContent = title; el.querySelector('.s').textContent = sub || ''; el.classList.add('on'); };
      if (el.classList.contains('on')) { el.classList.remove('on'); setTimeout(swap, 260); } else swap();
    },
    hideCaption() { const el = document.getElementById('__demo-caption'); if (el) el.classList.remove('on'); },
    hideCursor() { const el = document.getElementById('__demo-cursor'); if (el) el.style.display = 'none'; },
    // Replace Math.random with a seeded mulberry32 so simulated readings repeat between takes.
    seedRandom(seed) {
      let a = seed >>> 0;
      Math.random = () => {
        a = (a + 0x6d2b79f5) >>> 0; let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    endCard(opts) {
      const el = document.createElement('div'); el.id = '__demo-end';
      el.innerHTML = '<div class="inner">' +
        '<div class="wm">' + mark(66) + '<span>blue<span class="stem">stem</span></span></div>' +
        '<div class="title">' + opts.title + '</div>' +
        '<div class="tag">' + opts.tagline + '</div>' +
        '<div class="campus">' + opts.campus + '</div>' +
        '</div><div class="rsm"><span>Powered by</span><img alt="RSM" src="' + opts.rsm + '"></div>';
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    },
  };
})();`

// A solid magenta slate covers the page from first paint until scene 1 starts.
// toMp4 finds the last magenta frame in the WebM, so the trim is frame-exact
// no matter how long the page took to load.
const SLATE = String.raw`
(() => {
  const mount = () => {
    const el = document.createElement('div'); el.id = '__demo-slate';
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#FF00FF';
    document.body.appendChild(el);
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.__slateOff = () => document.getElementById('__demo-slate')?.remove();
})();`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function moveTo(page, locator, steps = 18) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('moveTo: element not visible: ' + locator)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
}

async function click(page, locator, { settle = 250, before } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15000 })
  await locator.scrollIntoViewIfNeeded()
  await moveTo(page, locator)
  await sleep(140)
  if (before) await before()
  await page.mouse.down()
  await sleep(70)
  await page.mouse.up()
  await sleep(settle)
}

async function hover(page, locator) {
  await locator.waitFor({ state: 'visible', timeout: 15000 })
  await locator.scrollIntoViewIfNeeded()
  await moveTo(page, locator, 30)
}

/** Smooth-ish wheel scroll in small steps so the recording shows motion.
 *  The app scrolls inside <main>, so the cursor has to be over the content.
 *  Clamped to the room <main> has left: wheeling past its end would scroll the
 *  document instead and push the header off the top of the frame. */
async function wheel(page, dy, steps = 14) {
  const room = await page.evaluate(() => {
    const m = document.querySelector('main')
    return m ? m.scrollHeight - m.clientHeight - m.scrollTop : 0
  })
  dy = Math.min(dy, Math.max(0, room - 2))
  if (dy <= 0) return
  const step = dy / steps
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, step)
    await sleep(28)
  }
}

async function scrollTop(page) {
  await page.evaluate(() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(450)
}

const nav = (page, name) => page.locator('nav').getByRole('link', { name, exact: true })
const main = (page) => page.locator('main')
// Page titles are Fluent Title2 spans, not <h1>
const pageTitle = (page, text) => main(page).locator('.fui-Title2').filter({ hasText: text })

async function goTo(page, linkName, titleText = linkName) {
  await click(page, nav(page, linkName), { settle: 100 })
  await pageTitle(page, titleText).waitFor({ timeout: 20000 })
  // give TanStack Query a beat to paint real rows
  await sleep(300)
}

async function caption(page, scene, step) {
  if (!CAPTIONS) return
  const c = step ?? scene
  await page.evaluate(([t, s]) => window.__demo?.caption(t, s), [c.caption, c.sub])
}

// ---------------------------------------------------------------------------
// Scene choreography. Each must finish inside its scenes.mjs budget; the runner
// pads to the budget so the cut lands on the scripted timecode.
// ---------------------------------------------------------------------------
const actions = {
  async dashboard(page) {
    // Opens on the current fiscal week (in progress); step back to the last posted week.
    await page.mouse.move(W * 0.42, H * 0.2, { steps: 20 })
    await sleep(1400)
    await click(page, page.getByRole('button', { name: 'Previous period' }), { settle: 200 })
    await moveTo(page, main(page).getByText('Net grower payable', { exact: true }), 22)
    await sleep(1700)
    await wheel(page, 600)
    await sleep(1900)
    await scrollTop(page)
  },

  async 'growers-items'(page, scene) {
    const [, items] = scene.steps
    await goTo(page, 'Vendors')
    await page.mouse.move(W * 0.4, H * 0.42, { steps: 16 })
    await sleep(1900)
    await goTo(page, 'Items')
    await caption(page, scene, items)
    await page.mouse.move(W * 0.45, H * 0.5, { steps: 14 })
    await sleep(500)
    await wheel(page, 220, 10)
  },

  async contracts(page) {
    await goTo(page, 'Contracts')
    await sleep(800)
    await click(page, page.getByPlaceholder('Search contract # or grower…'), { settle: 120 })
    await page.keyboard.type(TOUR.contractSearch, { delay: 65 })
    await sleep(900)
    await click(page, main(page).getByRole('link', { name: TOUR.contractNumber, exact: true }), { settle: 100 })
    await pageTitle(page, TOUR.contractNumber).waitFor({ timeout: 15000 })
    await page.mouse.move(W * 0.36, H * 0.4, { steps: 16 })
    await sleep(1100)
    await wheel(page, 260, 10)
  },

  async 'inbound-gate'(page) {
    await goTo(page, 'Inbound Gate')
    await sleep(700)
    await click(page, page.getByRole('button', { name: 'Simulate truck RFID scan' }), {
      settle: 200,
      before: () => page.evaluate((seed) => window.__demo?.seedRandom(seed), TOUR.gateSeed),
    })
    // the scale readout settles from MOTION to STABLE over ~1.3 s
    await moveTo(page, main(page).getByText('GROSS', { exact: true }), 20)
    await sleep(1700)
    await moveTo(page, main(page).getByText('Expected items', { exact: true }), 20)
    await sleep(1300)
    await hover(page, page.getByRole('button', { name: /Capture departure/ }))
  },

  async 'receiving-sales'(page, scene) {
    const [, sales] = scene.steps
    await goTo(page, 'Receiving')
    await sleep(700)
    await click(page, main(page).getByRole('combobox'), { settle: 250 })
    await click(page, page.getByRole('option', { name: 'Last 7 days', exact: true }), { settle: 200 })
    await page.mouse.move(W * 0.5, H * 0.45, { steps: 14 })
    await sleep(700)
    await goTo(page, 'Sales')
    await caption(page, scene, sales)
    await page.mouse.move(W * 0.5, H * 0.5, { steps: 14 })
    await sleep(600)
    await wheel(page, 320, 10)
  },

  async settlement(page, scene) {
    const [, pool] = scene.steps
    await goTo(page, 'Settlement')
    await page.mouse.move(W * 0.45, H * 0.3, { steps: 14 })
    await sleep(1100)
    await click(page, main(page).getByText(TOUR.poolSettlement, { exact: true }), { settle: 100 })
    await main(page).getByText('Grower lines', { exact: true }).waitFor({ timeout: 15000 })
    await caption(page, scene, pool)
    await moveTo(page, main(page).getByText('Net grower return', { exact: true }).first(), 22)
    await sleep(1500)
    for (const [tab, hold] of [['Sales invoices', 1100], ['Premiums & deductions', 1100], ['Advances', 900]]) {
      await click(page, page.getByRole('tab', { name: new RegExp('^' + tab) }), { settle: 150 })
      await sleep(hold)
    }
  },

  async statement(page) {
    // The dashboard restores the last-viewed period, so this is the posted week from scene 1.
    await click(page, nav(page, 'Dashboard'), { settle: 100 })
    await main(page).getByText(/^Weekly settlement run/).first().waitFor({ timeout: 20000 })
    await page.mouse.move(W * 0.4, H * 0.6, { steps: 10 })
    await wheel(page, 520, 12)
    await sleep(500)
    const rows = main(page).locator('tr').filter({ hasText: /^SET-/ })
    const wanted = rows.filter({ hasText: TOUR.statementGrower })
    const row = (await wanted.count()) > 0 ? wanted.first() : rows.first()
    await click(page, row.locator('td').nth(1), { settle: 100 })
    await main(page).getByText('SETTLE TO (GROWER)', { exact: true }).waitFor({ timeout: 20000 })
    await moveTo(page, main(page).getByText('Net grower return', { exact: true }).first(), 20)
    await sleep(1400)
    await hover(page, page.getByRole('button', { name: 'Download PDF' }))
  },

  async 'end-card'(page) {
    await page.evaluate(() => { window.__demo?.hideCaption(); window.__demo?.hideCursor() })
    await sleep(250)
    await page.evaluate(
      (o) => window.__demo?.endCard(o),
      { title: VIDEO.title, tagline: VIDEO.tagline, campus: VIDEO.strapline, rsm: rsmWhite },
    )
  },
}

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------
async function recordTour(browser) {
  console.log(`\nRecording tour from ${BASE} (${TOTAL_SECONDS}s, captions ${CAPTIONS ? 'on' : 'off'})`)
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: W, height: H } },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/Detroit',
  })
  // Read-only backstop: only GETs to the app itself get through.
  const blocked = []
  const origin = new URL(BASE).origin
  await context.route('**/*', (route) => {
    const req = route.request()
    const url = req.url()
    const local = url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')
    if (req.method() === 'GET' && local) return route.continue()
    blocked.push(`${req.method()} ${url}`)
    return route.abort()
  })
  await context.addInitScript(SLATE)
  await context.addInitScript(OVERLAY)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(BASE + '/', { waitUntil: 'load' })
  await pageTitle(page, 'Settlement dashboard').waitFor({ timeout: 30000 })
  // wait for the first KPI tile to render (data arrived), then let fonts settle
  await main(page).getByText('Product received', { exact: true }).waitFor({ timeout: 30000 })
  await page.evaluate(() => document.fonts.ready)
  await sleep(600)
  // park the cursor on the page title, clear of the charts (hovering a bar shows a tooltip)
  await page.mouse.move(W * 0.42, H * 0.2)
  await page.evaluate(() => window.__slateOff())

  const t0 = Date.now()
  const timings = []
  const problems = []
  for (const scene of SCENES) {
    const start = Date.now()
    process.stdout.write(`  ${scene.caption.padEnd(22)} ${String(scene.seconds).padStart(4)}s … `)
    await caption(page, scene, scene.steps?.[0])
    try {
      await actions[scene.id](page, scene)
    } catch (e) {
      const msg = e.message.split('\n')[0]
      console.log(`\n  ! ${scene.id}: ${msg}`)
      problems.push(`${scene.id}: action failed (${msg})`)
    }
    const used = (Date.now() - start) / 1000
    const pad = scene.seconds * 1000 - (Date.now() - start)
    if (pad < 0) {
      console.log(`ran long by ${(-pad / 1000).toFixed(1)}s`)
      problems.push(`${scene.id}: ran long by ${(-pad / 1000).toFixed(1)}s, so later cuts are late`)
    } else { await sleep(pad); console.log(`ok (${used.toFixed(1)}s of action)`) }
    timings.push({ id: scene.id, caption: scene.caption, start: +((start - t0) / 1000).toFixed(2), end: +((Date.now() - t0) / 1000).toFixed(2) })
  }

  const video = page.video()
  await context.close()
  const raw = await video.path()
  const webm = join(OUT, `${VIDEO.slug}-tour.webm`)
  if (existsSync(webm)) unlinkSync(webm)
  renameSync(raw, webm)

  const duration = timings.at(-1).end
  const leadIn = leadInSeconds(webm)
  writeFileSync(join(OUT, 'tour-timings.json'), JSON.stringify({ base: BASE, leadInSeconds: +leadIn.toFixed(2), durationSeconds: duration, scenes: timings }, null, 2))
  if (errors.length) console.log('  page errors:', errors)
  if (blocked.length) console.log('  blocked requests (not a same-origin GET):', blocked)
  console.log(`  → ${webm}`)
  toMp4(webm, join(OUT, `${VIDEO.slug}-tour.mp4`), leadIn, duration)
  if (problems.length) {
    console.log('\n  WARNING: re-record after fixing, or give the scene more seconds in scenes.mjs:')
    for (const p of problems) console.log('   - ' + p)
  }
}

async function recordInterstitial(browser) {
  const secs = VIDEO.interstitialSeconds
  console.log(`\nRecording interstitial (${secs}s)`)
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  })
  await context.addInitScript(SLATE)
  const page = await context.newPage()
  const url = pathToFileURL(join(here, 'interstitial.html')).href + `?dur=${secs}&manual=1&next=${encodeURIComponent(VIDEO.title)}`
  await page.goto(url, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await sleep(300)
  await page.evaluate(() => { window.__slateOff(); window.__startTimeline() })
  await sleep(secs * 1000 + 300)
  const video = page.video()
  await context.close()
  const webm = join(OUT, 'interstitial.webm')
  if (existsSync(webm)) unlinkSync(webm)
  renameSync(await video.path(), webm)
  console.log(`  → ${webm}`)
  toMp4(webm, join(OUT, 'interstitial.mp4'), leadInSeconds(webm), secs)
}

// ---------------------------------------------------------------------------
// MP4 conversion
// ---------------------------------------------------------------------------
function findFfmpeg() {
  const candidates = []
  if (process.env.FFMPEG) candidates.push(process.env.FFMPEG)
  candidates.push('ffmpeg')
  try {
    const py = spawnSync('python', ['-c', 'import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' })
    if (py.status === 0 && py.stdout.trim()) candidates.push(py.stdout.trim())
  } catch { /* no python */ }
  for (const c of candidates) {
    const r = spawnSync(c, ['-hide_banner', '-encoders'], { encoding: 'utf8' })
    if (r.status === 0 && /libx264/.test(r.stdout)) return c
  }
  return null
}

/**
 * Seconds of picture before scene 1: the WebM up to and including the last frame
 * that is still the magenta slate. Playwright starts the video at the first
 * painted frame rather than at newPage(), so wall-clock estimates drift by up to
 * two seconds between takes; reading the frames does not.
 */
function leadInSeconds(webm) {
  const ff = findFfmpeg()
  if (!ff) return 0
  const fps = 25
  const r = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-i', webm, '-vf', 'scale=2:2:flags=area', '-r', String(fps),
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 })
  const buf = r.stdout ?? Buffer.alloc(0)
  const frameBytes = 2 * 2 * 3
  let last = -1
  for (let i = 0; i * frameBytes + frameBytes <= buf.length; i++) {
    const o = i * frameBytes
    let magenta = true
    for (let p = 0; p < 4 && magenta; p++) {
      const R = buf[o + p * 3], G = buf[o + p * 3 + 1], B = buf[o + p * 3 + 2]
      magenta = R > 180 && G < 80 && B > 180
    }
    if (magenta) last = i
    else if (last >= 0 && i > last + fps) break
  }
  if (last < 0) console.log('  (slate not found in the recording; trimming nothing)')
  return last < 0 ? 0 : (last + 1) / fps
}

function toMp4(webm, mp4, leadIn, duration) {
  const ff = findFfmpeg()
  if (!ff) {
    console.log('  (no H.264 ffmpeg found — keeping WebM. Install imageio-ffmpeg via pip, or set $FFMPEG.)')
    return
  }
  const argv = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', leadIn.toFixed(3), '-i', webm, '-t', duration.toFixed(3),
    '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-vf', `scale=${W}:${H}:flags=lanczos`, '-movflags', '+faststart', '-an', mp4,
  ]
  const r = spawnSync(ff, argv, { encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'] })
  if (r.status === 0) console.log(`  → ${mp4}  (trimmed ${leadIn.toFixed(2)}s lead-in, ${duration}s)`)
  else console.log('  ffmpeg failed with status', r.status)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const k = a.slice(2)
    const v = argv[i + 1]
    if (v && !v.startsWith('--')) { out[k] = v; i++ } else out[k] = true
  }
  return out
}

// ---------------------------------------------------------------------------
const browser = await chromium.launch({ channel: 'chromium' })
try {
  if (ONLY === 'all' || ONLY === 'tour') await recordTour(browser)
  if (ONLY === 'all' || ONLY === 'interstitial') await recordInterstitial(browser)
} finally {
  await browser.close()
}
console.log('\nDone.')
