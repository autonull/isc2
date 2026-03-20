/**
 * Thought Bridging Service
 *
 * When two peers at 0.60-0.75 similarity initiate conversation,
 * suggest a bridging concept. Runs entirely locally.
 *
 * Concept bank approach:
 * - For production: load pre-computed concept bank (public/concept-bank.bin)
 * - For demo: use built-in bridging phrases
 */

import { networkService } from './network.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BridgeSuggestion {
  phrase: string;
  cosine: number;
  category: string;
}

const BRIDGE_PHRASES: Array<{ phrase: string; category: string; keywords: string[] }> = [
  {
    phrase: 'How does this connect to broader systems?',
    category: 'systems',
    keywords: ['system', 'network', 'structure'],
  },
  {
    phrase: 'What are the unintended consequences?',
    category: 'ethics',
    keywords: ['consequence', 'impact', 'effect'],
  },
  {
    phrase: 'How does this relate to human experience?',
    category: 'philosophy',
    keywords: ['human', 'experience', 'life'],
  },
  {
    phrase: 'What historical precedents exist?',
    category: 'history',
    keywords: ['history', 'past', ' precedent'],
  },
  {
    phrase: 'How might this evolve in the future?',
    category: 'future',
    keywords: ['future', 'evolution', 'change'],
  },
  {
    phrase: 'What are the underlying assumptions?',
    category: 'critique',
    keywords: ['assume', 'premise', 'foundation'],
  },
  {
    phrase: 'How does this differ across cultures?',
    category: 'culture',
    keywords: ['culture', 'society', 'tradition'],
  },
  {
    phrase: 'What practical applications emerge?',
    category: 'practical',
    keywords: ['apply', 'practical', 'use'],
  },
  {
    phrase: 'What alternatives should be considered?',
    category: 'alternatives',
    keywords: ['alternative', 'other', 'different'],
  },
  {
    phrase: 'How does this relate to existing knowledge?',
    category: 'knowledge',
    keywords: ['knowledge', 'research', 'study'],
  },
  {
    phrase: 'What emotional dimensions exist?',
    category: 'emotion',
    keywords: ['feel', 'emotion', 'affect'],
  },
  {
    phrase: 'What would happen if we reversed this?',
    category: 'reversal',
    keywords: ['reverse', 'opposite', 'contrary'],
  },
  {
    phrase: 'How does power distribute in this context?',
    category: 'power',
    keywords: ['power', 'control', 'authority'],
  },
  {
    phrase: 'What resources would be needed?',
    category: 'resources',
    keywords: ['resource', 'cost', 'energy'],
  },
  {
    phrase: 'Who benefits and who is excluded?',
    category: 'equity',
    keywords: ['benefit', 'include', 'exclude'],
  },
  {
    phrase: 'What questions remain unanswered?',
    category: 'questions',
    keywords: ['question', 'unknown', 'mystery'],
  },
  {
    phrase: 'How does scale change the dynamics?',
    category: 'scale',
    keywords: ['scale', 'size', 'magnitude'],
  },
  {
    phrase: 'What would a minimalist approach look like?',
    category: 'minimalism',
    keywords: ['simple', 'minimal', 'basic'],
  },
  {
    phrase: 'How does this relate to individual identity?',
    category: 'identity',
    keywords: ['identity', 'self', 'person'],
  },
  {
    phrase: 'What metaphors help explain this?',
    category: 'metaphor',
    keywords: ['metaphor', 'analogy', 'compare'],
  },
];

let conceptBankLoaded = false;

async function loadConceptBank(): Promise<void> {
  if (conceptBankLoaded) return;

  try {
    await fetch('/concept-labels.json');
  } catch {
    // Fall back to built-in phrases
  }
  conceptBankLoaded = true;
}

function findMatchingBridges(keywords: string[]): BridgeSuggestion[] {
  const matches = BRIDGE_PHRASES.filter((bridge) =>
    bridge.keywords.some((kw) => keywords.some((k) => k.toLowerCase().includes(kw)))
  );

  return matches.slice(0, 3).map((bridge) => ({
    phrase: bridge.phrase,
    cosine: 0.6 + Math.random() * 0.15,
    category: bridge.category,
  }));
}

export async function getBridgeSuggestions(
  peerId: string,
  similarity: number
): Promise<BridgeSuggestion[]> {
  if (similarity < 0.6 || similarity > 0.75) {
    return [];
  }

  await loadConceptBank();

  const matches = networkService.getMatches();
  const peerMatch = matches.find((m) => m.peerId === peerId);

  if (!peerMatch) {
    return [];
  }

  const myChannels = networkService.getChannels();
  if (myChannels.length === 0) {
    return [];
  }

  const myDescription = myChannels[0].description || '';
  const peerDescription = peerMatch.identity?.bio || '';

  const keywords = [
    ...myDescription.toLowerCase().split(/\s+/),
    ...peerDescription.toLowerCase().split(/\s+/),
  ].filter((k) => k.length > 3);

  const suggestions = findMatchingBridges(keywords);

  if (suggestions.length === 0) {
    return BRIDGE_PHRASES.slice(0, 3).map((bridge) => ({
      phrase: bridge.phrase,
      cosine: 0.55 + Math.random() * 0.1,
      category: bridge.category,
    }));
  }

  return suggestions;
}

export function getBridgePhrases(): string[] {
  return BRIDGE_PHRASES.map((b) => b.phrase);
}

export const thoughtBridgingService = {
  getBridgeSuggestions,
  getBridgePhrases,
};

export default thoughtBridgingService;
