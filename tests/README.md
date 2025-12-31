# Testing Guide

## Quick Start

```bash
# Install dependencies (includes Vitest and Playwright)
npm install

# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

## Test Structure

```
tests/
├── unit/              # Unit tests (Vitest)
├── integration/      # Integration tests (Vitest)
├── e2e/              # E2E tests (Playwright)
├── fixtures/         # Test data factories
├── utils/            # Test utilities and mocks
├── setup.ts          # Global test setup
├── TEST_PLAN.md      # Test strategy document
└── REQUIREMENTS_COVERAGE.md  # Requirements → tests mapping
```

## Running Specific Tests

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Specific test file
npm test tests/unit/status-resolver.test.ts
```

## Coverage

Coverage reports are generated in the `coverage/` directory:

- **HTML Report:** `coverage/index.html` (open in browser)
- **JSON Report:** `coverage/coverage-final.json`
- **LCOV Report:** `coverage/lcov.info` (for CI/CD)

## Test Coverage Goals

- **P0 Requirements:** >80% coverage ✅
- **P1 Requirements:** >60% coverage (in progress)
- **P2 Requirements:** >40% coverage (future)

## Writing Tests

### Unit Test Example

```typescript
import { describe, test, expect } from 'vitest';
import { resolveDailyStatus } from '../../src/modules/review/logic/statusResolver';

describe('Status Resolver', () => {
  test('All GREEN votes should result in GO', () => {
    const votes = createTestVotes();
    const result = resolveDailyStatus({ votes, niggleScore: 2 });
    expect(result.global_status).toBe('GO');
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('User can login', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
});
```

## Test Data

Use factories from `tests/fixtures/factories.ts`:

```typescript
import { createTestUser, createTestWorkout, createTestVotes } from '../fixtures/factories';

const user = createTestUser();
const workout = createTestWorkout({ type: 'RUN' });
const votes = createTestVotes({ structural: 'RED' });
```

## CI/CD

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests

See `.github/workflows/test.yml` for configuration.

## Documentation

- **Test Plan:** `tests/TEST_PLAN.md`
- **Requirements Coverage:** `tests/REQUIREMENTS_COVERAGE.md`
