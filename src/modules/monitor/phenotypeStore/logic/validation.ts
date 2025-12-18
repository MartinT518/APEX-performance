const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOCK_ID = 'phoenix_high_rev_01';

/**
 * Validates that a profile ID is a valid UUID
 */
export function isValidProfileId(id: string): boolean {
  return id !== MOCK_ID && UUID_REGEX.test(id);
}

/**
 * Validates profile ID and reloads if mock ID detected
 * This is a helper that can be used by store actions
 */
export async function validateProfileId(
  profileId: string,
  reloadFn?: () => Promise<void>
): Promise<void> {
  if (!isValidProfileId(profileId)) {
    if (reloadFn) {
      logger.warn('Profile has mock ID, reloading from Supabase before update');
      await reloadFn();
      // Note: Caller should re-validate after reload
    } else {
      throw new Error('Cannot update profile: Invalid profile ID. Please reload the page.');
    }
  }
}

