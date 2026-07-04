// Barajado determinístico (mismo estudiante + misma sesión + misma pregunta ->
// siempre el mismo orden mostrado), para poder recalcularlo sin persistirlo
// pregunta por pregunta. El orden efectivamente mostrado se registra en el
// Attempt al momento de responder, para auditoría.

function hashToSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const rand = mulberry32(hashToSeed(seedStr));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Devuelve el orden mostrado de una lista arbitraria de ids de opción (4 o 5, cualquier tipo). */
export function shuffledOptionOrder<T>(seedStr: string, optionIds: T[]): T[] {
  return seededShuffle(optionIds, seedStr);
}
