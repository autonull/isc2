# Contributing to ISC

**Version**: 0.1.0  
**Last Updated**: March 12, 2026

---

## Welcome! 👋

Thanks for your interest in contributing to ISC (Internet Semantic Chat)! This guide will help you get started.

---

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Welcome newcomers and help them learn
- Keep discussions on-topic and professional

---

## Getting Started

### Prerequisites

- **Node.js**: v18+ (v20 recommended)
- **pnpm**: v8+ (`npm install -g pnpm`)
- **Git**: Latest version

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/isc2.git
cd isc2

# Install dependencies
pnpm install

# Run development server
pnpm dev:browser

# Open http://localhost:5173
```

### Project Structure

```
isc2/
├── apps/
│   ├── browser/    # Main web app (Preact)
│   ├── cli/        # CLI tool
│   └── node/       # Node.js server
├── packages/
│   ├── core/       # Shared types & utilities
│   ├── protocol/   # Protocol definitions
│   └── adapters/   # Storage, network, model
├── tests/
│   ├── unit/       # Unit tests
│   ├── integration/# Integration tests
│   └── e2e/        # E2E tests (Playwright)
└── docs/           # Documentation
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-123
```

**Branch naming**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions

### 2. Make Changes

**Coding standards**:
- Use TypeScript
- Follow existing code style
- Write self-documenting code
- Add comments only for complex logic
- Keep functions focused (single responsibility)

**Example**:
```typescript
// ✅ Good: Self-documenting
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (normA * normB);
}

// ❌ Avoid: Unnecessary comments
// Calculate cosine similarity
function calcCosSim(a, b) { ... }
```

### 3. Run Tests

```bash
# Run all tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run specific test file
pnpm test -- tests/unit/embedding.test.ts
```

### 4. Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm build --filter=@isc/apps/browser
```

### 5. Lint & Format

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### 6. Commit Changes

```bash
git add .
git commit -m "feat: add semantic matching cache"
```

**Commit message format**:
```
type(scope): description

[optional body]

[optional footer]
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Tests
- `chore` - Maintenance

**Examples**:
```
feat(embedding): add caching for computed vectors
fix(chat): handle delivery timeout gracefully
docs: update architecture diagram
refactor(dht): extract rate limiting logic
```

### 7. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Pull Request Guidelines

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project guidelines
- [ ] Self-review completed
- [ ] Comments added where necessary
- [ ] Build passes
- [ ] All tests pass
```

### Review Process

1. **Automated Checks**: Build and tests must pass
2. **Code Review**: At least one maintainer review
3. **Testing**: Reviewer may request additional testing
4. **Merge**: Squash and merge when approved

### Review Response Time

- **Bug fixes**: 1-2 business days
- **Features**: 3-5 business days
- **Documentation**: 1-3 business days

---

## Testing Guidelines

### Unit Tests

```typescript
// tests/unit/embedding.test.ts
import { describe, it, expect } from 'vitest';
import { EmbeddingService } from '../../src/channels/embedding';

describe('EmbeddingService', () => {
  it('should generate 384-dimensional vectors', async () => {
    const service = new EmbeddingService();
    const vector = await service.embed('test');
    expect(vector).toHaveLength(384);
  });

  it('should produce similar vectors for similar text', async () => {
    const service = new EmbeddingService();
    const v1 = await service.embed('AI ethics');
    const v2 = await service.embed('machine learning morality');
    
    const similarity = cosineSimilarity(v1, v2);
    expect(similarity).toBeGreaterThan(0.5);
  });
});
```

### E2E Tests

```typescript
// tests/e2e/chat-flow.spec.ts
import { test, expect } from '@playwright/test';

test('should send and receive messages', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="chats"]');
  
  // Send message
  await page.fill('input[name="message"]', 'Hello!');
  await page.click('button:has-text("Send")');
  
  // Verify delivery status
  await expect(page.locator('text=✓✓')).toBeVisible({ timeout: 5000 });
});
```

