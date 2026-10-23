export interface GameRun {
  id: string;
  gameId: string;
  gameTitle: string;
  score: number;
  wave: number;
  duration: number;
  result: string;
  at: number;
}

export const RUNS_EVENT = 'arcade:runs';

const KEY = 'arcade.runs';
const LIMIT = 200;

export function loadRuns(): GameRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as GameRun[]) : [];
  } catch {
    return [];
  }
}

export function addRun(input: Omit<GameRun, 'id' | 'at'> & { at?: number }) {
  const run: GameRun = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: input.at ?? Date.now(),
  };
  const next = [run, ...loadRuns()].slice(0, LIMIT);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(RUNS_EVENT));
}

export function clearRuns() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(RUNS_EVENT));
}

export function summarize(runs: GameRun[]) {
  const total = runs.length;
  const best = runs.reduce((m, r) => Math.max(m, r.score), 0);
  const avgScore = total ? Math.round(runs.reduce((s, r) => s + r.score, 0) / total) : 0;
  const longest = runs.reduce((m, r) => Math.max(m, r.duration), 0);
  const totalDuration = runs.reduce((s, r) => s + r.duration, 0);
  return { total, best, avgScore, longest, totalDuration };
}

export function formatDuration(seconds: number) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
