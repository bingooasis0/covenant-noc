// Shared utilities for the enterprise NOC dashboard components

export const formatBytes = (bytes, precision = 1) => {
  if (bytes === null || bytes === undefined) return '-';
  const value = Number(bytes);
  if (!Number.isFinite(value)) return '-';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / Math.pow(1024, index);
  const fixed = index === 0 ? 0 : precision;
  return `${scaled.toFixed(fixed)} ${units[index]}`;
};

export const formatPercent = (value, digits = 1) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${num.toFixed(digits)}%`;
};

export const formatLatency = (value) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${Math.round(num)} ms`;
};

export const formatRelativeTime = (input) => {
  if (!input) return '-';
  const timestamp = typeof input === 'number' ? input : Date.parse(input);
  if (!Number.isFinite(timestamp)) return '-';
  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSeconds < 0) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  const days = Math.floor(diffSeconds / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

export const formatNumber = (value) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return '-';
  const totalSeconds = Math.max(0, Math.floor(Number(seconds)));
  if (!Number.isFinite(totalSeconds)) return '-';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
};

export const takeLast = (array, count) => {
  if (!Array.isArray(array) || count <= 0) return [];
  if (array.length <= count) return array.slice();
  return array.slice(array.length - count);
};

export const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const withAlpha = (hex, opacity) => {
  if (!hex || typeof hex !== 'string') {
    return `rgba(255, 255, 255, ${opacity})`;
  }
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return `rgba(255, 255, 255, ${opacity})`;
  }
  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const NOC_WINDOWS = [12, 24, 48];
export const PACKETS_PER_SAMPLE = 4;
export const LATENCY_GOOD_THRESHOLD_MS = 75;
export const LATENCY_WARN_THRESHOLD_MS = 150;

export const mergeTelemetryState = (previous = {}, incoming = {}) => {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return incoming ?? previous ?? {};
  }

  const result = { ...(previous || {}) };

  Object.entries(incoming).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0 && Array.isArray(result[key])) {
        return;
      }
      result[key] = value.slice();
      return;
    }

    if (typeof value === 'object') {
      if (Object.keys(value).length === 0) {
        return;
      }
      const previousValue = result[key];
      result[key] = mergeTelemetryState(
        typeof previousValue === 'object' && !Array.isArray(previousValue) && previousValue !== null
          ? previousValue
          : {},
        value
      );
      return;
    }

    result[key] = value;
  });

  return result;
};