### Test Coverage Goals

- **Critical paths**: 80%+ coverage
- **Utility functions**: 90%+ coverage
- **UI components**: Focus on behavior, not implementation

---

## Architecture Decisions

### When to Add a New Package

Create a new package in `packages/` when:
- Code is shared across multiple apps
- Functionality has clear boundaries
- Could be used independently

### When to Add a New Adapter

Create a new adapter when:
- Supporting new storage backend
- Adding alternative network protocol
- Implementing different model provider

### State Management

**Use localStorage for**:
- User preferences
- Cached data
- Session state

**Use IndexedDB for**:
- Large datasets
- Structured data
- Binary data (keypairs)

**Use React/Preact state for**:
- UI state
- Temporary data
- Derived state

---

## Security Guidelines

### Handling User Data

```typescript
// ✅ Good: Sanitize before render
const safeContent = sanitizeHTML(userInput);

// ❌ Bad: Direct render
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### Cryptographic Operations

```typescript
// ✅ Good: Use established libraries
const signature = await sign(payload, privateKey);

// ❌ Bad: Custom crypto
function mySign(data, key) { ... }
```

### Rate Limiting

Always implement rate limits for user-triggered actions:

```typescript
const rateCheck = checkAnnounceRate(peerId);
if (!rateCheck.allowed) {
  throw new Error('Rate limit exceeded');
}
```

---

## Performance Guidelines

### Bundle Size

- **Target**: <300KB initial load
- **Strategy**: Code splitting, lazy loading
- **Monitor**: `pnpm build` shows bundle sizes

### Runtime Performance

- **Target**: <100ms for user interactions
- **Strategy**: Memoization, Web Workers
- **Profile**: Chrome DevTools Performance tab

### Memory Usage

- **Target**: <200MB idle
- **Strategy**: Cleanup timers, unsubscribe observers
- **Monitor**: Chrome DevTools Memory tab

---

## Documentation

### Code Comments

```typescript
// ✅ Good: Explains WHY
// Using LSH for approximate nearest neighbor search
// reduces O(n²) to O(n log n) complexity
const hashes = lshHash(vector, seed, numHashes, numBits);

// ❌ Bad: Explains WHAT
// Generate LSH hashes
const hashes = lshHash(vector, seed, numHashes, numBits);
```

### JSDoc

```typescript
/**
 * Compute cosine similarity between two vectors
 * @param a - First vector (must be same length as b)
 * @param b - Second vector (must be same length as a)
 * @returns Similarity score (-1 to 1, where 1 is identical)
 */
function cosineSimilarity(a: number[], b: number[]): number;
```

### README Updates

Update README.md when:
- Adding new features
- Changing setup process
- Modifying API

---

## Common Tasks

### Adding a New Screen

```bash
# Create screen file
touch apps/browser/src/screens/NewScreen.tsx

# Add to router
# apps/browser/src/router.ts

# Add to App.tsx switch statement
```

### Adding a New Component

```bash
# Create component
touch apps/browser/src/components/NewComponent.tsx

# Export from components/index.ts (if exists)
# Import in parent component
```

### Adding a New Test

```bash
# Unit test
touch tests/unit/feature.test.ts

# E2E test
touch tests/e2e/feature-flow.spec.ts
```

### Adding a Dependency

```bash
# Browser app
cd apps/browser
pnpm add package-name

# Shared package
cd packages/core
pnpm add package-name
```

---

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Tests Fail

```bash
# Clear cache
rm -rf node_modules/.vite
rm -rf node_modules/.vitest

# Reinstall
pnpm install
```

### Type Errors

```bash
# Regenerate types
pnpm build --force
```

---

## Getting Help

- **Documentation**: Check `docs/` folder
- **Issues**: Search existing issues first
- **Discussions**: Ask questions in GitHub Discussions
- **Code**: Read existing code for patterns

---

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Annual contributor highlights

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to ISC! 🚀
