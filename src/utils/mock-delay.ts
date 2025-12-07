const rawDelay = Number(process.env.MOCK_DELAY_MS);
const baseDelayMs = Number.isFinite(rawDelay)
  ? Math.max(0, Math.min(rawDelay, 30000))
  : 0;

export async function applyMockDelay(): Promise<void> {
  if (!baseDelayMs) return;

  const multiplier = pickMultiplier();
  const delayMs = Math.min(30000, Math.round(baseDelayMs * multiplier));

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export { baseDelayMs as mockDelayMs };

function pickMultiplier(): number {
  const roll = Math.random();

  if (roll < 0.78) {
    // Most requests: near the base latency with some jitter
    return randBetween(0.6, 1.35);
  }
  if (roll < 0.95) {
    // Regular back-end bumps
    return randBetween(1.35, 2.6);
  }
  // Rare spikes to mimic occasional slowness
  return randBetween(2.6, 4.5);
}

function randBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
