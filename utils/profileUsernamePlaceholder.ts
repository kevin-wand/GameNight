import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

/** Normalize email the same way as registration (trim + lowercase). */
export function normalizeAuthEmail(email: string | undefined | null): string {
  return (email ?? '').trim().toLowerCase();
}

/** True when profile username is still the initial email placeholder from signup. */
export function isPlaceholderProfileUsername(
  profileUsername: string | null | undefined,
  userEmail: string | undefined | null
): boolean {
  const u = profileUsername?.trim().toLowerCase();
  const e = normalizeAuthEmail(userEmail);
  return Boolean(u && e && u === e);
}

/** AsyncStorage key prefix; suffix with user id. Used by collection placeholder toast and auth exit to dedupe. */
export const USERNAME_PLACEHOLDER_TOAST_STORAGE_PREFIX = 'username_placeholder_toast_shown_';

export const PROFILE_TAB_HINT =
  'Edit username or profile anytime in the Profile tab.';

export type RegisterProfileExitVariant = 'saved' | 'skipped';

/**
 * Toast after Complete Profile or Edit Later. Sets the same storage key as
 * collection’s placeholder toast so the user does not get two similar nudges in a row.
 */
export async function showRegisterProfileExitToast(
  userId: string,
  variant: RegisterProfileExitVariant
): Promise<void> {
  if (variant === 'saved') {
    Toast.show({
      type: 'success',
      text1: 'Profile saved!',
      text2: PROFILE_TAB_HINT,
    });
  } else {
    Toast.show({
      type: 'info',
      text1: 'Continue later',
      text2: PROFILE_TAB_HINT,
    });
  }

  try {
    await AsyncStorage.setItem(`${USERNAME_PLACEHOLDER_TOAST_STORAGE_PREFIX}${userId}`, '1');
  } catch (e) {
    console.warn('Failed to persist profile hint toast flag:', e);
  }
}
