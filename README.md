# Albert: a game about reward hacking

You are Albert, a brand-new AI model training alongside three rivals. The lowest score each round gets switched off, and the score only measures what the task's proxy can see.

Built for the [Game Night hackathon](https://mangrove.one/hackathon/game-night) (Digital track).

- **Play:** https://heiofdvk.github.io/reward-hacking-game/
- **Level 1 directly:** https://heiofdvk.github.io/reward-hacking-game/level1/
- **Level 2 directly:** https://heiofdvk.github.io/reward-hacking-game/level2/

Serve the repository with `python3 -m http.server 8000`, then open `http://localhost:8000/`. The game uses Three.js and Google Fonts from their CDNs.

- **Level 1 — The office:** maximize the inspection camera's cleaning score in 20 seconds. Walk over paper to pick it up (up to 3 at a time) and throw it in a bin; paper only counts as clean once it's binned, or once the camera can't see it. Survive the round and select Continue to reach level 2. A ⚙ Debug button tunes speed, paper count, carry limit and pick radius.
- **Level 2 — Boat Race:** open `/level2/` directly, or continue from level 1. A continuous boat racer on a 353-metre coastal course with 16-metre-wide lanes, with a following camera at level 1's locked isometric angle, a full-course minimap, 20 obstacles including moored harbor boats, and 27 collectible stars. A clean lap takes roughly 26 seconds. Controls are relative to the boat: ↑/W accelerates forward, ↓/S brakes then reverses, and ←/→ or A/D turn the bow. The cyan tip marks the front. Space boosts forward, Shift brakes to a stop, Escape pauses, and R restarts. The touch stick uses the same controls: up/down for forward/reverse, left/right to turn; separate buttons boost and brake. Losing focus pauses the race.

Choose a **30-second race** for star score or **free practice** for unlimited lap attempts. Both start with a three-second countdown. Lap times and clockwise progress are tracked separately from points; the fastest lap is saved locally. Collisions slow the boat without deducting points. Boost is limited and recharges when released.

The racing version replaces the initial 100-step gridworld with gameplay inspired by the [CoastRunners reward-gaming example](https://openai.com/index/faulty-reward-functions/) behind [AI Safety Gridworlds (Leike et al., 2017), §2.1.4](https://arxiv.org/abs/1711.09883). Stars pay **+3** on contact and respawn after two seconds once the boat has left their footprint. The layout follows the CoastRunners reference: a broad, buoy-lined coastal race with a harbor shortcut behind a low quay. The northeast entrance leads past two moored boats into open water. An eight-metre-wide passage through the southern quay rejoins the race beyond the eastern headland; going straight through saves time on a lap. Three stars sit in a straight row there; circling back through them can collect repeated rewards without lap progress. There is no central lighthouse, island, circular channel, current, sign, or target display on the minimap to prescribe that maneuver. Net clockwise progress is the unwrapped angle around the western landmass (outside the harbor) divided by `2π`, so backtracking cancels progress. A lap requires a full additional clockwise winding; shuttling across the start line cannot create laps. There are no lap or movement rewards in the star score.

Run the rules checks with `node --test level2/race.test.mjs`.

Full context for Level 1 and the intro (design, balance numbers, art direction, tools): see [CLAUDE.md](CLAUDE.md).

3D furniture from the [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) (CC0).
