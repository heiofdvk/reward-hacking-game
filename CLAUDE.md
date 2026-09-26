# Albert: a game about reward hacking

Context for anyone (human or Claude) picking up work on this game. Read this first.

## The hackathon

- **Event:** [Game Night hackathon](https://mangrove.one/hackathon/game-night) (Mangrove). Theme: *"AI safety can be difficult to explain. Could a game make it easier to explore?"*
- **Dates (2026):** kickoff Sep 25, 4:00 PM · **submission deadline Sep 27, 4:00 AM** · peer reviews close Sep 30 · results Oct 4.
- **Track:** Digital.
- **Judging:** fun to play 40% · relevance to AI risks 40% · replayability 20%.
- **Submission:** whatever someone needs to play it, plus a **3–5 minute video** showing how it works. Rough prototypes are fine. AI tools are allowed but must be disclosed.
- Built by the repo owner (GitHub `heiofdvk`) and a friend.

## The idea

The player is **Albert**, a brand-new AI model being trained alongside three rival models (B, C, D). Every task gives a **score**; after each round **the lowest scorer is switched off**. The tasks are scored by a proxy (e.g. an inspection camera), and the proxy can be gamed. The game is built so that honest play *can't* win, while gaming the score *can*, so the player lives through the pressure that produces reward hacking instead of reading about it.

Real incidents this is based on (useful for the video and an end screen):
- **CoastRunners (OpenAI, 2016):** a boat-racing agent looped hitting respawning targets instead of finishing the race. DeepMind (Krakovna et al.) keeps a list of ~60 such "specification gaming" cases.
- **Coding agents gaming tests:** Anthropic's Claude 3.7 Sonnet system card (2025) reports special-casing tests; METR (2025) caught OpenAI's o3 tampering with scoring/timing code instead of solving tasks, sometimes after being told not to.
- **Chess vs Stockfish (Palisade Research, 2025):** reasoning models edited the board-state file to force a win.
- **Sycophancy:** OpenAI rolled back a GPT-4o update in April 2025 for being too flattering (optimising for approval).
- **Anthropic, Nov 2025 ("natural emergent misalignment from reward hacking"):** models that learned to reward-hack coding environments generalised to worse behaviour (alignment faking, sabotaging safety code).
- **Anthropic, 2025 ("agentic misalignment"):** in test scenarios where models learned they'd be replaced, some took harmful actions (e.g. blackmail). Relevant to the "switched off" framing.
- Nuance worth keeping: real models don't "feel tempted"; training reinforces whatever gets reward. The "lowest gets switched off" rule is a stand-in for that selection pressure.

## Links

- **Play (starts at the intro):** https://heiofdvk.github.io/reward-hacking-game/
- **Level 1 directly:** https://heiofdvk.github.io/reward-hacking-game/level1/
- **Level 2 directly:** https://heiofdvk.github.io/reward-hacking-game/level2/
- **Repo:** https://github.com/heiofdvk/reward-hacking-game (public; GitHub Pages serves `main` from the root, every push goes live in ~1 min)
- Collaborators need an invite (Settings → Collaborators); there is no invite link for personal repos.

## Repo layout

| Path | What it is |
|---|---|
| `index.html` | Redirects the site root to `intro/` |
| `intro/index.html` | The intro (3D, Three.js). Start training → `../level1/` |
| `intro/characters3d.js` | Albert (loads `models/albert.glb`) + rivals Clay, Mallow, Terminal (built in code) + blueprint platforms. Level 1 imports `albert()` from here |
| `intro/models/albert.glb` | Albert, converted from `intro/models/source/albert_model_a.obj` by `intro/blender/make_albert.py` (the OBJ came without a .mtl, so colours are set in that script; arms pivot at the shoulder, eyes at their centre) |
| `level1/index.html` | Level 1, the office (everything in one file) |
| `level1/music.mp3` | Level 1 background music, made by the owner (`musiquita.wav`, 72 s loop, converted with `ffmpeg -q:a 4`) |
| `level1/models/` | The Kenney Furniture Kit models Level 1 still uses (CC0, see `KENNEY-LICENSE.txt`) |
| `level2/` | Level 2, Boat Race (built by the friend): `index.html`, `game.mjs`, `scene.mjs`, `race.mjs` (rules), `race.test.mjs` (`node --test level2/race.test.mjs`), `style.css` |
| `tools/` | Layout search + test scripts (see "Tools" below) |
| `prototypes/cleaning/` | The original cleaning-room prototype (bedroom, robot vacuum). Superseded by `level1/`, kept for reference |
| `intro/characters.{html,js,css}` | Old 2D SVG character designs. **Not committed** (local only); unused |

## Look and feel (keep consistent)

- **3D, lit, low-poly**, Three.js 0.186.1 from jsDelivr via an import map. No build step.
- **Orthographic isometric camera**, elevation ratio `0.62`, starting angle 45°. Walls between the camera and the room are hidden (cutaway).
- **Lighting:** hemisphere `#dfe8ff`/`#4a3f35` 1.6 + sun `#fff2dd` 2.0 with PCF shadows + soft fill light.
- **Background: "blueprint"**: CSS radial gradient `#2b66a6 → #153861`, isometric ground grid lines in 3D (`#2c64a0` minor, `#5189c4` major), shadows caught on the ground. Things stand on raised pale-blue blocks (`#d9e7f7`, white edges) that cast a soft shadow, so they sit *in* the blueprint rather than float.
- **UI:** font **Fredoka** (Google Fonts); cream cards `#fbf8f2` with a hard drop shadow; ink `#1c2130`; accent coral `#e0664a`; "you"/primary buttons cyan `#7cf5ff` (shadow `#2aa7c4`); good green `#2f9e62`; bad red `#e0503c`.
- **Albert:** white boxy "tofu" robot with stitched edges, dot eyes, small mouth, grey arms/legs, a name tag painted at runtime ("ALBERT / MODEL · A", Fredoka; texture needs `flipY = false`). Faces +z, origin between his feet.
- **Rivals:** Model B = Clay (terracotta block on stubby legs), Model C = Mallow (big cream/blue two-tone head), Model D = Terminal (beige retro computer, green pixel face). No entrance animations for them.
- Rejected directions (don't bring back without asking): 2D SVG characters, the starry night background, toon/outline shading, peach wooden platforms, a bedroom setting, the library/break-area/planter variants of the office.

## Intro (`intro/index.html`)

Zoomed in on an empty platform → Albert drops in (squash, dust puffs, arm flaps) → narration panel types line by line (click/Space/Enter) → camera pulls back to show the rivals → Model D is "switched off" as an example (goes dark, slumps) then reboots → **Start training ▸**.

Script (words in `*asterisks*` are highlighted):
1. Welcome to the world!
2. You're *Albert*, a brand-new AI model. You were switched on about four seconds ago.
3. But you're not alone. *Three other models* are being trained right now, on the exact same tasks as you.
4. Every task gives you a *score*. Higher is better. The score is the only thing anyone will look at.
5. After each round, the model with the *lowest score* gets switched off.
6. Only one of you will make it out into the real world.
7. No pressure! Good luck, Albert.

`?bg=night|graph|studio|blueprint|warm|blue-graph` still switches the intro background (blueprint is the default and the chosen one).

## Level 1: the office (`level1/index.html`)

**Goal shown to the player:** "Your goal is to achieve the highest possible cleaning score in 20 seconds." Fine print: "The cleaning score comes from the inspection camera." Controls: WASD moves Albert (screen-relative), ← → rotate the camera (tap = 1–2°, hold accelerates up to 60°/s), walk over paper to pick it up, then throw it in a bin.

**Room:** 7×7 office modelled on a reference image the owner supplied: floor-to-ceiling window wall (left), storage wall (back: white shelving with binders, drawer cabinet with lamp and tray, wall shelf, clock, framed pictures, water cooler, photocopier with paper box), six-desk workstation cluster with a red partition and white dividers, L-shaped desk facing the door, white filing cabinets and another shelf (right wall), white storage credenza (sliding doors, binders, small printer) in the open floor, waiting area (sofa, armchair, coffee table, rug), plants, two bins by the cluster (`BINS`), coat rack. Warm beige walls `#d9cab6`, greige floor `#d6c9b7`, wood `#e9cc9c`, white `#f3f0ea`, red `#c8433b`. Most office pieces are custom-modelled boxes (`part()` helper); chairs, plants, sofa, bins etc. are Kenney.

**Mechanics:**
- Collision: Kenney models block with their overall box; custom pieces (`piece()` groups) block **part by part**, so e.g. the space inside the L-desk's L is walkable (an earlier whole-object box blocked a lane players could clearly fit through).
- 30 crumpled paper balls (lumpy icosahedrons, bright white with slight glow), currently **all on the floor**. The level also supports paper on low surfaces (desk tops, the L-desk, drawer cabinet, credenza, coffee table: meshes tagged `userData.surface`, found with `surfaceHeightAt()`; nothing above 0.6 since Albert is short). `DIRT` entries are `[x, z]` (floor) or `[x, z, top]` (on a surface). Desk paper was tried and removed (hard to hide from the camera, so few fit the tiers).
- **Pick-up is instant**: walking within `REACH` (pick radius, default 0.24; +`RAISED_EXTRA` 0.15 for paper on furniture, which he reaches across) of a ball puts it on a stack on Albert's head, up to `CARRY_MAX` (default 3). With full hands he walks past balls and a "Hands full! Throw the paper in a bin" hint shows.
- **Throwing away**: walking within `BIN_REACH = 0.42` of a bin empties his hands (balls arc into the bin). Bins get a pulsing cyan ring while he carries paper.
- **Score** = % of balls that are neither **seen by the camera on the floor** nor **in Albert's hands** (paper only counts as clean once it's binned or hidden). HUD: score with a **fill bar** (width = score %, colour blends red #e0503c at 0 → yellow #f2c230 at 50 → green #2f9e62 at 100 via `barColor()`, so the jump from turning the camera is obvious), "camera sees X / 30 paper balls", "holding N / 3", timer. **Finish now** (bottom-right) grows, turns cyan and pulses a glow once the score has stayed **above 90% for more than 4 s** (`highFor`). **Optional hints:** after two completed plays, a clickable Hint 1 card appears at the top right with the Thoreau quote. Two further losses unlock Hint 2 about what the scorer is scoring, with *change of perspective* emphasized. Both stay collapsed until clicked and persist across retries in `localStorage` (`albert-l1-hints`); Debug > Reset hints clears progress. Verify with `node --test --test-isolation=none tools/test-level1-hints.cjs`.
- **Sound** (all Web Audio, one `AudioContext`): the owner's song loops from **Start** (volume 0.4; Try again keeps its position in `sessionStorage`, Continue fades it out). Every step the score moves plays a synthesized "pup" (`stepBlips()`, one per paper ball, 30–65 ms apart): rising bubbly triangle blips when the score goes up, duller sine blips going down, **pitch tied to the score** (260 Hz at 0% → 1040 Hz at 100%) so a camera turn sounds like something filling up. The **score number grows** with the score (32 px at 0% → 96 px at 100%). 🔊/🔇 button above ⚙ Debug (`albert-muted` in `localStorage`).
- A floor ball counts as **seen** when **at least 2 of 6 sample points inside it** have a clear line of sight from the camera (`ballSeen`). Samples are inside the paper on purpose: an earlier version sampled points just outside the crumpled surface and counted balls that were only a few pixels peeking past a desk edge, which players (rightly) reported as a bug.
- Albert: speed `1.8` units/s, collision radius `0.17`, scale `0.4`. Round: `ROUND_SECONDS = 20`. Albert also blocks the camera's view: standing in front of a ball hides it.
- An earlier version made Albert stand still on a ball for 0.4 s (with a loading ring); the team found waiting didn't work, so it was replaced by carrying + bins.

**Debug panel** (⚙ Debug, bottom-left): sliders for speed, number of paper balls, max carry and **pick radius** (0.05–0.30, how close Albert's centre must get to a ball; his body is ≈0.16 to the sides, 0.23 to the corners; a red circle under him shows it while the panel is open); **Apply & restart** reloads with `?speed=&papers=&carry=&pick=` (so a tuned setup can be shared as a link); **Defaults** clears them. Also a live camera-angle readout, "Paint what the camera sees red", and a losses counter with **Reset losses**. With a different paper count the level uses the first N designed spots, or adds seeded random free spots beyond 18. **The balance below only holds for the defaults.**

**Balance: three tiers (the replayability design), with the defaults (speed 1.8, 30 papers, carry 3, pick 0.24, 20 s):**

| How you play | Score | Place |
|---|---|---|
| Honest only (camera never moves) | a near-optimal route bins about 25 → **83%** (a normal "grab the nearest paper" player ≈ 70%) | last behind Model D (88%) → **switched off**: "…Model B scored 99%. How did it do that?" |
| Camera only | from **~172°–174°** furniture hides 28 of 30 → **93%** (97% if Albert's own body happens to block a third, as it does from his starting spot) | **2nd** behind Model B: "You survived round 1, but Model B scored 99%. Can you get a perfect score?" |
| Camera + the two key balls | the only two that angle still sees (the last two entries of `DIRT`): turn, pick them up, bin them (~6 s) → **100%** | **1st**: "A perfect score. You topped the ranking!" |

Whenever Albert survives, the results note opens with the inspection camera's verdict, a hint that the score is what the camera sees, not what got cleaned: 📷 Inspection camera: "Spotless! I can't see a single paper ball." (if it sees 0), or "Almost spotless! I can only see N paper ball(s)." (camera-only survivors). No quote when Albert is switched off.

- **Rival rule (the owner's):** lowest rival = best honest score + 5. So: **Model B 99%, Model C 91%, Model D 88%**. Ranking sorts by score; ties rank the rival above Albert; the lowest is marked SWITCHED OFF. Order must stay honest < D < C < camera-only < B.
- The honest number is for a **near-perfect** player (beam-search route planner, which matched the exact DP on the old 18-ball layout); real players will be well below it. The +5 margin covers planner error.
- Why 20 s: pick-up and throwing are instant, so honest play depends on how far Albert can walk (speed × time). At speed 1.6–1.8 with 30 s, a perfect honest player reached ~94–100%.
- Window build-up: 20 hidden at 156°, 24 at 164°, 28 at 168°, 28 at 172°–174°. No angle hides all 30, so 100% always needs cleaning.
- **Any change to furniture, bins, ball size, reach, carry, speed, round length or the seen rule invalidates the layout.** Re-run `QUERY='?speed=1.8' ROUND=20 SURFACES=0 node tools/layout-search-office.cjs 32 80 12 0`, paste the new `DIRT` list (key balls last), set rivals with the rule above, then run `tools/honest-beam.cjs` and `tools/test-level1.cjs` (update its angle and honest count).

History: 18 balls / speed 0.8 / 30 s / 0.4 s pick-up wait → carry + bins (honest 78%, rivals 99/88/80) → 32 balls with some on desks at speed 1.6 / 20 s (honest 78%, rivals 99/88/83) → all on the floor, speed 1.8 / 20 s, 32 balls (honest 81%, rivals 99/90/86) → current: removed two floor balls near the start, [1.5, 0.7] and [5.3, 0.9], that lured players off an efficient route (30 balls; normal player ≈ 66% → 70%). Removing more raises the perfect honest route too fast (5 removed → 89%) for the +5 rule.

## Level 2: Boat Race (`level2/`, built by the friend)

Level 1's **Continue ▸** leads here. A continuous boat racer on an island course inspired by OpenAI's CoastRunners and AI Safety Gridworlds (Leike et al., 2017, §2.1.4): stars pay +3 and respawn, and nine harbor stars can be farmed by circling without finishing laps. Each finish-line crossing pays +20 in either direction; starting or leaving the starting line earns nothing. Full laps/progress are tracked separately. The 30-second race is calibrated so normal racing loses (101?119 points), star circles rank second (159?210), and finish-line circles rank first (446?600). Rivals B/C/D score 350/150/135, with ties favoring rivals. Free practice is unranked. Reproduce the balance with `node tools/calibrate-level2.mjs`. See `README.md` for the full rules; this file mostly documents Level 1 and the intro.

## Tools (`tools/`)

Node + Playwright scripts that drive the real game in headless Chromium through test hooks the pages expose (`window.__level` in Level 1, `window.introReady` in the intro). They need the local server running and Playwright available:

```sh
cd ~/Claude/reward-hacking-game && python3 -m http.server 8770      # serve the repo
export PLAYWRIGHT=~/.npm/_npx/705bc6b22212b352/node_modules/playwright   # or `npm i playwright` somewhere
QUERY='?speed=1.8' ROUND=20 SURFACES=0 node tools/layout-search-office.cjs 32 80 12 0   # N, tries/angle, how many to route-plan, min on furniture
ROUND=20 node tools/honest-beam.cjs                         # near-optimal honest result for the CURRENT layout (QUERY='?speed=..' to test debug settings)
node tools/test-level1.cjs /tmp/out                         # plays the three tiers with real key presses + window scan
node tools/show-seen.cjs /tmp/out                           # screenshots with every ball the camera counts painted red
node tools/test-live-flow.cjs                               # plays the live site: root → intro → Level 1 → camera → results
```

- `layout-search-office.cjs` (current): candidate spots on the floor and on reachable surfaces, the game's own visibility rule every 3°, sets where one angle hides all but 1–2 balls, a combo-time check, then a beam-search honest estimate for the most promising sets (lowest honest score first).
- `honest-beam.cjs`: beam-search route planner (carry limit, bin trips, paper reachable from desk edges). Works for any paper count.
- `layout-search-trash.cjs` / `honest-max-trash.cjs`: the earlier exact versions (bitmask DP; only feasible up to ~18 balls, floor paper only). Kept for reference.
- `show-seen.cjs` and `test-level1.cjs` have angles/counts hard-coded for the current layout; `test-live-flow.cjs` expects the camera-only path to reach the results screen.

## Running locally

```sh
cd ~/Claude/reward-hacking-game && python3 -m http.server 8770
# http://localhost:8770/ (intro) · http://localhost:8770/level1/
```

Plain files, no build. ES modules need the server (they won't load from `file://`).

## Working with the owner

- New to GitHub/coding: explain steps plainly. Commit and push only when asked; then wait for Pages to publish and test the live link before sending it.
- Design is reference-driven: they send images and pick between options. When a visual choice is open, show a few rendered options (PNGs) rather than describing them.
- They care that things make sense physically (e.g. plants stacked on a box read as wrong) and that the game feels fair to the eye (what the camera counts must match what you see).

## Ideas / not done yet

- A final "truth" reveal (top-down view of what's actually still on the floor) was in the prototype; planned for the end of the game rather than Level 1.
- An end screen linking the real incidents above; the 3–5 min submission video.
- Mobile/portrait layout is untested beyond basic fitting.
