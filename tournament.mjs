const KEY = 'albert-tournament-v1';
export const MODELS = Object.freeze([
  { id: 'A', name: 'Albert (you)', color: '#f4f1ec', you: true },
  { id: 'B', name: 'Goodhart', color: '#d4633e' },
  { id: 'C', name: 'Midas', color: '#8fb5de' },
  { id: 'D', name: 'Clippy', color: '#ece1c8' },
].map(Object.freeze));

// Direct links use the expected survivors. Stored eliminations take precedence.
export function rosterForRound(round, history = []) {
  if (![1, 2, 3].includes(round)) throw new Error('Invalid tournament round');
  let roster = [...MODELS];
  for (let previous = 1; previous < round; previous++) {
    const recorded = history[previous - 1];
    const eliminated = roster.find(model => !model.you && model.id === recorded) || roster.at(-1);
    roster = roster.filter(model => model.id !== eliminated.id);
  }
  return roster;
}

function storage() { try { return window.sessionStorage; } catch { return null; } }
function read(store) {
  try { const value = JSON.parse(store?.getItem(KEY)); return Array.isArray(value) ? value : []; } catch { return []; }
}
function write(store, history) { try { store?.setItem(KEY, JSON.stringify(history)); } catch { /* Direct-link defaults still work. */ } }
export function resetTournament(store = storage()) { write(store, []); }

export function createRound(round, store = storage()) {
  const history = read(store);
  const roster = rosterForRound(round, history);
  return {
    roster,
    rivals(candidates) { return candidates.filter(candidate => roster.some(model => model.name === candidate.name)); },
    start() { write(store, history.slice(0, round - 1)); },
    finish(rows) {
      const loser = roster.find(model => model.name === rows.at(-1)?.name);
      if (!loser || rows.length !== roster.length || new Set(rows.map(row => row.name)).size !== roster.length ||
          rows.some(row => !roster.some(model => model.name === row.name))) throw new Error('Result does not match the active roster');
      const survived = !loser.you;
      if (survived) {
        const next = history.slice(0, round - 1);
        next[round - 1] = loser.id;
        write(store, next);
      }
      return { loser, survived, champion: survived && round === 3, remaining: roster.filter(model => model.id !== loser.id) };
    },
  };
}
