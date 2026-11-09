const attempts = new Map<string, number[]>();
const PRUNE_THRESHOLD = 10000;

export function allowRequest(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();

  if (attempts.size > PRUNE_THRESHOLD) {
    for (const [storedKey, times] of attempts) {
      if (times.every((time) => now - time >= windowMs)) attempts.delete(storedKey);
    }
  }

  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    attempts.set(key, recent);
    return false;
  }
  attempts.set(key, [...recent, now]);
  return true;
}
