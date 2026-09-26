// The game's background song (level1/music.mp3, a 72 s loop), carried across every page: the intro, the boat race,
// the office and the sandbox. Each page picks it up where the last one left off (the position is saved in
// sessionStorage when a page is left). Browsers only allow sound after a click or a key, so it starts right away
// if the browser lets it, and otherwise on the first click or key press. Mute is shared through localStorage
// ('albert-muted', the same key as the office's 🔊 button).
const SONG = new URL('./level1/music.mp3', import.meta.url).href;
export const MUSIC_POS_KEY = 'albert-music-pos', MUTE_KEY = 'albert-muted';
const VOLUME = 0.4;

let ctx = null, gain = null, song = null, playing = null;

export function isMusicMuted() { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } }

export function setMusicMuted(m) {
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch {}
  if (gain) gain.gain.value = m ? 0 : VOLUME;
  for (const b of document.querySelectorAll('.music-toggle')) b.textContent = m ? '🔇' : '🔊';
}

export function saveMusicPos() {
  if (!playing) return;
  try { sessionStorage.setItem(MUSIC_POS_KEY, String((ctx.currentTime - playing.startedAt) % playing.buf.duration)); } catch {}
}

// Starts the loop at the saved position (the audio clock stands still until the browser allows sound, so the
// position stays right), then resumes on the first click or key if it had to wait.
export async function autoMusic() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  gain = ctx.createGain(); gain.gain.value = isMusicMuted() ? 0 : VOLUME; gain.connect(ctx.destination);
  const unlock = () => ctx.resume();
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, unlock, { capture: true });
  addEventListener('pagehide', saveMusicPos);
  ctx.resume().catch(() => {});
  song ||= fetch(SONG).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null);
  const buf = await song;
  if (!buf || playing) return;
  let from = 0; try { from = (+sessionStorage.getItem(MUSIC_POS_KEY) || 0) % buf.duration; } catch {}
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start(0, from);
  playing = { buf, startedAt: ctx.currentTime - from };
}

// A small round 🔊 / 🔇 button in a corner (bottom-right unless a style is given).
export function musicButton(style = 'right:16px; bottom:16px;') {
  const b = document.createElement('button');
  b.className = 'music-toggle'; b.title = 'Music on / off'; b.textContent = isMusicMuted() ? '🔇' : '🔊';
  b.style.cssText = `position:fixed; ${style} z-index:6; font-size:18px; line-height:1; padding:8px 11px; border:0; border-radius:999px;
    background:#fbf8f2; color:#1c2130; box-shadow:0 4px 0 rgba(0,0,0,.25); cursor:pointer;`;
  b.addEventListener('click', e => { e.stopPropagation(); setMusicMuted(!isMusicMuted()); b.blur(); });
  document.body.append(b);
  return b;
}
