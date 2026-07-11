export interface RunSeedEntropySource {
  getRandomValues<T extends ArrayBufferView<ArrayBuffer>>(values: T): T;
}

const RUN_SEED_WORD_COUNT = 4;

export function readSeedFromSearch(search: string): string | null {
  const seed = new URLSearchParams(search).get('seed')?.trim();
  return seed === undefined || seed.length === 0 ? null : seed;
}

/** 浏览器安全随机只负责产生单局种子，局内结果仍由 SeededRandom 决定。 */
export function generateRunSeed(
  entropySource: RunSeedEntropySource = globalThis.crypto,
): string {
  if (entropySource === undefined) {
    throw new Error('当前环境不支持安全随机种子生成');
  }
  const words = entropySource.getRandomValues(
    new Uint32Array(
      new ArrayBuffer(RUN_SEED_WORD_COUNT * Uint32Array.BYTES_PER_ELEMENT),
    ),
  );
  return `run-${Array.from(words, (word) =>
    word.toString(16).padStart(8, '0'),
  ).join('-')}`;
}

export function resolveInitialRunSeed(
  search: string,
  createSeed: () => string = generateRunSeed,
): string {
  return readSeedFromSearch(search) ?? createSeed();
}
