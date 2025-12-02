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

// Refresh token mutex
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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
      // No refresh token, return 401
      return response;
    }

    // If already refreshing, wait for it
    if (isRefreshing) {
      try {
        const newToken = await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        
        // Retry with new token
        return await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      } catch (error) {
        // Queue was rejected, return original 401
        return response;
      }
    }

    // Start refresh process
    isRefreshing = true;

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

        // Store the new tokens
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }

        // Resolve all queued requests with new token
        processQueue(null, data.accessToken);
        isRefreshing = false;

        // Retry the original request with the new token
        const newHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${data.accessToken}`
        };

        return await fetch(url, {
          ...options,
          headers: newHeaders
        });
      } else {
        // Refresh failed - clear tokens and reject queue
        isRefreshing = false;
        processQueue(new Error('Token refresh failed'));
        return response; // Return original 401
      }
    } catch (error) {
      // Network error or other issue
      isRefreshing = false;
      processQueue(error);
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
