// The game's background song (level1/music.mp3, a 72 s loop), carried across every page: the intro, the boat race,
// the office, the data centre and the sandbox. Each page picks it up where the last one left off (the position is saved in
// sessionStorage when a page is left). Browsers only allow sound after a click or a key, so it starts right away
// if the browser lets it, and otherwise on the first click or key press. Mute is shared through localStorage
// ('albert-muted', the same key as the office's 🔊 button).
const SONG = new URL('./level1/music.mp3', import.meta.url).href;
export const MUSIC_POS_KEY = 'albert-music-pos', MUTE_KEY = 'albert-muted';
const VOLUME = 0.4;

let ctx = null, gain = null, loading = null, playing = null;
let muteFallback = false;

export function isMusicMuted() {
  try { muteFallback = localStorage.getItem(MUTE_KEY) === '1'; } catch {}
  return muteFallback;
}

export function setMusicMuted(m) {
  muteFallback = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch {}
  if (gain) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setValueAtTime(m ? 0 : VOLUME, ctx.currentTime); }
  for (const b of document.querySelectorAll('.music-toggle')) b.textContent = m ? '🔇' : '🔊';
  if (!m) void autoMusic();
}

export function isMusicPlaying() { return !!playing && ctx?.state === 'running'; }

export function fadeMusicOut() {
  if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
}

export function saveMusicPos() {
  if (!playing) return;
  try { sessionStorage.setItem(MUSIC_POS_KEY, String((ctx.currentTime - playing.startedAt) % playing.buf.duration)); } catch {}
}

// Starts the loop at the saved position (the audio clock stands still until the browser allows sound, so the
// position stays right), then resumes on the first click or key if it had to wait.
export function autoMusic() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      gain = ctx.createGain(); gain.gain.value = isMusicMuted() ? 0 : VOLUME; gain.connect(ctx.destination);
      // Keep these listeners: a later interaction can recover a suspended context or a failed fetch.
      for (const ev of ['pointerdown', 'keydown', 'click', 'pageshow']) addEventListener(ev, () => { void autoMusic(); }, { capture: true });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void autoMusic(); });
      addEventListener('pagehide', saveMusicPos);
    }
    // Resume synchronously inside Start/click handlers, even when the song was already loaded.
    ctx.resume().catch(() => {});
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(isMusicMuted() ? 0 : VOLUME, ctx.currentTime);
    if (playing) return Promise.resolve();
    if (loading) return loading;
    loading = fetch(SONG).then(response => {
      if (!response.ok) throw new Error('Song could not load');
      return response.arrayBuffer();
    }).then(bytes => ctx.decodeAudioData(bytes)).then(buf => {
      let from = 0;
      try {
        const saved = Number(sessionStorage.getItem(MUSIC_POS_KEY));
        if (Number.isFinite(saved) && saved >= 0) from = saved % buf.duration;
      } catch {}
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start(0, from);
      playing = { buf, startedAt: ctx.currentTime - from };
    }).catch(() => { /* Retry on Start or the next gesture; keep the game playable meanwhile. */ })
      .finally(() => { loading = null; });
    return loading;
  } catch { return Promise.resolve(); } // Audio may be unavailable; gameplay still works.
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
