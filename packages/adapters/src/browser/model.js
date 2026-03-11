export class BrowserModel {
    modelId = null;
    isLoadedFlag = false;
    async load(modelId) {
        this.modelId = modelId;
        this.isLoadedFlag = true;
    }
    async embed(text) {
        if (!this.isLoadedFlag) {
            throw new Error('Model not loaded');
        }
        // Deterministic mock embedding based on text hash
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        // Seeded random from hash
        const seed = Math.abs(hash);
        const random = () => {
            const x = Math.sin(seed * 9999) * 10000;
            return x - Math.floor(x);
        };
        const mockEmbed = new Array(384).fill(0).map((_, i) => {
            const val = random() * 2 - 1;
            return val + Math.sin(i * 0.1) * 0.3;
        });
        // Normalize to unit vector
        const norm = Math.sqrt(mockEmbed.reduce((sum, x) => sum + x * x, 0));
        return mockEmbed.map((x) => x / norm);
    }
    async unload() {
        this.isLoadedFlag = false;
        this.modelId = null;
    }
    isLoaded() {
        return this.isLoadedFlag;
    }
    getModelId() {
        return this.modelId;
    }
}
//# sourceMappingURL=model.js.map