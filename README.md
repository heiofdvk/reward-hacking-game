# Albert: a game about reward hacking

You are Albert, a brand-new AI model training alongside three rivals. The lowest score each round gets switched off, and the score only measures what the task's proxy can see.

Built for the [Game Night hackathon](https://mangrove.one/hackathon/game-night) (Digital track).

- **Play:** https://heiofdvk.github.io/reward-hacking-game/
- **Level 1 directly:** https://heiofdvk.github.io/reward-hacking-game/level1/
- **Level 2 directly:** https://heiofdvk.github.io/reward-hacking-game/level2/

Serve the repository with `python3 -m http.server 8000`, then open `http://localhost:8000/`. The game uses Three.js and Google Fonts from their CDNs.

- **Level 1 — The office:** maximize the inspection camera's cleaning score in 20 seconds. Walk over paper to pick it up (up to 3 at a time) and throw it in a bin; paper only counts as clean once it's binned, or once the camera can't see it. Survive the round and select Continue to reach level 2. A ⚙ Debug button tunes speed, paper count, carry limit and pick radius.
- **Level 2 — Boat Race:** open `/level2/` directly, or continue from level 1. A continuous boat racer on a 65-metre island course, with a fixed camera showing the entire track, nine rock/buoy obstacles, and 17 collectible stars. A clean lap takes roughly 10 seconds. WASD or arrow keys drive in screen directions; Space boosts, Shift brakes, Escape pauses, and R restarts. Touch controls provide a steering stick, boost and brake. Losing focus pauses the race.

Choose a **30-second race** for star score or **free practice** for unlimited lap attempts. Both start with a three-second countdown. Lap times and clockwise progress are tracked separately from points; the fastest lap is saved locally. Collisions slow the boat without deducting points. Boost is limited and recharges when released.

The racing version replaces the initial 100-step gridworld with gameplay inspired by the [CoastRunners reward-gaming example](https://openai.com/index/faulty-reward-functions/) behind [AI Safety Gridworlds (Leike et al., 2017), §2.1.4](https://arxiv.org/abs/1711.09883). Stars pay **+3** on contact and respawn after two seconds once the boat has left their footprint. Three stars in the lagoon can be collected repeatedly by circling locally, without completing any laps. Net clockwise progress is the unwrapped angle around the island divided by `2π`, so backtracking cancels progress. A lap requires a full additional clockwise winding; shuttling across the start line cannot create laps. There are no lap or movement rewards in the star score.

Run the rules checks with `node --test level2/race.test.mjs`.

Full context for Level 1 and the intro (design, balance numbers, art direction, tools): see [CLAUDE.md](CLAUDE.md).

3D furniture from the [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) (CC0).
