// Menu progress, shared by every page. The menu (the site root, index.html) runs each level in a frame; a level
// calls completeStage() when the player gets through it, which saves the unlock in sessionStorage ('albert-progress', so every new visit starts locked)
// and tells the menu. A level's Continue button calls nextStage(), which asks the menu for the next level, or, when
// the page was opened on its own (outside the menu), just goes to the given address as before. Inside the menu,
// finishing a stage always goes back to the menu, where the next level waits, freshly unlocked; buttons marked
// data-to-menu say so.
export const PROGRESS_KEY = 'albert-progress';
export const STAGES = ['intro', 'level1', 'level2', 'level3', 'huggingface'];

export function loadProgress() {
  try { return JSON.parse(sessionStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
}

const inMenu = () => { try { return window.parent !== window && !!window.parent.albertMenu; } catch { return false; } };

if (inMenu()) for (const b of document.querySelectorAll('[data-to-menu]')) b.textContent = 'Back to menu ▸';

export function completeStage(id) {
  const done = loadProgress();
  done[id] = true;
  try { sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch {}
  if (inMenu()) window.parent.albertMenu.completed(id);
}

export function nextStage(id, standaloneHref) {
  if (inMenu()) window.parent.albertMenu.next(id);
  else location.href = standaloneHref;
}
