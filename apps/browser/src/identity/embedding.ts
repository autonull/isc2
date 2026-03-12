import type { EmbeddingModelAdapter } from '@isc/adapters';
import { BrowserModel } from '@isc/adapters';

let model: EmbeddingModelAdapter | null = null;
let loadPromise: Promise<void> | null = null;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
let instance: BrowserModel | null = null;

export async function loadEmbeddingModel(): Promise<EmbeddingModelAdapter> {
  if (loadPromise) return model!;

  loadPromise = (async () => {
    if (!instance) instance = new BrowserModel();
    try {
      await instance.load(MODEL_ID);
      model = instance;
    } catch (err) {
      console.warn('Failed to load embedding model, will use word-hash fallback:', err);
      model = null;
      instance = null;
    }
  })();

  await loadPromise;
  return model!;
}

export function getModel(): EmbeddingModelAdapter | null {
  return model;
}

export function isModelLoaded(): boolean {
  return model?.isLoaded() ?? false;
}

export async function unloadModel(): Promise<void> {
  if (model && instance) {
    await instance.unload();
    model = null;
    instance = null;
    loadPromise = null;
  }
}
