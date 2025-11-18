import toast from 'react-hot-toast';
import { playSoundForNotificationType } from './notificationSounds';

/**
 * Toast Notification Service
 * Provides consistent notification styling and behavior across the app
 * Matches Lovable.dev notification patterns with NOCTURNAL theme colors
 * Includes audio notifications for important events
 */

// Theme-aware toast styles
const getToastStyles = (isDark = true) => ({
  style: {
    background: isDark ? '#13161c' : '#ffffff',
    color: isDark ? '#e6edf3' : '#24292f',
    border: `1px solid ${isDark ? '#1f2429' : '#d0d7de'}`,
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: isDark
      ? '0 4px 12px rgba(0, 0, 0, 0.5)'
      : '0 4px 12px rgba(0, 0, 0, 0.15)',
    maxWidth: '400px',
  },
  iconTheme: {
    primary: isDark ? '#2f81f7' : '#0969da',
    secondary: isDark ? '#13161c' : '#ffffff',
  },
  duration: 4000,
  position: 'top-right',
});

// Success notification (green, auto-dismiss)
export const showSuccess = (message, options = {}) => {
  const isDark = localStorage.getItem('noc-theme') === 'dark';

  // Play sound if not explicitly disabled
  if (options.sound !== false) {
    playSoundForNotificationType('success');
  }

  return toast.success(message, {
    ...getToastStyles(isDark),
    iconTheme: {
      primary: isDark ? '#3fb950' : '#1a7f37',
      secondary: isDark ? '#13161c' : '#ffffff',
    },
    duration: options.duration || 3000,
    ...options,
  });
};

// Error notification (red, longer duration)
export const showError = (message, options = {}) => {
  const isDark = localStorage.getItem('noc-theme') === 'dark';

  // Play sound if not explicitly disabled
  if (options.sound !== false) {
    playSoundForNotificationType('error');
  }

  return toast.error(message, {
    ...getToastStyles(isDark),
    iconTheme: {
      primary: isDark ? '#f85149' : '#cf222e',
      secondary: isDark ? '#13161c' : '#ffffff',
    },
    duration: options.duration || 5000,
    ...options,
  });
};

// Warning notification (orange, auto-dismiss)
export const showWarning = (message, options = {}) => {
  const isDark = localStorage.getItem('noc-theme') === 'dark';

  // Play sound if not explicitly disabled
  if (options.sound !== false) {
    playSoundForNotificationType('warning');
  }

  return toast(message, {
    ...getToastStyles(isDark),
    icon: '⚠️',
    iconTheme: {
      primary: isDark ? '#d29922' : '#9a6700',
      secondary: isDark ? '#13161c' : '#ffffff',
    },
    duration: options.duration || 4000,
    ...options,
  });
};

// Info notification (blue, auto-dismiss)
export const showInfo = (message, options = {}) => {
  const isDark = localStorage.getItem('noc-theme') === 'dark';
  return toast(message, {
    ...getToastStyles(isDark),
    icon: 'ℹ️',
    iconTheme: {
      primary: isDark ? '#58a6ff' : '#0969da',
      secondary: isDark ? '#13161c' : '#ffffff',
    },
    duration: options.duration || 3000,
    ...options,
  });
};

// Loading notification (spinner, no auto-dismiss)
export const showLoading = (message, options = {}) => {
  const isDark = localStorage.getItem('noc-theme') === 'dark';
  return toast.loading(message, {
    ...getToastStyles(isDark),
    duration: Infinity, // Don't auto-dismiss
    ...options,
  });
};

// Promise-based notification (loading -> success/error)
export const showPromise = (promise, messages, options = {}) => {
  const isDark = localStorage.getItem('noc-theme') === 'dark';
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Loading...',
      success: messages.success || 'Success!',
      error: messages.error || 'Error occurred',
    },
    {
      ...getToastStyles(isDark),
      ...options,
    }
  );
};

// Dismiss specific toast
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

// Dismiss all toasts
export const dismissAllToasts = () => {
  toast.dismiss();
};

// Custom toast with full control
export const showCustom = (message, options = {}) => {
  const isDark = localStorage.getItem('noc-theme') === 'dark';
  return toast(message, {
    ...getToastStyles(isDark),
    ...options,
  });
};

