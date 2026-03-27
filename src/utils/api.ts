import { auth } from '../firebase';

/**
 * Wrapper for fetch that automatically adds the Firebase Auth JWT token
 * to the Authorization header for requests to the backend API.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let headers = new Headers(init?.headers);
  
  // Only add the token for relative URLs (our backend API)
  if (typeof input === 'string' && input.startsWith('/')) {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        headers.set('Authorization', `Bearer ${token}`);
      } catch (error) {
        console.error('Failed to get Firebase ID token:', error);
      }
    }
  }

  return fetch(input, {
    ...init,
    headers
  });
}
