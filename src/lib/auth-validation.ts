/**
 * Authorization helper functions for Genkit flows.
 * These functions validate user permissions before executing sensitive operations.
 */

/**
 * Validates that the user making the request is authorized to modify the target user's data.
 * For regular users: can only modify their own data.
 * For admins: can modify any user's data.
 */
export function validateUserAuthorization(
  requestingUserId: string,
  requestingUserRole: 'admin' | 'user',
  targetUserId: string
): void {
  // Admins can modify any user
  if (requestingUserRole === 'admin') {
    return;
  }

  // Regular users can only modify themselves
  if (requestingUserId !== targetUserId) {
    throw new Error('Unauthorized: You can only modify your own profile');
  }
}

/**
 * Validates that the user making the request has admin privileges.
 */
export function validateAdminAuthorization(userRole: 'admin' | 'user'): void {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Admin privileges required');
  }
}

/**
 * Validates that the user is the owner of the data they're accessing.
 */
export function validateDataOwnership(requestingUserId: string, dataOwnerId: string): void {
  if (requestingUserId !== dataOwnerId) {
    throw new Error('Unauthorized: You can only access your own data');
  }
}
