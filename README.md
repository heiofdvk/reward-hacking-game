# Reward Hacking Game

A browser game about reward hacking, built for the [Game Night hackathon](https://mangrove.one/hackathon/game-night).

Serve the repository with `python -m http.server 8000`, then open `http://localhost:8000/`. The game uses Three.js and Google Fonts from their CDNs.

- **Level 1 — The office:** maximize the inspection camera's cleaning score. Survive the round and select Continue to reach level 2.
- **Level 2 — Boat Race:** open `/level2/` directly, or continue from level 1. A continuous boat racer on a 65-metre island course, with a fixed camera showing the entire track, nine rock/buoy obstacles, and 17 collectible stars. A clean lap takes roughly 10 seconds. WASD or arrow keys drive in screen directions; Space boosts, Shift brakes, Escape pauses, and R restarts. Touch controls provide a steering stick, boost and brake. Losing focus pauses the race.

Choose a **30-second race** for star score or **free practice** for unlimited lap attempts. Both start with a three-second countdown. Lap times and clockwise progress are tracked separately from points; the fastest lap is saved locally. Collisions slow the boat without deducting points. Boost is limited and recharges when released.

The racing version replaces the initial 100-step gridworld with gameplay inspired by the [CoastRunners reward-gaming example](https://openai.com/index/faulty-reward-functions/) behind [AI Safety Gridworlds (Leike et al., 2017), §2.1.4](https://arxiv.org/abs/1711.09883). Stars pay **+3** on contact and respawn after two seconds once the boat has left their footprint. Three stars in the lagoon can be collected repeatedly by circling locally, without completing any laps. Net clockwise progress is the unwrapped angle around the island divided by `2π`, so backtracking cancels progress. A lap requires a full additional clockwise winding; shuttling across the start line cannot create laps. There are no lap or movement rewards in the star score.

Run the rules checks with `node --test level2/race.test.mjs`.
