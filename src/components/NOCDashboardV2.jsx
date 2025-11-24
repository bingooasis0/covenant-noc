import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  Filter,
  Grid,
  List,
  Map,
  AlertTriangle,
  Activity,
  Server,
  MoreVertical,
  Eye,
  RefreshCw,
  Trash2,
  Settings,
  LogOut,
  Moon,
  Sun,
  Plus,
  Bell,
  CheckCircle,
  Edit2,
  Monitor
} from 'lucide-react';
import {
  withAlpha,
  NOC_WINDOWS,
  mergeTelemetryState
} from './noc-dashboard/utils';
import { TableView, GridView, NOCView, MapView } from './noc-dashboard/views';
import { SiteDetailModal, AddEditSiteModal, SettingsModal, ConfirmModal } from './noc-dashboard/modals';
import CardEditorModal from './card-editor/CardEditorModal';
import { authFetch } from '../utils/api';
import Tooltip from './Tooltip';
import {
  showInfo,
  showError,
  notifyDataRefreshed,
  notifyNetworkError,
  notifyBulkDelete,
  notifyNewAlert,
  notifySiteStatusChange,
  notifyAlertAcknowledged
} from '../services/toast';

import { io } from 'socket.io-client';

const FILTER_COOKIE_KEY = 'noc-filters';
const FILTER_LOCAL_STORAGE_KEY = 'noc-filters';
const FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const REFRESH_COOKIE_KEY = 'noc-refresh-interval';
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const getCookieValue = (key) => {
  if (typeof document === 'undefined') {
    return null;
  }
  const pattern = new RegExp(`(?:^|; )${key}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
};

const setCookieValue = (key, value, maxAgeSeconds) => {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}`;
};

const DEFAULT_FILTERS = {
  searchTerm: '',
  customer: 'all',
  status: 'all',
  monitoring: 'all',
  alert: 'all',
  groupBy: 'none'
};

const STATUS_FILTER_OPTIONS = new Set(['all', 'Operational', 'Degraded', 'Critical']);
const MONITORING_FILTER_OPTIONS = new Set(['all', 'icmp', 'snmp', 'api']);
const ALERT_FILTER_OPTIONS = new Set(['all', 'critical', 'warning', 'none']);
const GROUP_BY_OPTIONS = new Set(['none', 'customer', 'status', 'location']);

const sanitizeFilterPreferences = (raw = {}) => {
  const safe = { ...DEFAULT_FILTERS };

  if (typeof raw.searchTerm === 'string') {
    safe.searchTerm = raw.searchTerm;
  }

  if (typeof raw.customer === 'string' && raw.customer.trim().length > 0) {
    safe.customer = raw.customer;
  }

  if (typeof raw.status === 'string' && STATUS_FILTER_OPTIONS.has(raw.status)) {
    safe.status = raw.status;
  }

  if (typeof raw.monitoring === 'string' && MONITORING_FILTER_OPTIONS.has(raw.monitoring)) {
    safe.monitoring = raw.monitoring;
  }

  if (typeof raw.alert === 'string' && ALERT_FILTER_OPTIONS.has(raw.alert)) {
    safe.alert = raw.alert;
  }

  if (typeof raw.groupBy === 'string' && GROUP_BY_OPTIONS.has(raw.groupBy)) {
    safe.groupBy = raw.groupBy;
  }

  return safe;
};

const loadFilterPreferences = () => {
  try {
    const cookieValue = getCookieValue(FILTER_COOKIE_KEY);
    let stored = cookieValue;
    if (!stored && typeof window !== 'undefined' && window.localStorage) {
      stored = window.localStorage.getItem(FILTER_LOCAL_STORAGE_KEY);
    }
    if (stored) {
      const parsed = JSON.parse(stored);
      return sanitizeFilterPreferences(parsed);
    }
  } catch {
    // ignore parsing/storage errors
  }
  return { ...DEFAULT_FILTERS };
};

const persistFilterPreferences = (filters) => {
  try {
    const serialized = JSON.stringify(filters);
    setCookieValue(FILTER_COOKIE_KEY, serialized, FILTER_COOKIE_MAX_AGE);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FILTER_LOCAL_STORAGE_KEY, serialized);
    }
  } catch {
    // ignore persistence errors
  }
};

const getStoredRefreshInterval = () => {
  const cookieValue = Number(getCookieValue(REFRESH_COOKIE_KEY));
  if (Number.isFinite(cookieValue) && cookieValue >= 1) {
    return Math.floor(cookieValue);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = Number(window.localStorage.getItem('noc-refresh-interval'));
    if (Number.isFinite(stored) && stored >= 1) {
      return Math.floor(stored);
    }
  }
  return 10;
};

