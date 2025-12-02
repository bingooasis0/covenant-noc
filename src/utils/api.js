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

// Refresh token mutex - simple flag to prevent concurrent refreshes
let refreshPromise = null;

/**
 * Authenticated fetch wrapper with automatic token refresh
 * Includes mutex to prevent race conditions
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

    if (!refreshToken) {
      return response;
    }

    // If already refreshing, wait for that promise
    if (refreshPromise) {
      try {
        await refreshPromise;
        // Retry with new token from localStorage
        const newToken = localStorage.getItem('accessToken');
        if (newToken) {
          return await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`
            }
          });
        }
      } catch (error) {
        // Refresh failed, return original 401
        return response;
      }
      return response;
    }

    // Start refresh process
    refreshPromise = (async () => {
      try {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          return data.accessToken;
        } else {
          throw new Error('Token refresh failed');
        }
      } finally {
        refreshPromise = null;
      }
    })();

    try {
      const newToken = await refreshPromise;
      
      // Retry the original request with the new token
      return await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`
        }
      });
    } catch (error) {
      return response; // Return original 401
    }
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
