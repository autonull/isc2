const VOCAB = new Set([
  'the',
  'be',
  'to',
  'of',
  'and',
  'a',
  'in',
  'that',
  'have',
  'I',
  'it',
  'for',
  'not',
  'on',
  'with',
  'he',
  'as',
  'you',
  'do',
  'at',
  'this',
  'but',
  'his',
  'by',
  'from',
  'they',
  'we',
  'say',
  'her',
  'she',
  'or',
  'an',
  'will',
  'my',
  'one',
  'all',
  'would',
  'there',
  'their',
  'what',
  'so',
  'up',
  'out',
  'if',
  'about',
  'who',
  'get',
  'which',
  'go',
  'me',
  'when',
  'make',
  'can',
  'like',
  'time',
  'no',
  'just',
  'him',
  'know',
  'take',
  'people',
  'into',
  'year',
  'your',
  'good',
  'some',
  'could',
  'them',
  'see',
  'other',
  'than',
  'then',
  'now',
  'look',
  'only',
  'come',
  'its',
  'over',
  'think',
  'also',
  'back',
  'after',
  'use',
  'two',
  'how',
  'our',
  'work',
  'first',
  'well',
  'way',
  'even',
  'new',
  'want',
  'because',
  'any',
  'these',
  'give',
  'day',
  'most',
  'us',
]);

const VOCAB_SIZE = 100;
const HASH_SIZE = VOCAB_SIZE / 8;

export function wordHash(text: string): Uint8Array {
  const bitmap = new Uint8Array(HASH_SIZE);
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/);

  words.forEach((word) => {
    if (VOCAB.has(word)) bitmap[Math.abs(hashString(word)) % HASH_SIZE] = 1;
  });

  return bitmap;
}

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return hash;
};

export const hammingDistance = (a: Uint8Array, b: Uint8Array): number => {
  if (a.length !== b.length) throw new Error('Arrays must be of the same length');
  return a.reduce((dist, ai, i) => dist + (ai ^ b[i]), 0) / a.length;
};
