import type { Seller } from '../types';

// Temporary owner exception explicitly requested on 2026-09-30.
// Replace with an immutable account ID or explicit Developer assignment.
// Prefer the login username; display names must not override another username.
export const hasTemporaryCarlosDeveloperAccess = (user: Seller | null | undefined): boolean => {
  if (!user || user.isDisabled) return false;
  const identifier = (user.username || user.name || '').trim().toLowerCase();
  return identifier === 'carlos';
};
