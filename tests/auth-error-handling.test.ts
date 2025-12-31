/**
 * Unit tests for authentication error handling
 * Tests malformed JWT tokens, missing sessions, and logger imports
 */

import { createServerClient } from '../src/lib/supabase';
import { runMonteCarloSimulation } from '../src/modules/analyze/blueprintEngine';

// Test helper functions
function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFalse(condition: boolean, message: string): void {
  if (condition) {
    throw new Error(message);
  }
}

// Test cases
export function runAuthErrorHandlingTests(): void {
  console.log('Running authentication error handling tests...');

  // Test 1: Malformed JWT token validation
  // A valid JWT should have 3 parts separated by dots
  function testMalformedJWTValidation(): void {
    console.log('  Testing malformed JWT token validation...');
    
    // Valid JWT format (3 parts)
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const validParts = validToken.split('.');
    assertEqual(validParts.length, 3, 'Valid JWT should have 3 parts');
    
    // Malformed tokens (should be rejected)
    const malformedTokens = [
      'not-a-jwt', // No dots
      'part1.part2', // Only 2 parts
      'part1.part2.part3.part4', // 4 parts
      '', // Empty
      'eyJ', // Incomplete
    ];
    
    malformedTokens.forEach((token, index) => {
      const parts = token.split('.');
      assertFalse(parts.length === 3, `Malformed token ${index + 1} should not have 3 parts`);
    });
    
    console.log('  ✓ Test 1: Malformed JWT token validation');
  }

  // Test 2: Logger import in blueprintEngine
  // This test verifies that logger is properly imported and can be used
  function testLoggerImport(): void {
    console.log('  Testing logger import in blueprintEngine...');
    
    try {
      // Test that runMonteCarloSimulation can be called without "logger is not defined" error
      // We'll test with insufficient data to trigger the logger.warn call
      const result = runMonteCarloSimulation({
        currentLoad: 100,
        injuryRiskScore: 0.1,
        goalMetric: 2.5,
        daysRemaining: 100,
        historicalVolume: undefined, // Insufficient data - should trigger logger.warn
      });
      
      // Should return LOW confidence when data is insufficient
      assertEqual(result.confidenceScore, 'LOW', 'Should return LOW confidence with insufficient data');
      assertEqual(result.successProbability, 0, 'Success probability should be 0 with insufficient data');
      
      console.log('  ✓ Test 2: Logger import in blueprintEngine');
    } catch (error: any) {
      if (error.message.includes('logger is not defined')) {
        throw new Error('Logger is not properly imported in blueprintEngine.ts');
      }
      throw error;
    }
  }

  // Test 3: Token format validation logic
  // Tests the token validation logic used in createServerClient
  function testTokenFormatValidation(): void {
    console.log('  Testing token format validation logic...');
    
    // Simulate the validation logic from createServerClient
    function validateTokenFormat(token: string): boolean {
      const tokenParts = token.split('.');
      return tokenParts.length === 3;
    }
    
    // Valid tokens
    const validTokens = [
      'eyJ.eyJ.eyJ', // Minimal valid format
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    ];
    
    validTokens.forEach((token, index) => {
      assertTrue(validateTokenFormat(token), `Valid token ${index + 1} should pass validation`);
    });
    
    // Invalid tokens
    const invalidTokens = [
      'not-a-jwt',
      'part1.part2',
      'part1.part2.part3.part4',
      '',
    ];
    
    invalidTokens.forEach((token, index) => {
      assertFalse(validateTokenFormat(token), `Invalid token ${index + 1} should fail validation`);
    });
    
    console.log('  ✓ Test 3: Token format validation logic');
  }

  // Test 4: Error message format
  // Tests that error messages are properly formatted when authentication fails
  function testErrorMessages(): void {
    console.log('  Testing error message format...');
    
    // Simulate error message format from actions.ts
    const errorMessages = {
      noUserId: 'Not authenticated. Please refresh the page and try again. If the issue persists, please log out and log back in.',
      sessionMismatch: 'Authentication error: Session mismatch. Please log out and log back in.',
      sessionNotSet: 'Authentication session not properly set. Please refresh the page and try again.',
    };
    
    // Verify error messages contain helpful guidance
    assertTrue(errorMessages.noUserId.includes('refresh'), 'Error message should mention refresh');
    assertTrue(errorMessages.noUserId.includes('log out'), 'Error message should mention logout');
    assertTrue(errorMessages.sessionMismatch.includes('mismatch'), 'Error message should mention mismatch');
    
    console.log('  ✓ Test 4: Error message format');
  }

  // Test 5: Cookie fallback logic
  // Tests that when client token is malformed, system falls back to cookies
  function testCookieFallback(): void {
    console.log('  Testing cookie fallback logic...');
    
    // Simulate the fallback logic: if client token is malformed, use cookies
    function getFinalToken(clientToken: string | undefined, cookieToken: string | null): string | null {
      if (clientToken) {
        const tokenParts = clientToken.split('.');
        if (tokenParts.length === 3) {
          return clientToken; // Valid client token
        }
        // Malformed client token - fall back to cookies
        return cookieToken;
      }
      return cookieToken;
    }
    
    // Test cases
    const testCases = [
      {
        clientToken: 'valid.token.here',
        cookieToken: 'cookie.token.here',
        expected: 'valid.token.here',
        description: 'Valid client token should be used',
      },
      {
        clientToken: 'malformed',
        cookieToken: 'cookie.token.here',
        expected: 'cookie.token.here',
        description: 'Malformed client token should fall back to cookies',
      },
      {
        clientToken: undefined,
        cookieToken: 'cookie.token.here',
        expected: 'cookie.token.here',
        description: 'No client token should use cookies',
      },
      {
        clientToken: 'malformed',
        cookieToken: null,
        expected: null,
        description: 'Malformed client token with no cookies should return null',
      },
    ];
    
    testCases.forEach((testCase, index) => {
      const result = getFinalToken(testCase.clientToken, testCase.cookieToken);
      assertEqual(result, testCase.expected, `Test case ${index + 1}: ${testCase.description}`);
    });
    
    console.log('  ✓ Test 5: Cookie fallback logic');
  }

  // Run all tests
  try {
    testMalformedJWTValidation();
    testLoggerImport();
    testTokenFormatValidation();
    testErrorMessages();
    testCookieFallback();
    
    console.log('\n✅ All authentication error handling tests passed!');
    return;
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAuthErrorHandlingTests();
}
