export function wordHash(text) {
    const vocab = [
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
    ];
    const lowerText = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = lowerText.split(/\s+/);
    const bitmap = new Array(vocab.length).fill(0);
    words.forEach((word) => {
        const index = vocab.indexOf(word);
        if (index !== -1) {
            bitmap[index] = 1;
        }
    });
    return new Uint8Array(bitmap);
}
export function hammingDistance(a, b) {
    if (a.length !== b.length) {
        throw new Error('Arrays must be of the same length');
    }
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        distance += a[i] ^ b[i];
    }
    return distance / a.length;
}
//# sourceMappingURL=wordHash.js.map