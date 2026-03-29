let currentToken: string | null = null;

export function setApiToken(token: string | null) {
  currentToken = token;
}

/**
 * Wrapper for fetch that automatically adds the Firebase Auth JWT token
 * to the Authorization header for requests to the backend API.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let headers = new Headers(init?.headers);
  
  // Only add the token for relative URLs (our backend API)
  if (typeof input === 'string' && input.startsWith('/')) {
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
  }

  return fetch(input, {
    ...init,
    headers
  });
}
