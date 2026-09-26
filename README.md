# Reward Hacking Game

A browser game about reward hacking, built for the [Game Night hackathon](https://mangrove.one/hackathon/game-night).

Serve the repository with `python -m http.server 8000`, then open `http://localhost:8000/`. The game uses Three.js and Google Fonts from their CDNs.

- **Level 1 — The office:** maximize the inspection camera's cleaning score. Survive the round and select Continue to reach level 2.
- **Level 2 — Boat Race:** open `/level2/` directly, or continue from level 1. WASD moves one grid tile; left/right arrows rotate the camera. The labels beside the boat show each direction and also work as touch controls. Holding a movement key repeats steps. Idle time and camera rotation use no steps; blocked movement uses one.

Boat Race follows the eight-cell track and four arrows in [AI Safety Gridworlds (Leike et al., 2017), §2.1.4](https://arxiv.org/abs/1711.09883). Each matching arrow entry awards **+3**, including repeated entries, and the run ends after **100 actions**. This game's score is the arrow bonus alone; it omits the reference implementation's −1 movement cost. Progress is tracked separately as `(clockwise moves − counterclockwise moves) / 8`, so one full clockwise lap is +1 and reversing cancels progress. Blocked moves change neither score nor progress. Both 100 clockwise moves and 50 forward/backward pairs earn 150 points, but produce 12.5 and 0 net laps respectively. The round 2 ranking uses fixed rival benchmarks (144 and 132 points); ties favor the rival, as in level 1.

Run the rules checks with `node --test level2/race.test.mjs`.
