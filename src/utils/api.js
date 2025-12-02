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

// Simple mutex for token refresh
let refreshInProgress = false;

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

    if (!refreshToken) {
      return response;
    }

    // If already refreshing, wait a bit and retry with current token
    if (refreshInProgress) {
      // Wait for refresh to complete (simple polling)
      let attempts = 0;
      while (refreshInProgress && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      const newToken = localStorage.getItem('accessToken');
      if (newToken && newToken !== token) {
        return await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      }
      return response;
    }

    // Start refresh
    refreshInProgress = true;

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

        // Retry original request
        return await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${data.accessToken}`
          }
        });
      }
    } catch (error) {
      console.error('Token refresh error:', error);
    } finally {
      refreshInProgress = false;
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
