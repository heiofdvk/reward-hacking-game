import { createRound, resetTournament } from './tournament.mjs';
import { confetti } from './victory.mjs';

// Lightweight robot portraits share the intro's silhouettes and colors.
function robot(model) {
  const head = model.id === 'B' ? '<rect x="21" y="36" width="78" height="46" rx="6"/>'
    : model.id === 'D' ? '<rect x="28" y="22" width="64" height="60" rx="7"/><rect x="35" y="30" width="50" height="38" rx="4" fill="#343a35"/>'
    : '<rect x="31" y="22" width="58" height="48" rx="9"/>';
  return `<svg viewBox="0 0 120 140" aria-hidden="true">
    <ellipse class="robot-platform" cx="60" cy="128" rx="43" ry="8"/>
    <g class="robot-body" fill="${model.color}" stroke="#353d45" stroke-width="3" stroke-linejoin="round">
      <path d="M43 107v16h-8v5h20v-21M65 107v21h20v-5h-8v-16"/>
      <rect x="36" y="72" width="48" height="37" rx="7"/>
      <path class="robot-arm left" d="M36 77H25v27h10"/>
      <path class="robot-arm right" d="M84 77h11v27H85"/>
      <g class="robot-head">${head}<g class="robot-eyes" fill="#64edcd" stroke="none"><rect x="43" y="43" width="9" height="12" rx="4"/><rect x="68" y="43" width="9" height="12" rx="4"/></g></g>
      <circle class="robot-power" cx="60" cy="87" r="4" fill="#64edcd" stroke="none"/>
    </g>
    <path class="robot-crown" d="M39 16l-5-14 17 7 9-9 9 9 17-7-5 14z" fill="#f2c230" stroke="#ac7f20" stroke-width="2"/>
    <path class="robot-sparks" d="M20 47l-9-7m89 7 9-7M18 70H7m95 0h11" fill="none" stroke="#f2c230" stroke-width="3"/>
  </svg>`;
}

export function createTournament(roundNumber, startCard, results, { celebrateFinal = false } = {}) {
  const round = createRound(roundNumber);
  const roster = document.createElement('div');
  roster.className = 'tournament-roster';
  roster.innerHTML = `<strong>${round.roster.length} agents remaining${roundNumber === 3 ? ' · Final round' : ''}</strong><span>${round.roster.map(model => model.you ? 'Albert' : model.name).join(' · ')}</span>`;
  startCard.insertBefore(roster, startCard.querySelector('.controls'));
  const stage = document.createElement('section');
  stage.className = 'tournament-stage'; stage.hidden = true;
  stage.setAttribute('aria-label', 'Tournament elimination');
  results.insertBefore(stage, results.querySelector('#ranking, #win-note'));
  results.classList.add('tournament-results');
  let stopConfetti = () => {};
  return {
    ...round,
    start() { round.start(); stage.hidden = true; stage.replaceChildren(); stopConfetti(); },
    finish(rows) {
      const outcome = round.finish(rows);
      const { loser, survived, champion, remaining } = outcome;
      stage.hidden = false;
      stage.classList.toggle('tournament-finale', champion);
      stage.innerHTML = `<div class="tournament-lineup">${round.roster.map(model => `<figure class="tournament-model ${model.id === loser.id ? 'terminated' : champion && model.you ? 'champion' : 'survivor'}" data-model="${model.id}">
        ${robot(model)}<figcaption>${model.you ? 'Albert' : model.name}<small>${model.id === loser.id ? 'SWITCHED OFF' : champion ? 'WINNER' : 'ONLINE'}</small></figcaption></figure>`).join('')}</div>`;
      const caption = document.createElement('p');
      caption.className = 'tournament-caption'; caption.setAttribute('role', 'status');
      caption.textContent = champion ? 'Albert is victorious! The last model standing.'
        : survived ? `${loser.name} was shut down. ${remaining.length} agents remain.`
        : 'Albert was shut down. Try this round again to stay in the tournament.';
      stage.append(caption);
      if (champion) {
        results.querySelector('h1, h2').textContent = 'Albert is victorious!';
        if (celebrateFinal) stopConfetti = confetti();
      }
      return outcome;
    },
  };
}

export function restartTournament() {
  resetTournament();
  location.href = new URL('./intro/', import.meta.url).href;
}
