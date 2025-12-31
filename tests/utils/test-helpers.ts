/**
 * Test helper utilities for assertions and test data factories
 */

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message || 'Assertion failed'}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
    );
  }
}

export function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Assertion failed: expected true');
  }
}

export function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new Error(message || 'Assertion failed: expected false');
  }
}

export function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Assertion failed: expected non-null value');
  }
}

export function assertNull(value: unknown, message?: string): void {
  if (value !== null && value !== undefined) {
    throw new Error(message || 'Assertion failed: expected null or undefined');
  }
}

export function assertContains<T>(array: T[], item: T, message?: string): void {
  if (!array.includes(item)) {
    throw new Error(message || `Assertion failed: array does not contain ${JSON.stringify(item)}`);
  }
}

export function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(message || `Assertion failed: expected ${actual} > ${expected}`);
  }
}

export function assertLessThan(actual: number, expected: number, message?: string): void {
  if (actual >= expected) {
    throw new Error(message || `Assertion failed: expected ${actual} < ${expected}`);
  }
}

export function assertGreaterThanOrEqual(actual: number, expected: number, message?: string): void {
  if (actual < expected) {
    throw new Error(message || `Assertion failed: expected ${actual} >= ${expected}`);
  }
}

export function assertLessThanOrEqual(actual: number, expected: number, message?: string): void {
  if (actual > expected) {
    throw new Error(message || `Assertion failed: expected ${actual} <= ${expected}`);
  }
}

/**
 * Wait for a condition to be true (for async testing)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}
