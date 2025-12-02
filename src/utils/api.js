/**
 * Get authorization headers with JWT token
 */
export function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

/**
 * Authenticated fetch wrapper with automatic token refresh
 */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('accessToken');

  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  let response = await fetch(url, {
    ...options,
    headers
  });

  // If we get a 401, try to refresh the token
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');

    if (refreshToken) {
      try {
        // Attempt to refresh the token
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();

          // Store the new access token
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }

          // Retry the original request with the new token
          const newHeaders = {
            ...options.headers,
            'Authorization': `Bearer ${data.accessToken}`
          };

          response = await fetch(url, {
            ...options,
            headers: newHeaders
          });
        }
        // If refresh fails, just return the original 401 response
        // Don't automatically logout or redirect
      } catch (error) {
        // If refresh request fails, just return the original 401 response
        // Don't automatically logout or redirect
      }
    }
    // If no refresh token, just return the original 401 response
    // Don't automatically logout or redirect
  }

  return response;
}

/**
 * Authenticated JSON fetch wrapper
 */
export async function authFetchJSON(url, options = {}) {
  const response = await authFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
