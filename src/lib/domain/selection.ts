import { randomInt } from "node:crypto";

export type Selectable = { id: string; categoryId: string };

export function shuffle<T>(items: readonly T[], rand: (max: number) => number = randomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks `count` questions spread as evenly as possible across categories:
 * categories are visited round-robin (in random order), each contributing a random
 * question until the target is reached or the pool is exhausted.
 */
export function selectBalanced<T extends Selectable>(
  pool: readonly T[],
  count: number,
  rand: (max: number) => number = randomInt,
): T[] {
  const byCategory = new Map<string, T[]>();
  for (const q of shuffle(pool, rand)) {
    const list = byCategory.get(q.categoryId) ?? [];
    list.push(q);
    byCategory.set(q.categoryId, list);
  }
  const queues = shuffle([...byCategory.values()], rand);
  const picked: T[] = [];
  while (picked.length < count && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      if (picked.length >= count) break;
      const next = queue.shift();
      if (next) picked.push(next);
    }
  }
  return picked;
}
