/**
 * Error Sanitization Utility
 * 
 * Sanitizes error messages to prevent information disclosure
 * while maintaining useful feedback for users.
 */

interface SanitizedError {
  message: string;
  code?: string;
}

/**
 * Sanitizes database errors for user-facing messages
 */
export function sanitizeDatabaseError(error: unknown): SanitizedError {
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as { code?: string; message?: string };
    
    // Map common Supabase/PostgreSQL error codes to user-friendly messages
    switch (dbError.code) {
      case 'PGRST116': // Not found
        return { message: 'Resource not found', code: dbError.code };
      case '23505': // Unique violation
        return { message: 'This record already exists', code: dbError.code };
      case '23503': // Foreign key violation
        return { message: 'Invalid reference', code: dbError.code };
      case '23502': // Not null violation
        return { message: 'Required field is missing', code: dbError.code };
      case '42501': // Insufficient privilege
        return { message: 'Access denied', code: dbError.code };
      default:
        return { message: 'Database error occurred', code: dbError.code };
    }
  }

  if (error instanceof Error) {
    // Don't expose internal error messages
    if (error.message.includes('JWT') || error.message.includes('token')) {
      return { message: 'Authentication error' };
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return { message: 'Network error. Please check your connection' };
    }
  }

  return { message: 'An error occurred. Please try again' };
}

/**
 * Sanitizes error for user-facing display
 */
export function sanitizeErrorMessage(error: unknown): string {
  const sanitized = sanitizeDatabaseError(error);
  return sanitized.message;
}

