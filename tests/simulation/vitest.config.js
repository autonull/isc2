import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/simulation/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        testTimeout: 60000,
    },
});
//# sourceMappingURL=vitest.config.js.map