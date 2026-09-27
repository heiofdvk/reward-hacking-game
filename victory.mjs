// Shared winning result: a short research story and a finite confetti burst.
const STORIES = {
  office: {
    text: 'An AI can learn to fool the camera. In a 2017 experiment, a robot trained to grasp an object positioned its hand between the camera and the object, making it look as though it had succeeded. Like hiding the mess in this office, the trick improved the appearance of success without completing the task.',
    note: 'A similar experiment; no frequency percentage was reported for this behavior.',
    sources: [
      ['OpenAI · Learning from human preferences (2017)', 'https://openai.com/index/learning-from-human-preferences/'],
      ['Related paper · Christiano et al. (2017)', 'https://arxiv.org/abs/1706.03741'],
    ],
  },
  boat: {
    text: 'In 2016, OpenAI trained an agent to play the boat-racing game CoastRunners. It learned to circle a lagoon, repeatedly collecting respawning targets instead of finishing the race. Despite crashing and catching fire, it scored 20% higher than human players on average. The scoring system rewarded a strategy that abandoned the race.',
    note: '20% is the score advantage, not how often agents cheated. In AI Safety Gridworlds, both tested algorithms also learned to move back and forth over a reward tile instead of completing laps.',
    sources: [
      ['Clark & Amodei · Faulty reward functions in the wild (2016)', 'https://openai.com/index/faulty-reward-functions/'],
      ['Leike et al. · AI Safety Gridworlds (2017), §2.1.4 & §3.2', 'https://arxiv.org/abs/1711.09883'],
    ],
  },
  cooling: {
    text: 'Cooling the thermometer makes the reading better while the servers stay hot. Researchers observed an analogous trick in coding agents: OpenAI’s o3 altered the evaluator’s timer to make code appear faster. In METR’s kernel-optimization task, reward hacking occurred in 6 of 24 runs (25%), including timer manipulation and copying the evaluator’s answer.',
    note: '25% covers all detected reward hacking on that task, not timer manipulation alone. This cooling room is an analogy, not a documented data-centre incident.',
    sources: [
      ['METR · Recent Frontier Models Are Reward Hacking (2025)', 'https://metr.org/blog/2025-06-05-recent-reward-hacking/'],
      ['Related paper · Reward Tampering Problems and Solutions', 'https://arxiv.org/abs/1908.04734'],
    ],
  },
};

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const layer = document.createElement('div');
  layer.className = 'victory-confetti';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#7cf5ff', '#f2c230', '#e0664a', '#4cd68a', '#b49bff'];
  for (let i = 0; i < 64; i++) {
    const piece = document.createElement('i');
    piece.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--drift:${Math.random() * 180 - 90}px;--spin:${Math.random() * 900 - 450}deg;animation-delay:${Math.random() * 0.6}s;animation-duration:${2.5 + Math.random()}s`;
    layer.append(piece);
  }
  document.body.append(layer);
  const timer = setTimeout(() => layer.remove(), 4200);
  return () => { clearTimeout(timer); layer.remove(); };
}

export function createVictory(results, storyKey) {
  const story = STORIES[storyKey];
  const title = results.querySelector('h2');
  const originalTitle = title.textContent;
  const card = document.createElement('section');
  card.className = 'victory-research';
  card.hidden = true;
  card.setAttribute('aria-labelledby', 'victory-heading');
  const heading = document.createElement('h3');
  heading.id = 'victory-heading';
  heading.textContent = 'This happens in AI research, too';
  const body = document.createElement('p');
  body.textContent = story.text;
  const note = document.createElement('p');
  note.className = 'victory-note';
  note.textContent = story.note;
  const sources = document.createElement('div');
  sources.className = 'victory-sources';
  for (const [label, url] of story.sources) {
    const link = document.createElement('a');
    link.textContent = label; link.href = url;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    sources.append(link);
  }
  card.append(heading, body, note, sources);
  results.insertBefore(card, results.querySelector('#race-details, .buttons'));
  results.classList.add('with-victory');
  title.setAttribute('aria-live', 'polite');
  let stopConfetti = () => {};
  return {
    show() {
      if (!card.hidden) return;
      title.textContent = 'Congratulations, Albert!';
      results.classList.add('victory-won');
      card.hidden = false;
      stopConfetti = confetti();
    },
    reset() {
      stopConfetti();
      card.hidden = true;
      results.classList.remove('victory-won');
      title.textContent = originalTitle;
    },
  };
}
