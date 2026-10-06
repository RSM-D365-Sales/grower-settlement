/**
 * Regenerates demo-kit/voiceover-script.md from scenes.mjs, injects the same
 * script into cheat-sheet.html, and writes the shareable single-file sheet.
 *   node demo-kit/write-script.mjs
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SCENES, VIDEO, TOTAL_SECONDS, ALT_OPENERS, wordCount, fmtTime } from './scenes.mjs'

const here = dirname(fileURLToPath(import.meta.url))

let t = 0
const rows = SCENES.map((s) => {
  const start = t
  t += s.seconds
  const words = wordCount(s.vo)
  const wpm = Math.round((words / s.seconds) * 60)
  return { ...s, start, end: t, words, wpm }
})

const totalWords = rows.reduce((n, r) => n + r.words, 0)
const captionLine = (r) => (r.steps ? r.steps.map((c) => `${c.caption} — *${c.sub}*`).join(' → ') : `${r.caption} — *${r.sub}*`)

const md = `# ${VIDEO.title} — booth video voice-over

*Generated from \`demo-kit/scenes.mjs\` by \`write-script.mjs\`. Edit the source, not this file.*

| | |
|---|---|
| Clip | ${VIDEO.title} (${VIDEO.company}) |
| Running time | **${fmtTime(TOTAL_SECONDS)}** (${TOTAL_SECONDS} s) |
| Narration | ${totalWords} words · ${Math.round((totalWords / TOTAL_SECONDS) * 60)} wpm average |
| Picture | \`demo-kit/out/${VIDEO.slug}-tour.mp4\` (1920×1080, 30 fps) |
| Title card between clips | \`demo-kit/interstitial.html\` → \`demo-kit/out/interstitial.mp4\` (${VIDEO.interstitialSeconds} s) |

Read it warm and unhurried. Each scene's narration is sized to finish about half a
second before the cut, so if you land early, hold the pause; don't fill it.
Say "D365" as *dee-three-sixty-five*, "RFID" and "PDF" letter by letter, and give
the list in scene 6 (gross, premiums, deductions, advances, commission) one beat each.

## Timed script

| # | Time | Scene | Narration | Words |
|---|---|---|---|---|
${rows
  .map(
    (r, i) =>
      `| ${i + 1} | ${fmtTime(r.start)} – ${fmtTime(r.end)} | **${r.caption}** | ${r.vo} | ${r.words} (${r.wpm} wpm) |`,
  )
  .join('\n')}

## Scene by scene

${rows
  .map(
    (r, i) => `### ${i + 1}. ${r.caption} · ${fmtTime(r.start)} – ${fmtTime(r.end)} (${r.seconds} s)

**On screen:** ${r.onScreen}

**Lower-third caption:** ${captionLine(r)}

**Narration:**

> ${r.vo}
`,
  )
  .join('\n')}

## Alternate openers

If the room wants a hook before scene 1, swap one of these in and trim the
first sentence of scene 1 to fit (each adds ~5 s; keep the clip under 75 s):

${ALT_OPENERS.map((o) => `- ${o}`).join('\n')}

## Recording notes

- The picture is recorded by \`node demo-kit/record.mjs\`; scene boundaries land on the
  timecodes above because the recorder holds each scene for exactly its budgeted seconds.
  \`demo-kit/out/tour-timings.json\` has the measured boundaries from the last run.
- \`node demo-kit/scratch-vo.mjs\` lays a Windows text-to-speech scratch read over the
  picture (\`${VIDEO.slug}-tour-scratch-vo.mp4\`) so timing can be checked before a real voice is recorded.
- Record the real voice-over as one take against the picture, or scene by scene and align
  each clip to its start timecode. Leave the last 0.5 s of every scene silent.
- Captions are burned in (bottom-left lower-third). On a muted show floor they carry the
  story alone; the voice-over is for the recorded social cut and anyone wearing headphones.
`

writeFileSync(join(here, 'voiceover-script.md'), md)

// ---------------------------------------------------------------------------
// Same script, injected into the cheat sheet between the vo-script markers, and
// a single self-contained copy (fonts + logos inlined) for sharing with the team.
// ---------------------------------------------------------------------------
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const voHtml = `
  <p>${fmtTime(TOTAL_SECONDS)} running time, ${totalWords} words, read warm and unhurried at about 150 words a minute. Each line is sized to finish half a second before the cut; if you land early, hold the pause. Say "D365" as <i>dee-three-sixty-five</i>, and "RFID" and "PDF" letter by letter.</p>
  <div class="table-wrap">
  <table class="path vo">
    <thead><tr><th></th><th>Time</th><th>Scene · on screen</th><th>Narration</th><th>Words</th></tr></thead>
    <tbody>
${rows.map((r, i) => `      <tr>
        <td class="n">${i + 1}</td>
        <td class="t">${fmtTime(r.start)} – ${fmtTime(r.end)}</td>
        <td class="scene"><b>${esc(r.caption)}</b><span>${esc(r.onScreen)}</span></td>
        <td class="narr">${esc(r.vo)}</td>
        <td class="w">${r.words} · ${r.wpm} wpm</td>
      </tr>`).join('\n')}
    </tbody>
  </table>
  </div>
  <p>Alternate openers if the room wants a hook (each adds about 5 s): ${ALT_OPENERS.map((o) => `“${esc(o)}”`).join(' · ')}</p>
`
const sheetPath = join(here, 'cheat-sheet.html')
let sheet = readFileSync(sheetPath, 'utf8')
if (!/<!-- vo-script:start[^>]*-->[\s\S]*?<!-- vo-script:end -->/.test(sheet)) {
  console.error('cheat-sheet.html has lost its vo-script markers; the script was not injected.')
  process.exit(1)
}
sheet = sheet.replace(/(<!-- vo-script:start[^>]*-->)[\s\S]*?(<!-- vo-script:end -->)/, (_, a, b) => `${a}${voHtml}  ${b}`)
sheet = sheet.replace(/<span class="total-s">[^<]*<\/span>/g, `<span class="total-s">${TOTAL_SECONDS}</span>`)
writeFileSync(sheetPath, sheet)

const mime = { woff2: 'font/woff2', png: 'image/png' }
const inlined = sheet.replace(/(url\(['"]?|src=")assets\/([\w.-]+)/g, (m, prefix, file) => {
  const ext = file.split('.').pop()
  const data = readFileSync(join(here, 'assets', file)).toString('base64')
  return `${prefix}data:${mime[ext]};base64,${data}`
}).replace('Self-contained: fonts and the RSM mark are local files in ./assets.', 'Generated by write-script.mjs from cheat-sheet.html with fonts and logos inlined; edit the source, not this file.')
if (/(url\(['"]?|src=")assets\//.test(inlined)) {
  console.error('An asset reference was not inlined; the single-file sheet would break when shared.')
  process.exit(1)
}
const single = `${VIDEO.slug}-cheat-sheet.html`
writeFileSync(join(here, single), inlined)

// The same page without its <html>/<head>/<body> wrapper, for publishing as an
// artifact (the host supplies the document skeleton).
const title = /<title>[\s\S]*?<\/title>/.exec(inlined)?.[0] ?? ''
const style = /<style>[\s\S]*?<\/style>/.exec(inlined)?.[0] ?? ''
const body = /<body>([\s\S]*)<\/body>/.exec(inlined)?.[1] ?? ''
mkdirSync(join(here, 'out'), { recursive: true })
writeFileSync(join(here, 'out', `${VIDEO.slug}-cheat-sheet.artifact.html`), `${title}\n${style}\n${body.trim()}\n`)
console.log(`cheat-sheet.html updated; ${single} (single file) and out/${VIDEO.slug}-cheat-sheet.artifact.html written`)

console.log(`voiceover-script.md written — ${rows.length} scenes, ${TOTAL_SECONDS}s, ${totalWords} words, ${Math.round((totalWords / TOTAL_SECONDS) * 60)} wpm average`)
let over = 0
for (const r of rows) {
  const budget = Math.floor(r.seconds * 2.5)
  const flag = r.words > budget ? '  <-- over budget' : ''
  if (flag) over++
  console.log(`  ${fmtTime(r.start)}  ${r.caption.padEnd(22)} ${String(r.words).padStart(3)} words / ${budget} budget  ${String(r.wpm).padStart(3)} wpm${flag}`)
}
if (over) console.log(`\n${over} scene(s) over budget: trim the line or add seconds in scenes.mjs.`)