// Site-specific notifications
export const notifySiteCreated = (siteName) => {
  playSoundForNotificationType('data-operation');
  showSuccess(`Site "${siteName}" created successfully`, { sound: false });
};

export const notifySiteUpdated = (siteName) => {
  playSoundForNotificationType('data-operation');
  showSuccess(`Site "${siteName}" updated successfully`, { sound: false });
};

export const notifySiteDeleted = (siteName) => {
  playSoundForNotificationType('data-operation');
  showSuccess(`Site "${siteName}" deleted`, { sound: false });
};

export const notifyBulkDelete = (count) => {
  playSoundForNotificationType('bulk-operation');
  showSuccess(`${count} site${count > 1 ? 's' : ''} deleted successfully`, { sound: false });
};

// Alert notifications
export const notifyAlertAcknowledged = (alertType) => {
  playSoundForNotificationType('info');
  showInfo(`${alertType} alert acknowledged`, { sound: false });
};

export const notifyNewAlert = (siteName, alertType) => {
  // Determine alert severity for sound
  const alertLower = alertType.toLowerCase();
  let soundType = 'alert';

  if (alertLower.includes('down') || alertLower.includes('offline')) {
    soundType = 'alert-critical';
  } else if (alertLower.includes('high latency')) {
    soundType = 'high-latency';
  } else if (alertLower.includes('packet loss')) {
    soundType = 'packet-loss';
  } else if (alertLower.includes('cpu')) {
    soundType = 'high-cpu';
  } else if (alertLower.includes('memory')) {
    soundType = 'high-memory';
  }

  playSoundForNotificationType(soundType);
  showWarning(`${siteName}: ${alertType}`, { duration: 6000, sound: false });
};

// Status change notifications
export const notifySiteStatusChange = (siteName, status) => {
  if (status === 'online') {
    playSoundForNotificationType('site-online');
    showSuccess(`${siteName} is now online`, { sound: false });
  } else if (status === 'offline') {
    playSoundForNotificationType('site-offline');
    showError(`${siteName} is offline`, { duration: 7000, sound: false });
  } else {
    playSoundForNotificationType('warning');
    showWarning(`${siteName} status: ${status}`, { sound: false });
  }
};

// Data operations
export const notifyDataExported = (count) => {
  playSoundForNotificationType('data-operation');
  showSuccess(`${count} site${count > 1 ? 's' : ''} exported successfully`, { sound: false });
};

export const notifyDataImported = (count) => {
  playSoundForNotificationType('data-operation');
  showSuccess(`${count} site${count > 1 ? 's' : ''} imported successfully`, { sound: false });
};

// API operations
export const notifyDeviceReboot = (deviceName) => {
  showInfo(`Rebooting ${deviceName}...`, { duration: 5000 });
};

export const notifyDeviceBlink = (deviceName) => {
  showInfo(`Blinking LEDs on ${deviceName}`, { duration: 3000 });
};

// Auth notifications
export const notifyLoginSuccess = (username) => {
  showSuccess(`Welcome back, ${username}!`);
};

export const notifyLogout = () => {
  showInfo('Logged out successfully');
};

export const notifyRegistrationSuccess = () => {
  showSuccess('Account created! Please log in.');
};

// Network/API errors
export const notifyNetworkError = () => {
  showError('Network connection failed. Please check your connection.');
};

export const notifyAPIError = (endpoint) => {
  showError(`API request failed: ${endpoint}`);
};

// Refresh notifications
export const notifyDataRefreshed = () => {
  showSuccess('Data refreshed', { duration: 2000 });
};

// Geocoding
export const notifyGeocodeSuccess = (location) => {
  showSuccess(`Location found: ${location}`);
};

export const notifyGeocodeFailed = () => {
  showWarning('Could not find location. Please check the address.');
};

// Connection test
export const notifyConnectionSuccess = () => {
  showSuccess('Backend connection successful');
};

export const notifyConnectionFailed = () => {
  showError('Backend connection failed');
};

// Cache operations
export const notifyCacheCleared = () => {
  showInfo('Cache cleared. Reloading...');
};