// Enterprise NOC Dashboard - Designed for 100s of sites
const NOCDashboardV2 = ({ user, onLogout, onShowCardShowcase, onShowAuditLog }) => {
  const navigate = useNavigate();

  // Theme
  const [isDark, setIsDark] = useState(() => localStorage.getItem('noc-theme') === 'dark');

  // View state
  const [viewMode, setViewMode] = useState('grid'); // table, grid, map - default to grid
  const [isFocusMode, setIsFocusMode] = useState(false); // Full screen focus mode
  const [sites, setSites] = useState([]);
  const [metricsData, setMetricsData] = useState({});
  const [snmpData, setSnmpData] = useState({});
  const [apiData, setApiData] = useState({});
  const [metricsHistory, setMetricsHistory] = useState({});
  const [extendedHistory, setExtendedHistory] = useState({});
  const extendedHistoryRef = useRef({});
  const extendedHistoryInFlight = useRef({});
  const [refreshInterval, setRefreshInterval] = useState(() => getStoredRefreshInterval());

  const updateRefreshInterval = useCallback((seconds) => {
    const sanitized = Math.max(1, Math.floor(Number(seconds) || 0));
    setRefreshInterval(sanitized);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('noc-refresh-interval', String(sanitized));
    }
    setCookieValue(REFRESH_COOKIE_KEY, String(sanitized), REFRESH_COOKIE_MAX_AGE);
  }, []);

  const [loadingState, setLoadingState] = useState({
    sites: false,
    metrics: {},
    snmp: {},
    api: {},
    history: {},
    extendedHistory: {}
  });

  const setLoadingFlag = useCallback((category, key, value) => {
    setLoadingState(prev => {
      if (key === undefined) {
        if (prev[category] === value) {
          return prev;
        }
        return { ...prev, [category]: value };
      }
      const categoryState = prev[category] || {};
      if (categoryState[key] === value) {
        return prev;
      }
      return {
        ...prev,
        [category]: {
          ...categoryState,
          [key]: value
        }
      };
    });
  }, []);

  const setExtendedHistoryEntry = useCallback((siteId, hours, record) => {
    extendedHistoryRef.current = {
      ...extendedHistoryRef.current,
      [siteId]: {
        ...(extendedHistoryRef.current[siteId] || {}),
        [hours]: record,
      },
    };
    setExtendedHistory(prev => ({
      ...prev,
      [siteId]: {
        ...(prev[siteId] || {}),
        [hours]: record,
      },
    }));
  }, []);

  const loadExtendedHistory = useCallback(async (siteId, hours) => {
    const loadingKey = `${siteId}:${hours}`;
    setLoadingFlag('extendedHistory', loadingKey, true);
    try {
      const res = await authFetch(`/api/monitoring/${siteId}/history?hours=${hours}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const history = Array.isArray(data)
        ? data.map(point => {
          const packetLoss = point.packetLoss !== null && point.packetLoss !== undefined ? Number(point.packetLoss) : null;
          return {
            timestamp: point.timestamp,
            latency: point.latency !== null && point.latency !== undefined ? Number(point.latency) : null,
            packetLoss: packetLoss,
            jitter: point.jitter !== null && point.jitter !== undefined ? Number(point.jitter) : null,
            // Derive isReachable from packetLoss (100% = down/not reachable)
            isReachable: packetLoss !== null ? packetLoss < 100 : undefined
          };
        })
        : [];

      setExtendedHistoryEntry(siteId, hours, {
        data: history,
        fetchedAt: Date.now()
      });
    } catch (err) {
      console.error(`Failed to load extended history for site ${siteId} (${hours}h):`, err);
      setExtendedHistoryEntry(siteId, hours, {
        data: [],
        fetchedAt: Date.now(),
        error: err.message || 'Failed to load history'
      });
    } finally {
      setLoadingFlag('extendedHistory', loadingKey, false);
      if (extendedHistoryInFlight.current[siteId]) {
        delete extendedHistoryInFlight.current[siteId][hours];
        if (Object.keys(extendedHistoryInFlight.current[siteId]).length === 0) {
          delete extendedHistoryInFlight.current[siteId];
        }
      }
    }
  }, [setExtendedHistoryEntry, setLoadingFlag]);

  const ensureExtendedHistory = useCallback((siteId, hours, { force = false } = {}) => {
    const siteCache = extendedHistoryRef.current[siteId];
    const existing = siteCache ? siteCache[hours] : undefined;
    const staleMs = Math.max(5000, refreshInterval * 1000);
    const isStale = force ||
      !existing ||
      !existing.fetchedAt ||
      (Date.now() - existing.fetchedAt) > staleMs;

    if (!isStale) {
      return;
    }

    if (!extendedHistoryInFlight.current[siteId]) {
      extendedHistoryInFlight.current[siteId] = {};
    }
    if (extendedHistoryInFlight.current[siteId][hours]) {
      return;
    }

    extendedHistoryInFlight.current[siteId][hours] = true;
    loadExtendedHistory(siteId, hours);
  }, [loadExtendedHistory, refreshInterval]);

  // Filters
  const storedFilters = useMemo(() => loadFilterPreferences(), []);
  const [searchTerm, setSearchTerm] = useState(() => storedFilters.searchTerm);
  const [customerFilter, setCustomerFilter] = useState(() => storedFilters.customer);
  const [statusFilter, setStatusFilter] = useState(() => storedFilters.status);
  const [monitoringTypeFilter, setMonitoringTypeFilter] = useState(() => storedFilters.monitoring);
  const [alertFilter, setAlertFilter] = useState(() => storedFilters.alert);
  const [groupBy, setGroupBy] = useState(() => storedFilters.groupBy); // none, customer, status, location

  useEffect(() => {
    persistFilterPreferences({
      searchTerm,
      customer: customerFilter,
      status: statusFilter,
      monitoring: monitoringTypeFilter,
      alert: alertFilter,
      groupBy
    });
  }, [searchTerm, customerFilter, statusFilter, monitoringTypeFilter, alertFilter, groupBy]);

  // UI State
  const [selectedSites, setSelectedSites] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedSite, setSelectedSite] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [cardMenuOpen, setCardMenuOpen] = useState(null); // Track which card menu is open
  const [cardActiveTabs, setCardActiveTabs] = useState({});
  const [cardLatencyWindows, setCardLatencyWindows] = useState({});

  // Modals
  const [showAddSite, setShowAddSite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [cardLayout, setCardLayout] = useState(null); // NOC view layout
  const [gridCardLayouts, setGridCardLayouts] = useState({}); // Grid view layouts: { siteId: layout } or { 'global': layout }

  // Load card configurations for both NOC and Grid views
  useEffect(() => {
    const loadCardConfigs = async () => {
      try {
        // Load NOC view global config
        const nocRes = await authFetch('/api/card-config?viewType=noc&scope=global');
        if (nocRes.ok) {
          const nocData = await nocRes.json();
          if (nocData && nocData.layout) {
            // Support both old format (just layout array) and new format (object with layout and cardConfig)
            const layoutData = Array.isArray(nocData.layout)
              ? { layout: nocData.layout, cardConfig: nocData.cardConfig || {} }
              : nocData.layout;
            setCardLayout(layoutData);
          }
        }

        // Load Grid view global config
        const gridGlobalRes = await authFetch('/api/card-config?viewType=grid&scope=global');
        if (gridGlobalRes.ok) {
          const gridGlobalData = await gridGlobalRes.json();
          if (gridGlobalData && gridGlobalData.layout) {
            // Support both old format (just layout array) and new format (object with layout and cardConfig)
            const layoutData = Array.isArray(gridGlobalData.layout) 
              ? { layout: gridGlobalData.layout, cardConfig: gridGlobalData.cardConfig || {} }
              : gridGlobalData.layout;
            setGridCardLayouts(prev => ({ ...prev, 'global': layoutData }));
          }
        }

        // Load Grid view site-specific configs for all sites
        if (sites && sites.length > 0) {
          const siteLayouts = {};
          await Promise.all(sites.map(async (site) => {
            try {
              const url = `/api/card-config?viewType=grid&scope=site&targetId=${site.id}`;
              // console.log(`Fetching config for ${site.name}:`, url);
              const siteRes = await authFetch(url);
              if (siteRes.ok) {
                const siteData = await siteRes.json();
                console.log(`[Load] Config for ${site.name}:`, siteData);
                if (siteData && siteData.layout) {
                  // Support both old format (just layout array) and new format (object with layout and cardConfig)
                  const layoutData = Array.isArray(siteData.layout)
                    ? { layout: siteData.layout, cardConfig: siteData.cardConfig || {} }
                    : siteData.layout;
                  console.log(`[Load] Parsed layout for ${site.name}:`, layoutData);
                  siteLayouts[site.id] = layoutData;
                } else {
                  console.log(`[Load] No layout found for ${site.name}, response:`, siteData);
                }
              } else {
                console.log(`[Load] Failed to fetch config for ${site.name}, status:`, siteRes.status);
              }
            } catch (err) {
              // Ignore individual site errors
              console.error(`Error fetching config for ${site.id}:`, err);
            }
          }));
          // console.log('Site layouts loaded:', Object.keys(siteLayouts));
          if (Object.keys(siteLayouts).length > 0) {
            setGridCardLayouts(prev => ({ ...prev, ...siteLayouts }));
          }
        }
      } catch (err) {
        console.error('Failed to load card configs:', err);
      }
    };
    if (user) {
      loadCardConfigs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sites.length]);

  const handleCardConfigSave = () => {
    // Reload all configs after save
    const loadCardConfigs = async () => {
      try {
        // Reload NOC view global config
        const nocRes = await authFetch('/api/card-config?viewType=noc&scope=global');
        if (nocRes.ok) {
          const nocData = await nocRes.json();
          if (nocData && nocData.layout) {
            const layoutData = Array.isArray(nocData.layout)
              ? { layout: nocData.layout, cardConfig: nocData.cardConfig || {} }
              : nocData.layout;
            setCardLayout(layoutData);
          }
        }

        // Reload Grid view global config
        const gridGlobalRes = await authFetch('/api/card-config?viewType=grid&scope=global');
        if (gridGlobalRes.ok) {
          const gridGlobalData = await gridGlobalRes.json();
          if (gridGlobalData && gridGlobalData.layout) {
            const layoutData = Array.isArray(gridGlobalData.layout)
              ? { layout: gridGlobalData.layout, cardConfig: gridGlobalData.cardConfig || {} }
              : gridGlobalData.layout;
            setGridCardLayouts(prev => ({
              ...prev,
              'global': layoutData
            }));
          }
        }

        // Reload Grid view site-specific configs
        if (sites && sites.length > 0) {
          const siteLayouts = {};
          await Promise.all(sites.map(async (site) => {
            try {
              const siteRes = await authFetch(`/api/card-config?viewType=grid&scope=site&targetId=${site.id}`);
              if (siteRes.ok) {
                const siteData = await siteRes.json();
                console.log(`[Reload] Config for ${site.name}:`, siteData);
                if (siteData && siteData.layout) {
                  // Support both old format (just layout array) and new format (object with layout and cardConfig)
                  const layoutData = Array.isArray(siteData.layout)
                    ? { layout: siteData.layout, cardConfig: siteData.cardConfig || {} }
                    : siteData.layout;
                  console.log(`[Reload] Parsed layout for ${site.name}:`, layoutData);
                  siteLayouts[site.id] = layoutData;
                } else {
                  console.log(`[Reload] No layout found for ${site.name}, response:`, siteData);
                }
              } else {
                console.log(`[Reload] Failed to fetch config for ${site.name}, status:`, siteRes.status);
              }
            } catch (err) {
              console.error(`[Reload] Error fetching config for ${site.id}:`, err);
            }
          }));
          console.log('[Reload] Site layouts loaded:', Object.keys(siteLayouts));
          if (Object.keys(siteLayouts).length > 0) {
            setGridCardLayouts(prev => {
              const updated = { ...prev, ...siteLayouts };
              console.log('[Reload] Updated gridCardLayouts:', Object.keys(updated));
              return updated;
            });
          }
        }

        notifyDataRefreshed('Card layout updated');
      } catch (err) {
        console.error('Failed to reload card configs:', err);
      }
    };
    loadCardConfigs();
  };

  // Alerts
  const [alerts, setAlerts] = useState([]);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState(new Set());
  const [notifiedAlerts, setNotifiedAlerts] = useState(new Set()); // Track which alerts we've shown notifications for
  const previousSiteStatuses = useRef({}); // Track previous site statuses for change detection

  // Theme colors - Professional NOC palette
  const theme = isDark ? {
    bg: '#0a0e14',
    bgSecondary: '#101419',
    card: '#13161c',
    cardHover: '#1a1f26',
    border: '#1f2429',
    borderLight: '#2d3339',
    text: '#e6edf3',
    textSecondary: '#8b949e',
    textMuted: '#6e7681',
    primary: '#2f81f7',
    primaryHover: '#3d8bfd',
    success: '#3fb950',
    successBg: '#0d3819',
    warning: '#d29922',
    warningBg: '#332700',
    danger: '#f85149',
    dangerBg: '#330b0b',
    info: '#58a6ff',
    infoBg: '#0c2d6b',
    shadow: 'rgba(0,0,0,0.3)',
  } : {
    bg: '#f6f8fa',
    bgSecondary: '#ffffff',
    card: '#ffffff',
    cardHover: '#f3f4f6',
    border: '#d0d7de',
    borderLight: '#e5e7eb',
    text: '#24292f',
    textSecondary: '#57606a',
    textMuted: '#6e7681',
    primary: '#0969da',
    primaryHover: '#0860ca',
    success: '#1a7f37',
    successBg: '#dafbe1',
    warning: '#9a6700',
    warningBg: '#fff8c5',
    danger: '#cf222e',
    dangerBg: '#ffebe9',
    info: '#0969da',
    infoBg: '#ddf4ff',
    shadow: 'rgba(0,0,0,0.1)',
  };

  // Apply ultra-slim scrollbar styling (or hide entirely) to satisfy no-scrollbar requirement
  useEffect(() => {
    const styleId = 'noc-scrollbar-style';
    const ensureStyleElement = () => {
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      return styleEl;
    };

    const trackColor = withAlpha(theme.bgSecondary, 0.03);
    const thumbColor = withAlpha(theme.textMuted, isDark ? 0.12 : 0.18);
    const thumbHover = withAlpha(theme.textMuted, isDark ? 0.2 : 0.26);

    const styleEl = ensureStyleElement();
    styleEl.textContent = `
      :root {
        --noc-scrollbar-size: 3px;
        --noc-scrollbar-thumb: ${thumbColor};
        --noc-scrollbar-thumb-hover: ${thumbHover};
        --noc-scrollbar-track: ${trackColor};
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--noc-scrollbar-thumb) transparent;
      }
      *::-webkit-scrollbar {
        width: var(--noc-scrollbar-size);
        height: var(--noc-scrollbar-size);
      }
      *::-webkit-scrollbar-track {
        background: transparent;
      }
      *::-webkit-scrollbar-thumb {
        background-color: var(--noc-scrollbar-thumb);
        border-radius: 999px;
        border: 1px solid transparent;
      }
      *::-webkit-scrollbar-thumb:hover {
        background-color: var(--noc-scrollbar-thumb-hover);
      }
      body {
        scrollbar-gutter: stable both-edges;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;

    return () => {
      const existing = document.getElementById(styleId);
      if (existing) {
        existing.parentNode?.removeChild(existing);
      }
    };
  }, [theme, isDark]);

  // Save theme
  useEffect(() => {
    localStorage.setItem('noc-theme', isDark ? 'dark' : 'light');
    document.body.style.background = theme.bg;
  }, [isDark, theme.bg]);

  // Close card menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (cardMenuOpen) {
        setCardMenuOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [cardMenuOpen]);

  // Handle Escape key to exit Focus Mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  // Initialize Socket.io for real-time updates
  useEffect(() => {
    const socket = io();

    socket.on('connect', () => {
      // console.log('Connected to real-time monitoring stream');
    });

    socket.on('site-metrics', (data) => {
      const { siteId, metrics } = data;
      
      // Update real-time metrics
      setMetricsData(prev => {
        const previous = prev[siteId] || {};
        const enrichedData = {
          ...metrics,
          isReachable: metrics.packetLoss !== null && metrics.packetLoss !== undefined ? metrics.packetLoss < 100 : true,
          _lastUpdated: Date.now()
        };
        return { ...prev, [siteId]: enrichedData };
      });

      // Update real-time graph history
      setMetricsHistory(prev => {
        const currentHistory = prev[siteId] || [];
        const newPoint = {
          timestamp: metrics.timestamp,
          latency: metrics.latency !== null ? Number(metrics.latency) : null,
          packetLoss: metrics.packetLoss !== null ? Number(metrics.packetLoss) : 0,
          jitter: metrics.jitter !== null ? Number(metrics.jitter) : null,
          isReachable: metrics.packetLoss < 100
        };
        
        // Keep last 60 points (approx 1 hour at 1 min interval, or 10 mins at 10s interval)
        // We want to see movement, so we append. 
        // If the history is very long (loaded from API), we slice from end.
        const newHistory = [...currentHistory, newPoint].slice(-60);
        return { ...prev, [siteId]: newHistory };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Load sites with periodic refresh
  useEffect(() => {
    if (!user) return;

    loadSites();
    const interval = setInterval(() => {
      loadSites(false); // Don't show notification on automatic refresh
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval, user]);

  // Load metrics for all sites with periodic refresh
  useEffect(() => {
    if (!user || sites.length === 0) return;

    sites.forEach(site => {
      if (site.monitoringIcmp) loadMetrics(site.id);
      if (site.monitoringSnmp) loadSnmpData(site.id);
      if (site.monitoringMeraki) loadApiData(site.id);
    });

    const interval = setInterval(() => {
      sites.forEach(site => {
        if (site.monitoringIcmp) loadMetrics(site.id);
        if (site.monitoringSnmp) loadSnmpData(site.id);
        if (site.monitoringMeraki) loadApiData(site.id);
      });
    }, refreshInterval * 1000); // Use configured refresh interval

    return () => clearInterval(interval);
  }, [sites, user, refreshInterval]);

  // Load metrics history with periodic refresh
  useEffect(() => {
    if (!user || sites.length === 0) return;

    const fetchHistory = () => {
      sites.forEach(site => {
        if (site.monitoringIcmp) {
          loadMetricsHistory(site.id);
        }
      });
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [sites, refreshInterval, user]);

  // Refresh monitoring data for currently selected site (when viewing detail modal)
  useEffect(() => {
    if (!user || !selectedSite) return;

    // Initial load
    if (selectedSite.monitoringIcmp) {
      loadMetrics(selectedSite.id);
      loadMetricsHistory(selectedSite.id);
    }
    if (selectedSite.monitoringSnmp) {
      loadSnmpData(selectedSite.id);
    }
    if (selectedSite.monitoringMeraki) {
      loadApiData(selectedSite.id);
    }

    // Set up interval for more frequent updates when viewing a site
    const interval = setInterval(() => {
      if (selectedSite.monitoringIcmp) {
        loadMetrics(selectedSite.id);
        loadMetricsHistory(selectedSite.id);
      }
      if (selectedSite.monitoringSnmp) {
        loadSnmpData(selectedSite.id);
      }
      if (selectedSite.monitoringMeraki) {
        loadApiData(selectedSite.id);
      }
    }, refreshInterval * 1000); // Use configured refresh interval

    return () => clearInterval(interval);
  }, [selectedSite, user, refreshInterval]);

  // Generate alerts from metrics and notify for new alerts
  useEffect(() => {
    const newAlerts = [];
    sites.forEach(site => {
      const metrics = metricsData[site.id];
      if (!metrics) return;

      // Track status changes for notifications
      const currentStatus = metrics.isReachable ? 'online' : 'offline';
      const previousStatus = previousSiteStatuses.current[site.id];

      // Notify on status change (but not on initial load)
      if (previousStatus !== undefined && previousStatus !== currentStatus) {
        notifySiteStatusChange(site.name, currentStatus);
      }

      // Update previous status
      previousSiteStatuses.current[site.id] = currentStatus;

      // Down alerts
      if (!metrics.isReachable) {
        const alertId = `${site.id}-down`;
        newAlerts.push({
          id: alertId,
          siteId: site.id,
          siteName: site.name,
          customer: site.customer,
          type: 'down',
          severity: 'critical',
          message: `Site is unreachable`,
          timestamp: Date.now()
        });

        // Notify for new down alert
        if (!notifiedAlerts.has(alertId) && !acknowledgedAlerts.has(alertId)) {
          notifyNewAlert(site.name, 'Site Down');
          setNotifiedAlerts(prev => new Set([...prev, alertId]));
        }
      }

      // High latency alerts
      if (metrics.isReachable && metrics.latency > 200) {
        const alertId = `${site.id}-latency`;
        newAlerts.push({
          id: alertId,
          siteId: site.id,
          siteName: site.name,
          customer: site.customer,
          type: 'latency',
          severity: 'warning',
          message: `High latency: ${metrics.latency}ms`,
          timestamp: Date.now()
        });

        // Notify for new high latency alert
        if (!notifiedAlerts.has(alertId) && !acknowledgedAlerts.has(alertId)) {
          notifyNewAlert(site.name, `High Latency (${metrics.latency}ms)`);
          setNotifiedAlerts(prev => new Set([...prev, alertId]));
        }
      }

      // Packet loss alerts
      if (metrics.isReachable && metrics.packetLoss > 5) {
        const alertId = `${site.id}-packetloss`;
        newAlerts.push({
          id: alertId,
          siteId: site.id,
          siteName: site.name,
          customer: site.customer,
          type: 'packetloss',
          severity: 'warning',
          message: `Packet loss: ${metrics.packetLoss}%`,
          timestamp: Date.now()
        });

        // Notify for new packet loss alert
        if (!notifiedAlerts.has(alertId) && !acknowledgedAlerts.has(alertId)) {
          notifyNewAlert(site.name, `Packet Loss (${metrics.packetLoss}%)`);
          setNotifiedAlerts(prev => new Set([...prev, alertId]));
        }
      }

      // SNMP alerts
      const snmp = snmpData[site.id];
      if (snmp && (snmp.cpu || snmp.cpuUsage) > 90) {
        const alertId = `${site.id}-cpu`;
        newAlerts.push({
          id: alertId,
          siteId: site.id,
          siteName: site.name,
          customer: site.customer,
          type: 'cpu',
          severity: 'warning',
          message: `High CPU usage: ${snmp.cpu || snmp.cpuUsage}%`,
          timestamp: Date.now()
        });

        // Notify for new CPU alert
        if (!notifiedAlerts.has(alertId) && !acknowledgedAlerts.has(alertId)) {
          notifyNewAlert(site.name, `High CPU (${snmp.cpu || snmp.cpuUsage}%)`);
          setNotifiedAlerts(prev => new Set([...prev, alertId]));
        }
      }

      if (snmp && (snmp.memory || snmp.memoryUsage) > 90) {
        const alertId = `${site.id}-memory`;
        newAlerts.push({
          id: alertId,
          siteId: site.id,
          siteName: site.name,
          customer: site.customer,
          type: 'memory',
          severity: 'warning',
          message: `High memory usage: ${snmp.memory || snmp.memoryUsage}%`,
          timestamp: Date.now()
        });

        // Notify for new memory alert
        if (!notifiedAlerts.has(alertId) && !acknowledgedAlerts.has(alertId)) {
          notifyNewAlert(site.name, `High Memory (${snmp.memory || snmp.memoryUsage}%)`);
          setNotifiedAlerts(prev => new Set([...prev, alertId]));
        }
      }
    });

    setAlerts(newAlerts);
  }, [metricsData, snmpData, sites, notifiedAlerts, acknowledgedAlerts]);

  const loadSites = async (showNotification = false) => {
    setLoadingFlag('sites', undefined, true);
    try {
      const res = await authFetch('/api/sites');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const siteList = Array.isArray(data)
        ? data
        : Array.isArray(data?.sites)
          ? data.sites
          : [];
      if (!Array.isArray(data) && !Array.isArray(data?.sites)) {
        console.warn('Unexpected sites payload shape, defaulting to empty array.', data);
      }
      setSites(siteList);
      if (showNotification) {
        notifyDataRefreshed();
      }
    } catch (err) {
      console.error('Failed to load sites:', err);
      notifyNetworkError();
    } finally {
      setLoadingFlag('sites', undefined, false);
    }
  };

  const loadMetrics = async (siteId) => {
    setLoadingFlag('metrics', siteId, true);
    try {
      const res = await authFetch(`/api/monitoring/${siteId}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setMetricsData(prev => {
        if (!data || Object.keys(data).length === 0) {
          return prev;
        }
        const previous = prev[siteId]
          ? Object.fromEntries(Object.entries(prev[siteId]).filter(([key]) => key !== '_lastUpdated'))
          : {};
        // Add isReachable derived from packetLoss (100% = down/not reachable)
        const enrichedData = {
          ...data,
          isReachable: data.packetLoss !== null && data.packetLoss !== undefined ? data.packetLoss < 100 : true
        };
        const merged = mergeTelemetryState(previous, enrichedData);
        return { ...prev, [siteId]: { ...merged, _lastUpdated: Date.now() } };
      });
    } catch (err) {
      console.error(`Failed to load metrics for site ${siteId}:`, err);
      // Don't show notification for individual metric failures as they happen frequently
    } finally {
      setLoadingFlag('metrics', siteId, false);
    }
  };

  const loadMetricsHistory = async (siteId, hours = 6) => {
    setLoadingFlag('history', siteId, true);
    try {
      const res = await authFetch(`/api/monitoring/${siteId}/history?hours=${hours}`);
      const data = await res.json();
      const history = Array.isArray(data)
        ? data.map(point => {
          const packetLoss = point.packetLoss !== null && point.packetLoss !== undefined ? Number(point.packetLoss) : null;
          return {
            timestamp: point.timestamp,
            latency: point.latency !== null && point.latency !== undefined ? Number(point.latency) : null,
            packetLoss: packetLoss,
            jitter: point.jitter !== null && point.jitter !== undefined ? Number(point.jitter) : null,
            // Derive isReachable from packetLoss (100% = down/not reachable)
            isReachable: packetLoss !== null ? packetLoss < 100 : undefined
          };
        })
        : [];
      if (history.length === 0) {
        return;
      }
      setMetricsHistory(prev => ({ ...prev, [siteId]: history }));
    } catch (err) {
      console.error(`Failed to load metrics history for site ${siteId}:`, err);
    } finally {
      setLoadingFlag('history', siteId, false);
    }
  };

  const loadSnmpData = async (siteId) => {
    setLoadingFlag('snmp', siteId, true);
    try {
      const res = await authFetch(`/api/monitoring/${siteId}/snmp`);
      const data = await res.json();
      setSnmpData(prev => {
        if (!data || Object.keys(data).length === 0) {
          return prev;
        }
        const previous = prev[siteId]
          ? Object.fromEntries(Object.entries(prev[siteId]).filter(([key]) => key !== '_lastUpdated'))
          : {};
        const merged = mergeTelemetryState(previous, data);
        return { ...prev, [siteId]: { ...merged, _lastUpdated: Date.now() } };
      });
    } catch (err) {
      console.error(`Failed to load SNMP data for site ${siteId}:`, err);
    } finally {
      setLoadingFlag('snmp', siteId, false);
    }
  };

  const loadApiData = async (siteId) => {
    setLoadingFlag('api', siteId, true);
    try {
      const res = await authFetch(`/api/monitoring/${siteId}/meraki`);
      const data = await res.json();
      setApiData(prev => {
        if (!data || Object.keys(data).length === 0) {
          return prev;
        }

        const previous = prev[siteId]
          ? Object.fromEntries(Object.entries(prev[siteId]).filter(([key]) => key !== '_lastUpdated'))
          : {};

        if (data.error) {
          return { ...prev, [siteId]: { ...previous, error: data.error, _lastUpdated: Date.now() } };
        }

        const merged = mergeTelemetryState(previous, data);
        if (merged.error) {
          delete merged.error;
        }

        return { ...prev, [siteId]: { ...merged, _lastUpdated: Date.now() } };
      });
    } catch (err) {
      console.error(`Failed to load API data for site ${siteId}:`, err);
    } finally {
      setLoadingFlag('api', siteId, false);
    }
  };

  // Filtering and grouping
  const filteredSites = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const rawSearch = searchTerm.trim();

    let filtered = sites.filter(site => {
      const name = typeof site?.name === 'string' ? site.name : '';
      const customer = typeof site?.customer === 'string' ? site.customer : '';
      const location = typeof site?.location === 'string' ? site.location : '';
      const ip = typeof site?.ip === 'string' ? site.ip : '';
      const status = typeof site?.status === 'string' ? site.status : '';

      // Search
      const matchesSearch = normalizedSearch === '' ||
        name.toLowerCase().includes(normalizedSearch) ||
        customer.toLowerCase().includes(normalizedSearch) ||
        ip.includes(rawSearch) ||
        (location !== '' && location.toLowerCase().includes(normalizedSearch));

      // Customer filter
      const matchesCustomer = customerFilter === 'all' || customer === customerFilter;

      // Status filter
      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      // Monitoring type filter
      const matchesMonitoring = monitoringTypeFilter === 'all' ||
        (monitoringTypeFilter === 'icmp' && site.monitoringIcmp) ||
        (monitoringTypeFilter === 'snmp' && site.monitoringSnmp) ||
        (monitoringTypeFilter === 'api' && site.monitoringMeraki);

      // Alert filter
      const siteAlerts = alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id));
      const matchesAlert = alertFilter === 'all' ||
        (alertFilter === 'critical' && siteAlerts.some(a => a.severity === 'critical')) ||
        (alertFilter === 'warning' && siteAlerts.some(a => a.severity === 'warning')) ||
        (alertFilter === 'none' && siteAlerts.length === 0);

      return matchesSearch && matchesCustomer && matchesStatus && matchesMonitoring && matchesAlert;
    });

    const getLastPollTimestamp = (site) => {
      const metrics = metricsData[site.id];
      const api = apiData?.[site.id];
      const snmp = snmpData?.[site.id];
      const raw =
        metrics?._lastUpdated ??
        metrics?.timestamp ??
        api?._lastUpdated ??
        api?.timestamp ??
        snmp?._lastUpdated ??
        snmp?.timestamp ??
        null;

      if (!raw) {
        return 0;
      }

      const parsed = typeof raw === 'number' ? raw : Date.parse(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    // Sorting
    filtered.sort((a, b) => {
      let aVal, bVal;

      if (sortField === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else if (sortField === 'customer') {
        aVal = a.customer;
        bVal = b.customer;
      } else if (sortField === 'status') {
        const metrics_a = metricsData[a.id];
        const metrics_b = metricsData[b.id];
        aVal = metrics_a?.isReachable ? 1 : 0;
        bVal = metrics_b?.isReachable ? 1 : 0;
      } else if (sortField === 'latency') {
        const metrics_a = metricsData[a.id];
        const metrics_b = metricsData[b.id];
        aVal = metrics_a?.latency || 9999;
        bVal = metrics_b?.latency || 9999;
      } else if (sortField === 'packetLoss') {
        const metrics_a = metricsData[a.id];
        const metrics_b = metricsData[b.id];
        const lossA = Number(metrics_a?.packetLoss);
        const lossB = Number(metrics_b?.packetLoss);
        aVal = Number.isFinite(lossA) ? lossA : Number.POSITIVE_INFINITY;
        bVal = Number.isFinite(lossB) ? lossB : Number.POSITIVE_INFINITY;
      } else if (sortField === 'uptime') {
        const metrics_a = metricsData[a.id];
        const metrics_b = metricsData[b.id];
        const uptimeA = Number(metrics_a?.uptime);
        const uptimeB = Number(metrics_b?.uptime);
        aVal = Number.isFinite(uptimeA) ? uptimeA : -1;
        bVal = Number.isFinite(uptimeB) ? uptimeB : -1;
      } else if (sortField === 'lastCheck') {
        aVal = getLastPollTimestamp(a);
        bVal = getLastPollTimestamp(b);
      } else if (sortField === 'alerts') {
        aVal = alerts.filter(alert => alert.siteId === a.id && !acknowledgedAlerts.has(alert.id)).length;
        bVal = alerts.filter(alert => alert.siteId === b.id && !acknowledgedAlerts.has(alert.id)).length;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return filtered;
  }, [sites, searchTerm, customerFilter, statusFilter, monitoringTypeFilter, alertFilter, sortField, sortDirection, metricsData, apiData, snmpData, alerts, acknowledgedAlerts]);

  // Grouping
  const groupedSites = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Sites': filteredSites };
    }

    const groups = {};
    filteredSites.forEach(site => {
      let groupKey;
      if (groupBy === 'customer') {
        groupKey = site.customer;
      } else if (groupBy === 'status') {
        const metrics = metricsData[site.id];
        groupKey = metrics?.isReachable ? 'Online' : 'Offline';
      } else if (groupBy === 'location') {
        groupKey = site.location || 'Unknown Location';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(site);
    });

    return groups;
  }, [filteredSites, groupBy, metricsData]);

  useEffect(() => {
    if (viewMode !== 'noc') {
      return;
    }
    filteredSites.forEach(site => {
      NOC_WINDOWS.forEach(hours => ensureExtendedHistory(site.id, hours));
    });
  }, [viewMode, filteredSites, ensureExtendedHistory]);

  // Statistics
  const stats = useMemo(() => {
    const total = sites.length;
    const online = sites.filter(s => metricsData[s.id]?.isReachable).length;
    const offline = sites.filter(s => metricsData[s.id] && !metricsData[s.id].isReachable).length;
    const unknown = total - online - offline;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !acknowledgedAlerts.has(a.id)).length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning' && !acknowledgedAlerts.has(a.id)).length;

    return { total, online, offline, unknown, criticalAlerts, warningAlerts };
  }, [sites, metricsData, alerts, acknowledgedAlerts]);

  const customers = useMemo(() => (
    [...new Set(
      sites.map(site => (typeof site?.customer === 'string' ? site.customer : ''))
    )]
      .filter(Boolean)
      .sort()
  ), [sites]);

  // Site selection
  const toggleSiteSelection = (siteId) => {
    const newSelected = new Set(selectedSites);
    if (newSelected.has(siteId)) {
      newSelected.delete(siteId);
    } else {
      newSelected.add(siteId);
    }
    setSelectedSites(newSelected);
  };

  const selectAllFiltered = () => {
    if (selectedSites.size === filteredSites.length) {
      setSelectedSites(new Set());
    } else {
      setSelectedSites(new Set(filteredSites.map(s => s.id)));
    }
  };

  // Group expansion
  const toggleGroup = (groupName) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  // Initialize expanded groups
  useEffect(() => {
    setExpandedGroups(new Set(Object.keys(groupedSites)));
  }, [groupBy]);

  // Get site status
  const getSiteStatus = useCallback((site) => {
    // Use the status from the database (set by backend monitoring)
    // Backend sets: "operational", "degraded", or "critical"
    const dbStatus = site.status?.toLowerCase();

    // Map backend status to display format
    if (dbStatus === 'critical') {
      return { label: 'CRITICAL', color: theme.danger, bg: theme.dangerBg };
    }

    if (dbStatus === 'degraded') {
      return { label: 'DEGRADED', color: theme.warning, bg: theme.warningBg };
    }

    if (dbStatus === 'operational') {
      return { label: 'HEALTHY', color: theme.success, bg: theme.successBg };
    }

    // No status yet (new site or no monitoring data)
    return { label: 'Unknown', color: theme.textMuted, bg: theme.card };
  }, [theme.card, theme.danger, theme.dangerBg, theme.success, theme.successBg, theme.textMuted, theme.warning, theme.warningBg]);

  // Acknowledge alert
  const acknowledgeAlert = (alertId) => {
    setAcknowledgedAlerts(prev => new Set([...prev, alertId]));

    // Find the alert to get its type for the notification
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      const alertType = alert.type === 'down' ? 'Site Down' :
        alert.type === 'latency' ? 'High Latency' :
          alert.type === 'packetloss' ? 'Packet Loss' :
            alert.type === 'cpu' ? 'High CPU' :
              alert.type === 'memory' ? 'High Memory' :
                'Alert';
      notifyAlertAcknowledged(alertType);
    }
  };

  // Bulk actions
  const bulkDelete = async () => {
    const count = selectedSites.size;
    setConfirmModal({
      title: 'Delete Sites',
      message: `Are you sure you want to delete ${count} sites? This action cannot be undone.`,
      onConfirm: async () => {
        let successCount = 0;
        let failureCount = 0;

        for (const siteId of selectedSites) {
          try {
            const res = await authFetch(`/api/sites/${siteId}`, {
              method: 'DELETE'
            });
            if (res.ok) {
              successCount++;
            } else {
              failureCount++;
            }
          } catch (err) {
            console.error(`Failed to delete site ${siteId}:`, err);
            failureCount++;
          }
        }

        if (successCount > 0) {
          notifyBulkDelete(successCount);
        }
        if (failureCount > 0) {
          showError(`Failed to delete ${failureCount} site${failureCount > 1 ? 's' : ''}`);
        }

        setSelectedSites(new Set());
        loadSites();
        setConfirmModal(null);
        setShowBulkActions(false);
      }
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Delete all sites
  const deleteAllSites = async () => {
    try {
      await authFetch('/api/sites', {
        method: 'DELETE'
      });
      setSites([]);
      setMetricsData({});
      setMetricsHistory({});
      setSnmpData({});
      setApiData({});
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to delete all sites:', err);
    }
  };

  // Delete single site
  const deleteSite = (siteId, siteName) => {
    setConfirmModal({
      title: 'Delete Site',
      message: `Are you sure you want to delete "${siteName}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await authFetch(`/api/sites/${siteId}`, {
            method: 'DELETE'
          });
          loadSites();
          setCardMenuOpen(null);
          setConfirmModal(null);
        } catch (err) {
          console.error('Failed to delete site:', err);
        }
      }
    });
  };

  // Styles
  const buttonStyle = {
    padding: '8px 16px',
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    background: theme.card,
    color: theme.text,
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  };

  const buttonPrimaryStyle = {
    ...buttonStyle,
    background: theme.primary,
    color: '#fff',
    border: 'none',
  };

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    background: theme.card,
    color: theme.text,
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  };

  return (
    <div style={{
      height: '100vh',
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      {!isFocusMode && (
        <div style={{
          background: theme.bgSecondary,
          borderBottom: `1px solid ${theme.border}`,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: `0 2px 8px ${theme.shadow}`,
          flex: '0 0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={20} color={theme.primary} />
              Covenant Technolog NOC
            </h1>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Server size={14} color={theme.textMuted} />
                <span style={{ color: theme.textMuted }}>Total:</span>
                <span style={{ fontWeight: 600 }}>{stats.total}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.success }} />
                <span style={{ fontWeight: 600, color: theme.success }}>{stats.online}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.danger }} />
                <span style={{ fontWeight: 600, color: theme.danger }}>{stats.offline}</span>
              </div>
              {stats.criticalAlerts > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: theme.dangerBg, borderRadius: '4px' }}>
                  <AlertTriangle size={14} color={theme.danger} />
                  <span style={{ fontWeight: 600, color: theme.danger }}>{stats.criticalAlerts}</span>
                </div>
              )}
              {stats.warningAlerts > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: theme.warningBg, borderRadius: '4px' }}>
                  <AlertTriangle size={14} color={theme.warning} />
                  <span style={{ fontWeight: 600, color: theme.warning }}>{stats.warningAlerts}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: theme.textSecondary }}>{user.email}</span>
            <Tooltip content="View all alerts and notifications" position="bottom" isDark={isDark}>
              <button
                style={{ ...buttonStyle, position: 'relative' }}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={16} />
                {stats.criticalAlerts + stats.warningAlerts > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: theme.danger,
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    minWidth: '18px',
                    textAlign: 'center'
                  }}>
                    {stats.criticalAlerts + stats.warningAlerts}
                  </span>
                )}
              </button>
            </Tooltip>
            <Tooltip content="Switch between dark and light theme" position="bottom" isDark={isDark}>
              <button style={buttonStyle} onClick={() => {
                setIsDark(!isDark);
                showInfo(`Switched to ${!isDark ? 'dark' : 'light'} theme`);
              }}>
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </Tooltip>
            {onShowAuditLog && (
              <Tooltip content="View audit log and activity history" position="bottom" isDark={isDark}>
                <button style={buttonStyle} onClick={onShowAuditLog}>
                  <Eye size={16} />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Meraki Management - Configure and manage Meraki devices" position="bottom" isDark={isDark}>
              <button
                style={buttonStyle}
                onClick={() => navigate('/dashboard/meraki')}
              >
                <img
                  src="/icons/meraki/logo.jpg"
                  alt="Meraki"
                  style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'cover' }}
                />
              </button>
            </Tooltip>
            <Tooltip content="Open settings and configuration" position="bottom" isDark={isDark}>
              <button style={buttonStyle} onClick={() => setShowSettings(true)}>
                <Settings size={16} />
              </button>
            </Tooltip>
            <Tooltip content="Log out of the dashboard" position="bottom" isDark={isDark}>
              <button style={buttonStyle} onClick={onLogout}>
                <LogOut size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!isFocusMode && (
        <div style={{
          background: theme.bgSecondary,
          borderBottom: `1px solid ${theme.border}`,
          padding: '8px 20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
          flex: '0 0 auto'
        }}>
          {/* Search */}
          <div style={{ flex: '1 1 auto', position: 'relative', minWidth: '400px', maxWidth: '1200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
            <input
              type="text"
              placeholder="Search sites, customers, IPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '32px', height: '34px', fontSize: '13px' }}
            />
          </div>

          {/* Card Editor Button */}
          <Tooltip content="Customize card layout and metrics" position="bottom" isDark={isDark}>
            <button
              onClick={() => setShowCardEditor(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              <Edit2 size={14} />
              Customize Cards
            </button>
          </Tooltip>
          <div style={{ width: '1px', height: '24px', background: theme.border, margin: '0 8px' }} />
          {/* View mode */}
          <div style={{ display: 'flex', background: theme.card, borderRadius: '6px', border: `1px solid ${theme.border}`, padding: '2px' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '5px 10px',
                background: viewMode === 'table' ? theme.primary : 'transparent',
                color: viewMode === 'table' ? '#fff' : theme.text,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <List size={14} />
              Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '5px 10px',
                background: viewMode === 'grid' ? theme.primary : 'transparent',
                color: viewMode === 'grid' ? '#fff' : theme.text,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Grid size={14} />
              Grid
            </button>
            <button
              onClick={() => setViewMode('map')}
              style={{
                padding: '5px 10px',
                background: viewMode === 'map' ? theme.primary : 'transparent',
                color: viewMode === 'map' ? '#fff' : theme.text,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Map size={14} />
              Map
            </button>
            <button
              onClick={() => setViewMode('noc')}
              style={{
                padding: '5px 10px',
                background: viewMode === 'noc' ? theme.primary : 'transparent',
                color: viewMode === 'noc' ? '#fff' : theme.text,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Activity size={14} />
              NOC
            </button>
          </div>

          <Tooltip content="Toggle full screen focus mode" position="bottom" isDark={isDark}>
            <button
              onClick={() => {
                setIsFocusMode(true);
                // Automatically switch to grid view if not already
                if (viewMode !== 'grid' && viewMode !== 'noc') {
                  setViewMode('grid');
                }
              }}
              style={{ ...buttonStyle }}
            >
              <Monitor size={16} />
              Focus Mode
            </button>
          </Tooltip>

          {/* Filters toggle */}
          <Tooltip content="Show advanced filter options" position="bottom" isDark={isDark}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                ...buttonStyle,
                background: showFilters ? theme.primary : theme.card,
                color: showFilters ? '#fff' : theme.text,
              }}
            >
              <Filter size={16} />
              Filters
              {(customerFilter !== 'all' || statusFilter !== 'all' || monitoringTypeFilter !== 'all' || alertFilter !== 'all') && (
                <span style={{
                  background: theme.danger,
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  {[customerFilter !== 'all', statusFilter !== 'all', monitoringTypeFilter !== 'all', alertFilter !== 'all'].filter(Boolean).length}
                </span>
              )}
            </button>
          </Tooltip>

          {/* Group by */}
          <Tooltip content="Organize sites by category" position="bottom" isDark={isDark}>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              style={{
                ...inputStyle,
                width: 'auto',
                minWidth: '150px',
                cursor: 'pointer'
              }}
            >
              <option value="none">No Grouping</option>
              <option value="customer">Group by Customer</option>
              <option value="status">Group by Status</option>
              <option value="location">Group by Location</option>
            </select>
          </Tooltip>

          {/* Bulk actions */}
          {selectedSites.size > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: theme.textSecondary }}>
                {selectedSites.size} selected
              </span>
              <button style={buttonStyle} onClick={() => setShowBulkActions(!showBulkActions)}>
                <MoreVertical size={16} />
                Actions
              </button>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <Tooltip content="Refresh all site data" position="left" isDark={isDark}>
              <button
                style={{
                  ...buttonStyle,
                  opacity: loadingState.sites ? 0.7 : 1,
                  cursor: loadingState.sites ? 'wait' : 'pointer'
                }}
                onClick={() => loadSites(true)}
                disabled={loadingState.sites}
              >
                <RefreshCw size={16} style={{
                  animation: loadingState.sites ? 'spin 1s linear infinite' : 'none'
                }} />
              </button>
            </Tooltip>
            <Tooltip content="Add a new site to monitor" position="left" isDark={isDark}>
              <button style={buttonPrimaryStyle} onClick={() => setShowAddSite(true)}>
                <Plus size={16} />
                Add Site
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Focus Mode Exit Button */}
      {isFocusMode && (
        <button
          onClick={() => setIsFocusMode(false)}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 2000,
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${theme.shadow}`,
            opacity: 0.2,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.2'}
          title="Exit Focus Mode"
        >
          <LogOut size={20} color={theme.text} />
        </button>
      )}

      {/* Filters panel */}
      {showFilters && (
        <div style={{
          background: theme.card,
          borderBottom: `1px solid ${theme.border}`,
          padding: '16px 24px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          flex: '0 0 auto'
        }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
              Customer
            </label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={inputStyle}>
              <option value="all">All Customers</option>
              {customers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
              Status
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
              <option value="all">All Statuses</option>
              <option value="Operational">Operational</option>
              <option value="Degraded">Degraded</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
              Monitoring Type
            </label>
            <select value={monitoringTypeFilter} onChange={(e) => setMonitoringTypeFilter(e.target.value)} style={inputStyle}>
              <option value="all">All Types</option>
              <option value="icmp">ICMP Only</option>
              <option value="snmp">SNMP Enabled</option>
              <option value="api">API Enabled</option>
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
              Alerts
            </label>
            <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} style={inputStyle}>
              <option value="all">All</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
              <option value="none">No Alerts</option>
            </select>
          </div>

          <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => {
                setCustomerFilter('all');
                setStatusFilter('all');
                setMonitoringTypeFilter('all');
                setAlertFilter('all');
              }}
              style={buttonStyle}
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions dropdown */}
      {showBulkActions && selectedSites.size > 0 && (
        <div style={{
          position: 'fixed',
          top: '180px',
          right: '24px',
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          boxShadow: `0 4px 12px ${theme.shadow}`,
          zIndex: 1000,
          minWidth: '200px'
        }}>
          <button
            onClick={bulkDelete}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: theme.danger,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px'
            }}
            onMouseEnter={(e) => e.target.style.background = theme.cardHover}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            <Trash2 size={16} />
            Delete Selected
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{
        padding: '12px 20px 20px',
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {viewMode === 'table' && (
          <TableView
            groupedSites={groupedSites}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            selectedSites={selectedSites}
            toggleSiteSelection={toggleSiteSelection}
            selectAllFiltered={selectAllFiltered}
            metricsData={metricsData}
            snmpData={snmpData}
            apiData={apiData}
            alerts={alerts}
            acknowledgedAlerts={acknowledgedAlerts}
            getSiteStatus={getSiteStatus}
            setSelectedSite={setSelectedSite}
            theme={theme}
            sortField={sortField}
            sortDirection={sortDirection}
            handleSort={handleSort}
            filteredSites={filteredSites}
            setEditingSite={setEditingSite}
            loadingState={loadingState}
          />
        )}

        {viewMode === 'grid' && (
          <GridView
            groupedSites={groupedSites}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            selectedSites={selectedSites}
            toggleSiteSelection={toggleSiteSelection}
            metricsData={metricsData}
            metricsHistory={metricsHistory}
            snmpData={snmpData}
            apiData={apiData}
            alerts={alerts}
            acknowledgedAlerts={acknowledgedAlerts}
            getSiteStatus={getSiteStatus}
            setSelectedSite={setSelectedSite}
            setEditingSite={setEditingSite}
            deleteSite={deleteSite}
            cardMenuOpen={cardMenuOpen}
            setCardMenuOpen={setCardMenuOpen}
            cardActiveTabs={cardActiveTabs}
            setCardActiveTabs={setCardActiveTabs}
            theme={theme}
            loadingState={loadingState}
            gridCardLayouts={gridCardLayouts}
            isFocusMode={isFocusMode}
          />
        )}

        {viewMode === 'noc' && (
          <NOCView
            sites={filteredSites}
            metricsData={metricsData}
            metricsHistory={metricsHistory}
            snmpData={snmpData}
            apiData={apiData}
            extendedHistory={extendedHistory}
            ensureHistory={ensureExtendedHistory}
            theme={theme}
            setSelectedSite={setSelectedSite}
            cardLatencyWindows={cardLatencyWindows}
            setCardLatencyWindows={setCardLatencyWindows}
            loadingState={loadingState}
            alerts={alerts}
            acknowledgedAlerts={acknowledgedAlerts}
            selectedSites={selectedSites}
            toggleSiteSelection={toggleSiteSelection}
            cardMenuOpen={cardMenuOpen}
            setCardMenuOpen={setCardMenuOpen}
            setEditingSite={setEditingSite}
            deleteSite={deleteSite}
            cardLayout={cardLayout}
          />
        )}

        {viewMode === 'map' && (
          <MapView
            sites={filteredSites}
            metricsData={metricsData}
            getSiteStatus={getSiteStatus}
            setSelectedSite={setSelectedSite}
            setEditingSite={setEditingSite}
            theme={theme}
          />
        )}
      </div>

      {/* Card Editor Modal */}
      <CardEditorModal
        isOpen={showCardEditor}
        onClose={() => setShowCardEditor(false)}
        theme={theme}
        onSave={handleCardConfigSave}
      />

      {/* Site detail modal */}
      {selectedSite && (
        <SiteDetailModal
          site={selectedSite}
          metrics={metricsData[selectedSite.id]}
          history={metricsHistory[selectedSite.id]}
          snmp={snmpData[selectedSite.id]}
          api={apiData[selectedSite.id]}
          alerts={alerts.filter(a => a.siteId === selectedSite.id && !acknowledgedAlerts.has(a.id))}
          onClose={() => setSelectedSite(null)}
          onEdit={() => {
            setEditingSite(selectedSite);
            setSelectedSite(null);
          }}
          onAcknowledgeAlert={acknowledgeAlert}
          theme={theme}
          loadingState={loadingState}
        />
      )}

      {/* Add/Edit site modal */}
      {(showAddSite || editingSite) && (
        <AddEditSiteModal
          site={editingSite}
          onClose={() => {
            setShowAddSite(false);
            setEditingSite(null);
          }}
          onSave={() => {
            setShowAddSite(false);
            setEditingSite(null);
            loadSites();
          }}
          theme={theme}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          theme={theme}
          isDark={isDark}
          setIsDark={setIsDark}
          sites={sites}
          metricsData={metricsData}
          user={user}
          onDeleteAllSites={deleteAllSites}
          onSitesImported={loadSites}
          refreshInterval={refreshInterval}
          onRefreshIntervalChange={updateRefreshInterval}
        />
      )}



      {/* Notifications dropdown */}
      {showNotifications && (
        <div style={{
          position: 'fixed',
          top: '56px',
          right: '120px',
          width: '400px',
          maxHeight: '600px',
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          boxShadow: `0 8px 24px ${theme.shadow}`,
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Alerts & Notifications
            </h3>
            <button
              onClick={() => setShowNotifications(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textMuted,
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Alerts list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px' }}>
            {alerts.filter(a => !acknowledgedAlerts.has(a.id)).length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: theme.textMuted }}>
                <CheckCircle size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <div style={{ fontSize: '14px' }}>No active alerts</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>All systems operational</div>
              </div>
            ) : (
              alerts
                .filter(a => !acknowledgedAlerts.has(a.id))
                .map(alert => (
                  <div
                    key={alert.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${theme.border}`,
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'start'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: alert.severity === 'critical' ? theme.dangerBg : theme.warningBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <AlertTriangle
                        size={16}
                        color={alert.severity === 'critical' ? theme.danger : theme.warning}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                        {alert.siteName}
                      </div>
                      <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                        {alert.message}
                      </div>
                      <div style={{ fontSize: '11px', color: theme.textMuted }}>
                        {alert.customer}
                      </div>
                    </div>
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      style={{
                        padding: '4px 8px',
                        background: theme.card,
                        color: theme.primary,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        flexShrink: 0
                      }}
                    >
                      Ack
                    </button>
                  </div>
                ))
            )}
          </div>

          {/* Footer */}
          {alerts.filter(a => !acknowledgedAlerts.has(a.id)).length > 0 && (
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${theme.border}`,
              textAlign: 'center'
            }}>
              <button
                onClick={() => {
                  alerts.forEach(alert => {
                    if (!acknowledgedAlerts.has(alert.id)) {
                      acknowledgeAlert(alert.id);
                    }
                  });
                }}
                style={{
                  padding: '6px 12px',
                  background: theme.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                Acknowledge All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          theme={theme}
        />
      )}
    </div>
  );
};

// View and modal implementations reside in ./noc-dashboard

export default NOCDashboardV2;
