export const DRIVER_ROLE = 'driver';
export const PRIVILEGED_ROLES = ['admin', 'staff'];
export const AUTHENTICATED_ROLES = [...PRIVILEGED_ROLES, DRIVER_ROLE];
export const DRIVER_ALLOWED_PATHS = new Set(['/invoices', '/tracker', '/courier']);

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

export function isDriverUser(user = getStoredUser()) {
  return user?.role === DRIVER_ROLE;
}

export function getDefaultPathForUser(user = getStoredUser()) {
  return isDriverUser(user) ? '/invoices' : '/';
}
