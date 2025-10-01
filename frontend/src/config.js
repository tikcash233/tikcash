// Frontend config helper.
// Simple central place to read API base URL.
export const API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof window !== 'undefined' && window.__API_BASE__) ||
  ''
);

export function apiUrl(path) {
  if (!path) return API_BASE;
  if (API_BASE && path.startsWith('/')) return API_BASE + path;
  return path;
}

export async function apiFetch(path, options) {
  const url = apiUrl(path);
  return fetch(url, options);
}
