import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Activity,
  Server,
  RefreshCw,
  Wifi,
  Globe,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  MapPin,
  SlidersHorizontal
} from 'lucide-react';
import {
  formatBytes,
  formatDuration,
  formatLatency,
  formatPercent,
  formatNumber,
  formatRelativeTime,
  ensureArray,
  takeLast,
  withAlpha,
  LATENCY_GOOD_THRESHOLD_MS,
  LATENCY_WARN_THRESHOLD_MS,
  NOC_WINDOWS,
  PACKETS_PER_SAMPLE
} from './utils';
import LoadingBar from './LoadingBar';
import { authFetch } from '../../utils/api';

const TABLE_COLUMN_STORAGE_KEY = 'noc-dashboard-columns:v1';
const TABLE_COLUMN_COOKIE_KEY = 'noc-dashboard-columns';
const TABLE_COLUMN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

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

const ALL_TABLE_COLUMNS = [
  'status',
  'name',
  'customer',
  'ip',
  'location',
  'latency',
  'packetLoss',
  'uptime',
  'lastCheck',
  'monitoring',
  'alerts',
  'actions'
];
const DEFAULT_TABLE_COLUMNS = [
  'status',
  'name',
  'customer',
  'ip',
  'location',
  'latency',
  'monitoring',
  'alerts',
  'actions'
];
const REQUIRED_TABLE_COLUMNS = ['name'];

// Table View Component
const TableView = ({
  groupedSites, expandedGroups, toggleGroup, selectedSites, toggleSiteSelection,
  selectAllFiltered, metricsData, snmpData, apiData, alerts,
  acknowledgedAlerts, getSiteStatus, setSelectedSite, theme, sortField,
  sortDirection, handleSort, filteredSites, setEditingSite, loadingState
}) => {
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={14} style={{ opacity: 0.3 }} />;
    return sortDirection === 'asc' ? <ChevronDown size={14} /> : <ChevronRight size={14} style={{ transform: 'rotate(-90deg)' }} />;
  };

  const columnSelectorRef = useRef(null);

const sanitizeColumnSelection = (input) => {
  const initial = Array.isArray(input) ? input : [];
  const merged = new Set(REQUIRED_TABLE_COLUMNS);
  initial.forEach((columnId) => {
    if (ALL_TABLE_COLUMNS.includes(columnId)) {
      merged.add(columnId);
    }
  });
  const ordered = ALL_TABLE_COLUMNS.filter((columnId) => merged.has(columnId));
  return ordered.length ? ordered : DEFAULT_TABLE_COLUMNS.slice();
};

const loadStoredColumns = () => {
  try {
    const cookieValue = getCookieValue(TABLE_COLUMN_COOKIE_KEY);
    let stored = cookieValue;
    if (!stored && typeof window !== 'undefined' && window.localStorage) {
      stored = window.localStorage.getItem(TABLE_COLUMN_STORAGE_KEY);
    }
    if (stored) {
      const parsed = JSON.parse(stored);
      return sanitizeColumnSelection(parsed);
    }
  } catch {
    // ignore storage errors
  }
  return null;
};

  const sanitizeColumns = useCallback((input) => sanitizeColumnSelection(input), []);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const stored = loadStoredColumns();
    return stored || sanitizeColumnSelection(DEFAULT_TABLE_COLUMNS);
  });
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(visibleColumns);
      setCookieValue(TABLE_COLUMN_COOKIE_KEY, serialized, TABLE_COLUMN_COOKIE_MAX_AGE);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TABLE_COLUMN_STORAGE_KEY, serialized);
      }
    } catch {
      // ignore storage errors
    }
  }, [visibleColumns]);

  useEffect(() => {
    if (!columnSelectorOpen) return undefined;
    if (typeof document === 'undefined') return undefined;

    const handlePointerDown = (event) => {
      if (!columnSelectorRef.current) return;
      if (!columnSelectorRef.current.contains(event.target)) {
        setColumnSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [columnSelectorOpen]);

  const handleColumnToggle = useCallback((columnId) => {
    if (REQUIRED_TABLE_COLUMNS.includes(columnId)) {
      return;
    }
    setVisibleColumns((previous) => {
      if (previous.includes(columnId)) {
        const remaining = previous.filter((id) => id !== columnId);
        if (remaining.length === 0) {
          return previous;
        }
        return sanitizeColumns(remaining);
      }
      return sanitizeColumns([...previous, columnId]);
    });
  }, [sanitizeColumns]);

  const resetColumns = useCallback(() => {
    setVisibleColumns(sanitizeColumns(DEFAULT_TABLE_COLUMNS));
  }, [sanitizeColumns]);

  const enableAllColumns = useCallback(() => {
    setVisibleColumns(sanitizeColumns(ALL_TABLE_COLUMNS));
  }, [sanitizeColumns]);

  const safeSetSelectedSite = useCallback((site) => {
    if (typeof setSelectedSite === 'function') {
      setSelectedSite(site);
    }
  }, [setSelectedSite]);

  const safeSetEditingSite = useCallback((site) => {
    if (typeof setEditingSite === 'function') {
      setEditingSite(site);
    }
  }, [setEditingSite]);

  const hiddenColumnCount = ALL_TABLE_COLUMNS.filter((columnId) => !visibleColumns.includes(columnId)).length;

  const columnDefinitions = {
    status: { label: 'STATUS', sortable: 'status', headerAlign: 'left' },
    name: { label: 'SITE NAME', sortable: 'name', headerAlign: 'left', minWidth: '160px' },
    customer: { label: 'CUSTOMER', sortable: 'customer', headerAlign: 'left' },
    ip: { label: 'IP ADDRESS', headerAlign: 'left', minWidth: '140px' },
    location: { label: 'LOCATION', headerAlign: 'left' },
    latency: { label: 'LATENCY', sortable: 'latency', headerAlign: 'left' },
    packetLoss: { label: 'PACKET LOSS', sortable: 'packetLoss', headerAlign: 'left' },
    uptime: { label: 'UPTIME', sortable: 'uptime', headerAlign: 'left' },
    lastCheck: { label: 'LAST POLL', sortable: 'lastCheck', headerAlign: 'left', minWidth: '140px' },
    monitoring: { label: 'MONITORING', headerAlign: 'center' },
    alerts: { label: 'ALERTS', sortable: 'alerts', headerAlign: 'left' },
    actions: { label: 'ACTIONS', headerAlign: 'center', width: '100px' }
  };

  const orderedColumns = visibleColumns.filter((columnId) => columnDefinitions[columnId]);
  const borderColor = theme?.borderLight || theme.border;
  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

  const baseCellStyle = {
    padding: '12px'
  };

  const getCellStyle = (columnId) => {
    switch (columnId) {
      case 'name':
        return { ...baseCellStyle, fontWeight: 500 };
      case 'customer':
        return { ...baseCellStyle, color: theme.textSecondary };
      case 'ip':
        return { ...baseCellStyle, fontFamily: 'monospace', fontSize: '13px' };
      case 'location':
        return { ...baseCellStyle, color: theme.textSecondary, fontSize: '13px' };
      case 'monitoring':
        return { ...baseCellStyle, textAlign: 'center' };
      case 'actions':
        return { ...baseCellStyle, textAlign: 'center' };
      default:
        return baseCellStyle;
    }
  };

  const actionButtonStyle = {
    padding: '6px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: theme.textMuted,
    borderRadius: '4px'
  };

  const renderCellContent = (columnId, context) => {
    const {
      site,
      status,
      showInitialLoading,
      metrics,
      alertCounts,
      lastPollDisplay,
      lastPollTimestamp
    } = context;

    switch (columnId) {
      case 'status':
        return (
          <>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '4px',
                background: status.bg,
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: status.color
                }}
              />
              <span style={{ color: status.color }}>{status.label}</span>
            </div>
            {showInitialLoading && (
              <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                <LoadingBar width="72px" height={6} />
              </div>
            )}
          </>
        );
      case 'name':
        return site.name || <span style={{ color: theme.textMuted }}>-</span>;
      case 'customer':
        return site.customer || <span style={{ color: theme.textMuted }}>-</span>;
      case 'ip':
        return site.ip || <span style={{ color: theme.textMuted }}>-</span>;
      case 'location':
        return site.location || <span style={{ color: theme.textMuted }}>-</span>;
      case 'latency': {
        if (showInitialLoading) {
          return <LoadingBar width="72px" height={6} />;
        }
        if (!metrics?.isReachable || metrics?.latency === undefined || metrics?.latency === null) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        const latencyValue = Number(metrics.latency);
        if (!Number.isFinite(latencyValue)) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        const latencyColor = latencyValue >= LATENCY_WARN_THRESHOLD_MS
          ? theme.warning
          : latencyValue <= LATENCY_GOOD_THRESHOLD_MS
            ? theme.success
            : theme.text;
        return (
          <span style={{ fontWeight: 500, color: latencyColor }}>
            {formatLatency(latencyValue)}
          </span>
        );
      }
      case 'packetLoss': {
        if (showInitialLoading) {
          return <LoadingBar width="56px" height={6} />;
        }
        if (metrics?.packetLoss === undefined || metrics?.packetLoss === null) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        const lossValue = Number(metrics.packetLoss);
        if (!Number.isFinite(lossValue)) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        const lossColor = lossValue > 1 ? theme.warning : theme.text;
        return (
          <span style={{ fontWeight: 500, color: lossColor }}>
            {`${lossValue.toFixed(1)}%`}
          </span>
        );
      }
      case 'uptime': {
        if (showInitialLoading) {
          return <LoadingBar width="56px" height={6} />;
        }
        if (metrics?.uptime === undefined || metrics?.uptime === null) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        const uptimeValue = Number(metrics.uptime);
        if (!Number.isFinite(uptimeValue)) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        const uptimeColor = uptimeValue < 99 ? theme.warning : theme.text;
        return (
          <span style={{ fontWeight: 500, color: uptimeColor }}>
            {formatPercent(uptimeValue, 1)}
          </span>
        );
      }
      case 'lastCheck': {
        if (showInitialLoading) {
          return <LoadingBar width="72px" height={6} />;
        }
        if (!lastPollTimestamp) {
          return <span style={{ color: theme.textMuted }}>No recent poll</span>;
        }
        const isStale = Date.now() - lastPollTimestamp > FIFTEEN_MINUTES_MS;
        return (
          <span style={{ fontSize: '12px', fontWeight: 500, color: isStale ? theme.warning : theme.textSecondary }}>
            {lastPollDisplay}
          </span>
        );
      }
      case 'monitoring': {
        const monitoringIcons = [
          site.monitoringIcmp && <Wifi key="icmp" size={14} color={theme.success} title="ICMP" />,
          site.monitoringSnmp && <Server key="snmp" size={14} color={theme.info} title="SNMP" />,
          site.monitoringMeraki && <Globe key="api" size={14} color={theme.primary} title="API" />
        ].filter(Boolean);
        if (monitoringIcons.length === 0) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
            {monitoringIcons}
          </div>
        );
      }
      case 'alerts': {
        const { critical = 0, warning = 0 } = alertCounts || {};
        if (!critical && !warning) {
          return <span style={{ color: theme.textMuted }}>-</span>;
        }
        return (
          <div style={{ display: 'flex', gap: '4px' }}>
            {critical > 0 && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: theme.dangerBg,
                  color: theme.danger,
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {critical}
              </span>
            )}
            {warning > 0 && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: theme.warningBg,
                  color: theme.warning,
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {warning}
              </span>
            )}
          </div>
        );
      }
      case 'actions':
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                safeSetSelectedSite(site);
              }}
              style={actionButtonStyle}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = theme.bgSecondary;
                event.currentTarget.style.color = theme.text;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
                event.currentTarget.style.color = theme.textMuted;
              }}
              title="View Details"
            >
              <Eye size={16} />
            </button>
            {typeof setEditingSite === 'function' && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  safeSetEditingSite(site);
                }}
                style={actionButtonStyle}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = theme.bgSecondary;
                  event.currentTarget.style.color = theme.text;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                  event.currentTarget.style.color = theme.textMuted;
                }}
                title="Edit Site"
              >
                <Edit size={16} />
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        overflow: 'auto',
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: `1px solid ${theme.border}`,
          background: withAlpha(theme.bgSecondary, 0.35)
        }}
      >
        <div ref={columnSelectorRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setColumnSelectorOpen((open) => !open)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${columnSelectorOpen ? theme.primary : borderColor}`,
              background: columnSelectorOpen ? withAlpha(theme.primary, 0.15) : withAlpha(theme.bgSecondary, 0.2),
              color: theme.text,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = withAlpha(theme.primary, 0.18);
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = columnSelectorOpen
                ? withAlpha(theme.primary, 0.15)
                : withAlpha(theme.bgSecondary, 0.2);
            }}
          >
            <SlidersHorizontal size={16} />
            Manage Columns
            {hiddenColumnCount > 0 && (
              <span
                style={{
                  minWidth: '18px',
                  height: '18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '999px',
                  background: theme.primary,
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '0 6px'
                }}
              >
                {hiddenColumnCount}
              </span>
            )}
          </button>
          {columnSelectorOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '240px',
                maxHeight: '340px',
                overflowY: 'auto',
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                boxShadow: '0 16px 32px rgba(15, 23, 42, 0.18)',
                padding: '12px',
                zIndex: 30
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: theme.textSecondary }}>
                  Columns
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={enableAllColumns}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${borderColor}`,
                      background: 'transparent',
                      color: theme.textSecondary,
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = withAlpha(theme.primary, 0.08);
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={resetColumns}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${borderColor}`,
                      background: 'transparent',
                      color: theme.textSecondary,
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = withAlpha(theme.primary, 0.08);
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {ALL_TABLE_COLUMNS.map((columnId) => {
                  const definition = columnDefinitions[columnId];
                  if (!definition) return null;
                  const isActive = visibleColumns.includes(columnId);
                  const isRequired = REQUIRED_TABLE_COLUMNS.includes(columnId);
                  return (
                    <button
                      key={columnId}
                      type="button"
                      onClick={() => handleColumnToggle(columnId)}
                      disabled={isRequired}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '6px 8px',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: '6px',
                        background: 'transparent',
                        color: theme.text,
                        cursor: isRequired ? 'default' : 'pointer'
                      }}
                      onMouseEnter={(event) => {
                        if (isRequired) return;
                        event.currentTarget.style.background = withAlpha(theme.primary, 0.08);
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {isActive ? (
                          <CheckSquare size={16} color={theme.primary} />
                        ) : (
                          <Square size={16} color={theme.textMuted} />
                        )}
                        {definition.label}
                      </span>
                      {isRequired && (
                        <span
                          style={{
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            color: theme.textMuted,
                            fontWeight: 600
                          }}
                        >
                          Required
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: theme.bgSecondary, borderBottom: `1px solid ${theme.border}` }}>
            <th style={{ padding: '12px', textAlign: 'left', width: '40px' }}>
              <div onClick={selectAllFiltered} style={{ cursor: 'pointer' }}>
                {selectedSites.size === filteredSites.length && filteredSites.length > 0 ? (
                  <CheckSquare size={18} color={theme.primary} />
                ) : (
                  <Square size={18} color={theme.textMuted} />
                )}
              </div>
            </th>
            {orderedColumns.map((columnId) => {
              const definition = columnDefinitions[columnId];
              if (!definition) return null;
              const isSortable = Boolean(definition.sortable);
              const headerStyle = {
                padding: '12px',
                textAlign: definition.headerAlign || 'left',
                fontSize: '12px',
                fontWeight: 600,
                color: theme.textSecondary,
                cursor: isSortable ? 'pointer' : 'default',
                width: definition.width,
                minWidth: definition.minWidth
              };
              const headerContent = isSortable ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: definition.headerAlign === 'center' ? 'center' : 'flex-start',
                    gap: '4px'
                  }}
                >
                  {definition.label}
                  <SortIcon field={definition.sortable} />
                </div>
              ) : definition.headerAlign === 'center' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {definition.label}
                </div>
              ) : (
                definition.label
              );

              return (
                <th
                  key={columnId}
                  style={headerStyle}
                  onClick={isSortable ? () => handleSort(definition.sortable) : undefined}
                >
                  {headerContent}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedSites).map(([groupName, groupSites]) => (
            <React.Fragment key={groupName}>
              {groupName !== 'All Sites' && (
                <tr
                  style={{
                    background: theme.bgSecondary,
                    borderTop: `1px solid ${theme.border}`,
                    borderBottom: `1px solid ${theme.border}`,
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleGroup(groupName)}
                >
                  <td
                    colSpan={orderedColumns.length + 1}
                    style={{ padding: '12px', fontWeight: 600, fontSize: '14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {expandedGroups.has(groupName) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      {groupName}
                      <span
                        style={{
                          color: theme.textMuted,
                          fontSize: '12px',
                          fontWeight: 400,
                          marginLeft: '8px'
                        }}
                      >
                        ({groupSites.length})
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              {(groupName === 'All Sites' || expandedGroups.has(groupName)) && groupSites.map((site) => {
                const metrics = metricsData[site.id] || {};
                const api = apiData[site.id] || {};
                const snmp = snmpData[site.id] || {};
                const siteAlerts = alerts.filter((a) => a.siteId === site.id && !acknowledgedAlerts.has(a.id));
                const status = getSiteStatus(site);
                const metricsLoading = !!loadingState?.metrics?.[site.id];
                const snmpLoading = !!loadingState?.snmp?.[site.id];
                const apiLoading = !!loadingState?.api?.[site.id];
                const historyLoading = !!loadingState?.history?.[site.id];
                const hasInitialData = Object.keys(metrics).length > 0 || Object.keys(snmp).length > 0 || Object.keys(api).length > 0;
                const showInitialLoading = !hasInitialData && (metricsLoading || snmpLoading || apiLoading || historyLoading);
                const alertCounts = siteAlerts.reduce(
                  (acc, alert) => {
                    if (alert.severity === 'critical') acc.critical += 1;
                    if (alert.severity === 'warning') acc.warning += 1;
                    return acc;
                  },
                  { critical: 0, warning: 0 }
                );
                const lastUpdatedRaw =
                  metrics?._lastUpdated ||
                  metrics?.timestamp ||
                  api?._lastUpdated ||
                  api?.timestamp ||
                  snmp?._lastUpdated ||
                  snmp?.timestamp ||
                  null;
                let lastPollTimestamp = null;
                if (lastUpdatedRaw) {
                  const parsedTimestamp = typeof lastUpdatedRaw === 'number' ? lastUpdatedRaw : Date.parse(lastUpdatedRaw);
                  if (Number.isFinite(parsedTimestamp)) {
                    lastPollTimestamp = parsedTimestamp;
                  }
                }
                const lastPollDisplay = lastPollTimestamp ? formatRelativeTime(lastPollTimestamp) : 'No recent poll';

                const rowContext = {
                  site,
                  status,
                  showInitialLoading,
                  metrics,
                  alertCounts,
                  lastPollDisplay,
                  lastPollTimestamp
                };

                return (
                  <tr
                    key={site.id}
                    style={{
                      borderBottom: `1px solid ${theme.border}`,
                      transition: 'background 0.15s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = theme.cardHover;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '12px', width: '40px' }} onClick={(event) => event.stopPropagation()}>
                      <div onClick={() => toggleSiteSelection(site.id)} style={{ cursor: 'pointer' }}>
                        {selectedSites.has(site.id) ? (
                          <CheckSquare size={18} color={theme.primary} />
                        ) : (
                          <Square size={18} color={theme.textMuted} />
                        )}
                      </div>
                    </td>
                    {orderedColumns.map((columnId) => {
                      const cellStyle = getCellStyle(columnId);
                      const isActionsColumn = columnId === 'actions';
                      return (
                        <td
                          key={columnId}
                          style={cellStyle}
                          onClick={(event) => {
                            if (isActionsColumn) {
                              event.stopPropagation();
                            } else {
                              safeSetSelectedSite(site);
                            }
                          }}
                        >
                          {renderCellContent(columnId, rowContext)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Grid View Component - Adaptive Cards with Tabs
const Sparkline = ({
  data,
  color,
  theme,
  height = 32,
  threshold,
  strokeWidth = 0.8,
  showMarker = true,
  areaOpacity = 0.65
}) => {
  const pointsData = Array.isArray(data)
    ? data.filter(value => value !== null && Number.isFinite(value))
    : [];

  if (pointsData.length === 0) {
    return <div style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No data</div>;
  }

  const processed = pointsData.length === 1
    ? [{ x: 0, value: pointsData[0] }, { x: 100, value: pointsData[0] }]
    : pointsData.map((value, index) => ({
        x: (index / (pointsData.length - 1)) * 100,
        value
      }));

  const values = processed.map(point => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const coords = processed.map(({ x, value }) => ({
    x,
    y: 100 - ((value - min) / range) * 100
  }));

  const gradientId = useMemo(() => `spark-${Math.random().toString(36).slice(2, 8)}`, []);
  const strokeColor = color || theme.primary;
  const areaPath = `M ${coords[0].x},100 ${coords.map(c => `L ${c.x},${c.y}`).join(' ')} L ${coords[coords.length - 1].x},100 Z`;
  const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
  const lastPoint = coords[coords.length - 1];

  const showThreshold = typeof threshold === 'number' && Number.isFinite(threshold);
  let thresholdY = null;
  if (showThreshold) {
    const clamped = Math.max(min, Math.min(max, threshold));
    thresholdY = 100 - ((clamped - min) / range) * 100;
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="transparent" />
      {showThreshold && thresholdY !== null && thresholdY >= 0 && thresholdY <= 100 && (
        <line
          x1="0"
          x2="100"
          y1={thresholdY}
          y2={thresholdY}
          stroke={theme.warning}
          strokeWidth="0.5"
          strokeDasharray="3 2"
          opacity="0.65"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={areaPath} fill={`url(#${gradientId})`} opacity={areaOpacity} />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showMarker && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r="1.5" fill={strokeColor} />
      )}
    </svg>
  );
};

const LatencySpark = ({ data, theme }) => {
  const samples = Array.isArray(data)
    ? data
        .map(value => (value !== null && value !== undefined ? Number(value) : null))
        .filter(value => Number.isFinite(value))
    : [];

  if (samples.length === 0) {
    return <div style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No data</div>;
  }

  const normalized = samples.length === 1 ? [samples[0], samples[0]] : samples;
  const chartWidth = 100;
  const chartHeight = 48;
  const chartMax = Math.max(220, ...normalized.map(value => Math.max(0, value)));

  const points = normalized.map((value, index) => {
    const x = normalized.length === 1 ? chartWidth : (index / (normalized.length - 1)) * chartWidth;
    const clamped = Math.min(Math.max(value, 0), chartMax);
    const y = chartHeight - (clamped / chartMax) * chartHeight;
    return { x, y, value: clamped };
  });

  const pathLine = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} ${points
    .slice(1)
    .map(point => `L ${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')}`;
  const pathArea = `M 0,${chartHeight} ` +
    points.map(point => `L ${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ') +
    ` L ${chartWidth},${chartHeight} Z`;

  const yForValue = (value) => {
    const clamped = Math.min(Math.max(value, 0), chartMax);
    return chartHeight - (clamped / chartMax) * chartHeight;
  };

  const warnY = yForValue(LATENCY_WARN_THRESHOLD_MS);
  const goodY = yForValue(LATENCY_GOOD_THRESHOLD_MS);

  const zoneRects = [
    { y: 0, height: Math.max(0, warnY), color: withAlpha(theme.danger, 0.2) },
    { y: warnY, height: Math.max(0, goodY - warnY), color: withAlpha(theme.warning, 0.18) },
    { y: goodY, height: Math.max(0, chartHeight - goodY), color: withAlpha(theme.success, 0.16) },
  ].filter(zone => zone.height > 0.5);

  const lastPoint = points[points.length - 1];

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        {zoneRects.map((zone, index) => (
          <rect
            key={index}
            x="0"
            y={zone.y}
            width={chartWidth}
            height={zone.height}
            fill={zone.color}
          />
        ))}
        {warnY > 0 && warnY < chartHeight && (
          <line
            x1="0"
            x2={chartWidth}
            y1={warnY}
            y2={warnY}
            stroke={withAlpha(theme.danger, 0.4)}
            strokeDasharray="2 2"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {goodY > 0 && goodY < chartHeight && (
          <line
            x1="0"
            x2={chartWidth}
            y1={goodY}
            y2={goodY}
            stroke={withAlpha(theme.warning, 0.35)}
            strokeDasharray="2 2"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={pathArea} fill={withAlpha(theme.primary, 0.25)} />
        <path d={pathLine} fill="none" stroke={theme.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="1.5" fill={theme.primary} />
      </svg>
    </div>
  );
};

const computeLatencyStats = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      min: null,
      max: null,
      average: null,
      p95: null,
      sampleCount: 0
    };
  }

  const values = history
    .map(point => (point && point.latency !== null && point.latency !== undefined ? Number(point.latency) : null))
    .filter(value => Number.isFinite(value));

  if (values.length === 0) {
    return {
      min: null,
      max: null,
      average: null,
      p95: null,
      sampleCount: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const index95 = Math.floor(0.95 * (sorted.length - 1));
  const p95 = sorted[Math.max(0, Math.min(sorted.length - 1, index95))];

  return {
    min,
    max,
    average,
    p95,
    sampleCount: values.length
  };
};

const computeLossStats = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      averageLoss: null,
      maxLoss: null,
      downEvents: 0,
      totalSamples: 0
    };
  }

  const validLoss = history
    .map(point => (point && point.packetLoss !== null && point.packetLoss !== undefined ? Number(point.packetLoss) : null))
    .filter(value => Number.isFinite(value));

  const averageLoss = validLoss.length > 0
    ? validLoss.reduce((sum, value) => sum + value, 0) / validLoss.length
    : null;

  const maxLoss = validLoss.length > 0
    ? Math.max(...validLoss)
    : null;

  let downEvents = 0;
  let wasDown = false;
  const sortedHistory = [...history].sort((a, b) => {
    const tsA = a?.timestamp ? Date.parse(a.timestamp) : 0;
    const tsB = b?.timestamp ? Date.parse(b.timestamp) : 0;
    return tsA - tsB;
  });

  sortedHistory.forEach(point => {
    const reachable = point?.isReachable !== undefined
      ? !!point.isReachable
      : (point?.status ? String(point.status).toLowerCase() !== 'down' : true);
    if (!reachable) {
      if (!wasDown) {
        downEvents += 1;
        wasDown = true;
      }
    } else {
      wasDown = false;
    }
  });

  const totalSent = history.length * PACKETS_PER_SAMPLE;
  const totalLost = history.reduce((sum, point) => {
    const loss = point && point.packetLoss !== null && point.packetLoss !== undefined ? Number(point.packetLoss) : null;
    if (!Number.isFinite(loss)) return sum;
    return sum + PACKETS_PER_SAMPLE * (loss / 100);
  }, 0);
  const totalReceived = Math.max(0, totalSent - totalLost);

  return {
    averageLoss,
    maxLoss,
    downEvents,
    totalSamples: history.length,
    totalPacketsSent: totalSent,
    totalPacketsLost: totalLost,
    totalPacketsReceived: totalReceived
  };
};

// Simple Sparkline Component
const SimpleSparkline = ({ data, width, height, color, theme }) => {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={withAlpha(theme.borderLight, 0.3)} strokeWidth="1" />
      </svg>
    );
  }

  const values = data.filter(v => Number.isFinite(v) && v > 0);
  if (values.length === 0) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={withAlpha(theme.borderLight, 0.3)} strokeWidth="1" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const NocLatencyGraph = ({ history, theme, strokeWidth = 0.8 }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const dataPoints = useMemo(() => {
    if (!Array.isArray(history)) return [];

    return history.reduce((acc, point, index) => {
      if (!point) return acc;

      const rawLatency = point.latency ?? point.latencyMs ?? point.value ?? null;
      const value = Number(rawLatency);
      if (!Number.isFinite(value)) return acc;

      const rawTimestamp = point.timestamp ?? point.sampleTime ?? point.time ?? point.collectedAt ?? point.createdAt ?? null;
      let timestamp = null;
      if (rawTimestamp !== null && rawTimestamp !== undefined) {
        if (typeof rawTimestamp === 'number') {
          timestamp = Number.isFinite(rawTimestamp) ? rawTimestamp : null;
        } else {
          const parsed = Date.parse(rawTimestamp);
          timestamp = Number.isFinite(parsed) ? parsed : null;
        }
      }

      acc.push({ value, timestamp, rawTimestamp, original: point, index });
      return acc;
    }, []);
  }, [history]);

  const latencies = useMemo(() => dataPoints.map(point => point.value), [dataPoints]);
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    if (hoverIndex !== null && (hoverIndex >= dataPoints.length || dataPoints.length === 0)) {
      setHoverIndex(dataPoints.length > 0 ? dataPoints.length - 1 : null);
    }
  }, [dataPoints.length, hoverIndex]);

  const gradientId = useMemo(() => `noc-latency-${Math.random().toString(36).slice(2, 8)}`, []);
  const areaFill = withAlpha(theme.primary, 0.18);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(0, rect.width);
      const height = Math.max(0, rect.height);
      setDimensions(prev => (
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height }
      ));
    };

    measure();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        setDimensions(prev => {
          const nextWidth = Math.max(0, width);
          const nextHeight = Math.max(0, height);
          return Math.abs(prev.width - nextWidth) < 0.5 && Math.abs(prev.height - nextHeight) < 0.5
            ? prev
            : { width: nextWidth, height: nextHeight };
        });
      });
      observer.observe(element);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    return undefined;
  }, []);

  const graphWidth = Math.max(0, dimensions.width);
  const graphHeight = Math.max(0, dimensions.height);
  const hasSamples = latencies.length > 0;
  const hasGraph = latencies.length >= 2;

  const paddingX = Math.max(12, graphWidth * 0.05);
  const paddingY = Math.max(12, graphHeight * 0.12);
  const drawableWidth = Math.max(1, graphWidth - paddingX * 2);
  const drawableHeight = Math.max(1, graphHeight - paddingY * 2);

  const min = hasSamples ? Math.min(...latencies) : 0;
  const max = hasSamples ? Math.max(...latencies) : 0;
  const range = max - min || 1;

  const points = useMemo(() => {
    if (!hasSamples) return [];

    return latencies.map((value, index) => {
      const ratio = latencies.length === 1 ? 0 : index / (latencies.length - 1);
      const x = paddingX + ratio * drawableWidth;
      const y = paddingY + (1 - (value - min) / range) * drawableHeight;
      return { x, y, value };
    });
  }, [latencies, hasSamples, paddingX, drawableWidth, paddingY, drawableHeight, min, range]);

  const updateHover = useCallback((clientX, currentTarget) => {
    if (!points.length || !currentTarget || !graphWidth) return;
    const rect = currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const svgX = ((clientX - rect.left) / rect.width) * graphWidth;
    if (!Number.isFinite(svgX)) return;

    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const distance = Math.abs(points[i].x - svgX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    setHoverIndex(prev => (prev === nearestIndex ? prev : nearestIndex));
  }, [graphWidth, points]);

  const handleMouseMove = useCallback((event) => {
    updateHover(event.clientX, event.currentTarget);
  }, [updateHover]);

  const handleTouchMove = useCallback((event) => {
    if (!event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    updateHover(touch.clientX, event.currentTarget);
    event.preventDefault();
  }, [updateHover]);

  const clearHover = useCallback(() => setHoverIndex(null), []);

  const colorForLatency = (value) => {
    const val = Number(value);
    if (!Number.isFinite(val)) {
      return theme.primary;
    }
    if (val < LATENCY_GOOD_THRESHOLD_MS) return theme.success;
    if (val < LATENCY_WARN_THRESHOLD_MS) return theme.warning;
    return theme.danger;
  };

  const segments = useMemo(() => {
    if (points.length === 0) return [];

    const results = [];
    let currentSegment = null;

    points.forEach((point, index) => {
      const color = colorForLatency(point.value);
      const command = `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

      if (!currentSegment) {
        currentSegment = { color, path: command };
        return;
      }

      if (currentSegment.color !== color) {
        results.push(currentSegment);
        const prev = points[Math.max(0, index - 1)];
        currentSegment = {
          color,
          path: `M ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        };
        return;
      }

      currentSegment.path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    });

    if (currentSegment) {
      results.push(currentSegment);
    }

    return results;
  }, [points, theme]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';

    const first = points[0];
    const last = points[points.length - 1];

    return [
      `M ${first.x.toFixed(2)} ${graphHeight - paddingY}`,
      ...points.map(point => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
      `L ${last.x.toFixed(2)} ${graphHeight - paddingY}`,
      'Z'
    ].join(' ');
  }, [points, graphHeight, paddingY]);

  const horizontalGrid = useMemo(() => {
    if (!points.length) return [];

    const lines = Math.min(6, Math.max(3, Math.round(drawableHeight / 28)));
    if (lines <= 1) return [];

    return Array.from({ length: lines }, (_, idx) => {
      const ratio = idx / (lines - 1);
      const y = paddingY + ratio * drawableHeight;
      const value = max - ratio * range;
      return { y, value };
    });
  }, [points.length, drawableHeight, paddingY, max, range]);

  const verticalGrid = useMemo(() => {
    if (!points.length) return [];

    const lines = Math.min(6, Math.max(2, Math.floor(points.length / 16)));
    if (lines <= 1) return [];

    return Array.from({ length: lines }, (_, idx) => {
      const ratio = idx / (lines - 1);
      const x = paddingX + ratio * drawableWidth;
      return { x };
    });
  }, [points.length, paddingX, drawableWidth]);

  const latestPoint = points.length ? points[points.length - 1] : null;
  const latestColor = latestPoint ? colorForLatency(latestPoint.value) : theme.primary;
  const hoveredPoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;
  const hoveredSample = hoverIndex !== null && dataPoints[hoverIndex] ? dataPoints[hoverIndex] : null;
  const hoveredColor = hoveredSample ? colorForLatency(hoveredSample.value) : theme.primary;

  let tooltipLeft = 0;
  let tooltipTop = 0;
  const tooltipWidth = 172;
  const tooltipHeight = 78;
  const availableWidth = graphWidth - 16;
  let tooltipBoxWidth = tooltipWidth;
  if (availableWidth > 0) {
    tooltipBoxWidth = Math.min(tooltipWidth, availableWidth);
    if (availableWidth >= 120) {
      tooltipBoxWidth = Math.max(120, tooltipBoxWidth);
    }
  }

  let tooltipPlacement = 'right';
  let tooltipVerticalPlacement = 'above';

  if (hoveredPoint) {
    const spaceRight = graphWidth - hoveredPoint.x - 12;
    const spaceLeft = hoveredPoint.x - 12;
    const placeRight = spaceRight >= tooltipBoxWidth || spaceRight >= spaceLeft;
    tooltipPlacement = placeRight ? 'right' : 'left';
    if (placeRight) {
      tooltipLeft = Math.min(graphWidth - tooltipBoxWidth - 8, hoveredPoint.x + 12);
    } else {
      tooltipLeft = Math.max(8, hoveredPoint.x - tooltipBoxWidth - 12);
    }

    const minTop = paddingY;
    const maxTop = graphHeight - tooltipHeight - paddingY;

    let preferredTop = hoveredPoint.y - tooltipHeight - 12;
    tooltipVerticalPlacement = 'above';

    if (preferredTop < minTop) {
      tooltipVerticalPlacement = 'below';
      preferredTop = hoveredPoint.y + 12;
    }

    if (tooltipVerticalPlacement === 'below' && preferredTop + tooltipHeight > graphHeight - minTop) {
      tooltipVerticalPlacement = 'above';
      preferredTop = hoveredPoint.y - tooltipHeight - 12;
    }

    if (tooltipVerticalPlacement === 'above' && preferredTop < minTop) {
      preferredTop = minTop;
    }

    if (tooltipVerticalPlacement === 'below' && preferredTop + tooltipHeight > graphHeight - minTop) {
      preferredTop = Math.max(minTop, graphHeight - tooltipHeight - minTop);
    }

    tooltipTop = Math.max(minTop, Math.min(maxTop, preferredTop));
  }

  const tooltipTimestampSource = hoveredSample
    ? (hoveredSample.timestamp ?? hoveredSample.rawTimestamp ?? null)
    : null;

  const tooltipTimeLabel = hoveredSample
    ? (() => {
        if (hoveredSample.timestamp !== null && hoveredSample.timestamp !== undefined) {
          try {
            return new Date(hoveredSample.timestamp).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            });
          } catch (err) {
            return new Date(hoveredSample.timestamp).toUTCString();
          }
        }
        if (hoveredSample.rawTimestamp !== null && hoveredSample.rawTimestamp !== undefined) {
          return String(hoveredSample.rawTimestamp);
        }
        return `Sample #${hoverIndex + 1}`;
      })()
    : '';

  const tooltipRelativeLabel = tooltipTimestampSource !== null && tooltipTimestampSource !== undefined
    ? formatRelativeTime(tooltipTimestampSource)
    : null;

  const tooltipLatencyLabel = hoveredSample
    ? `${Number(hoveredSample.value).toFixed(1).replace(/\.0$/, '')} ms`
    : '';

  const shouldRenderGraph = hasGraph && graphWidth > 0 && graphHeight > 0 && latestPoint;
  const placeholderMessage = hasSamples ? 'Need more latency samples' : 'Awaiting latency samples';

  if (!shouldRenderGraph) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          color: theme.textMuted,
          textAlign: 'center',
          padding: '4px'
        }}
      >
        {placeholderMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg
        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={clearHover}
        onTouchStart={handleTouchMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={clearHover}
        onTouchCancel={clearHover}
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: points.length ? 'crosshair' : 'default'
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaFill} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={graphWidth} height={graphHeight} fill="none" />
        {horizontalGrid.map(({ y }, idx) => (
          <line
            key={`h-${idx}`}
            x1={paddingX}
            x2={graphWidth - paddingX}
            y1={y}
            y2={y}
            stroke={withAlpha(theme.borderLight, 0.55)}
            strokeWidth="0.6"
            strokeDasharray="3 4"
          />
        ))}
        {verticalGrid.map(({ x }, idx) => (
          <line
            key={`v-${idx}`}
            x1={x}
            x2={x}
            y1={paddingY}
            y2={graphHeight - paddingY}
            stroke={withAlpha(theme.borderLight, 0.35)}
            strokeWidth="0.6"
            strokeDasharray="2 6"
          />
        ))}
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {segments.map((segment, idx) => (
          <path
            key={`segment-${idx}`}
            d={segment.path}
            fill="none"
            stroke={segment.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle
          cx={latestPoint.x}
          cy={latestPoint.y}
          r="2.5"
          fill={latestColor}
        />
        {hoveredPoint && (
          <g pointerEvents="none">
            <line
              x1={hoveredPoint.x}
              x2={hoveredPoint.x}
              y1={paddingY}
              y2={graphHeight - paddingY}
              stroke={withAlpha(hoveredColor, 0.55)}
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="3"
              fill={hoveredColor}
              stroke={theme.bg}
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>
      {hoveredPoint && hoveredSample && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipLeft}px`,
            top: `${tooltipTop}px`,
            width: `${tooltipBoxWidth}px`,
            pointerEvents: 'none',
            background: theme.card,
            border: `1px solid ${withAlpha(hoveredColor, 0.65)}`,
            borderRadius: '8px',
            boxShadow: `0 10px 24px ${withAlpha('#000000', 0.25)}`,
            padding: '8px 10px',
            color: theme.text,
            fontSize: '11px',
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            textAlign: tooltipPlacement === 'right' ? 'left' : 'right'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: hoveredColor }}>
            {tooltipLatencyLabel}
          </span>
          {tooltipTimeLabel && (
            <span style={{ color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tooltipTimeLabel}
            </span>
          )}
          {tooltipRelativeLabel && (
            <span style={{ color: theme.textMuted, fontSize: '10px' }}>
              {tooltipRelativeLabel}
            </span>
          )}
          <span style={{ color: theme.textMuted, fontSize: '9px' }}>
            Sample {hoverIndex + 1} / {dataPoints.length}
          </span>
        </div>
      )}
    </div>
  );
};

const GridView = ({
  groupedSites, expandedGroups, toggleGroup, selectedSites, toggleSiteSelection,
  metricsData, metricsHistory, snmpData, apiData,
  alerts, acknowledgedAlerts, getSiteStatus, setSelectedSite,
  setEditingSite, deleteSite, cardMenuOpen, setCardMenuOpen,
  cardActiveTabs, setCardActiveTabs, theme, loadingState
}) => {
  const totalSites = Object.values(groupedSites).reduce((sum, list) => sum + list.length, 0);
  const MAX_ROWS = 5;
  const MAX_COLUMNS = 8;
  const CARD_MIN_WIDTH = 220;

  const computeGridShape = (count) => {
    if (count <= 0) {
      return { columns: 1, rows: 1 };
    }

    let columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    columns = Math.min(columns, MAX_COLUMNS);

    while (Math.ceil(count / columns) > MAX_ROWS && columns < MAX_COLUMNS) {
      columns += 1;
    }

    const rows = Math.max(1, Math.min(MAX_ROWS, Math.ceil(count / columns)));
    return { columns, rows };
  };

  const { columns } = computeGridShape(totalSites);

  const metricGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '4px',
    fontSize: '10px'
  };

  const MetricCell = ({ label, value, valueColor, monospace, span }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        gridColumn: span ? `span ${span}` : undefined,
        minWidth: 0
      }}
    >
      <span style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase' }}>{label}</span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: valueColor || theme.text,
          fontFamily: monospace ? 'monospace' : 'inherit',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {value ?? '-'}
      </span>
    </div>
  );

  const renderTabContent = (tab, context) => {
    const { metrics, snmp, api, latencyHistory, status } = context;

    switch (tab) {
      case 'icmp': {
        const trend = latencyHistory && latencyHistory.length > 0
          ? latencyHistory
          : metrics && metrics.latency !== undefined && metrics.latency !== null
            ? [Number(metrics.latency)]
            : [];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3px, 1%, 6px)', flex: 1, minHeight: 0, height: '100%' }}>
            <div style={{ ...metricGridStyle, flexShrink: 0 }}>
              <MetricCell label="Latency" value={formatLatency(metrics?.latency)} valueColor={status.color} />
              <MetricCell
                label="Packet Loss"
                value={metrics?.packetLoss !== undefined && metrics?.packetLoss !== null ? `${Number(metrics.packetLoss).toFixed(1)}%` : '-'}
                valueColor={metrics?.packetLoss > 5 ? theme.warning : undefined}
              />
              <MetricCell label="Jitter" value={formatLatency(metrics?.jitter)} />
              <MetricCell
                label="Availability"
                value={metrics?.uptime !== undefined && metrics?.uptime !== null ? formatPercent(metrics.uptime, 1) : '-'}
                valueColor={metrics?.uptime !== undefined && metrics?.uptime !== null && metrics.uptime < 99 ? theme.warning : undefined}
              />
              <MetricCell
                label="Path"
                value={metrics?.usingFailover ? 'Failover' : 'Primary'}
                valueColor={metrics?.usingFailover ? theme.warning : theme.textSecondary}
              />
              <MetricCell label="Active IP" value={metrics?.activeIp || '-'} monospace />
            </div>
            <div style={{ padding: 'clamp(2px, 0.8%, 5px)', background: theme.bgSecondary, borderRadius: '6px', flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
              <LatencySpark data={trend} theme={theme} />
            </div>
          </div>
        );
      }
      case 'snmp': {
        const interfaces = ensureArray(snmp?.interfaces)
          .map(item => ({
            ...item,
            throughput: Number(item?.inOctets || 0) + Number(item?.outOctets || 0)
          }))
          .sort((a, b) => b.throughput - a.throughput)
          .slice(0, 3);
        const topInterface = interfaces[0];
        const aggregateThroughput = interfaces.reduce((sum, iface) => sum + (iface.throughput || 0), 0);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3px, 1%, 6px)', flex: 1, minHeight: 0, height: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(4px, 1.5%, 8px)', flexShrink: 0 }}>
              <MetricCell label="CPU" value={snmp?.cpu !== undefined && snmp?.cpu !== null ? formatPercent(snmp.cpu, 0) : '-'} valueColor={snmp?.cpu >= 85 ? theme.warning : undefined} />
              <MetricCell label="Memory" value={snmp?.memory !== undefined && snmp?.memory !== null ? formatPercent(snmp.memory, 0) : '-'} valueColor={snmp?.memory >= 85 ? theme.warning : undefined} />
              <MetricCell label="Interfaces" value={snmp?.activeInterfaces !== undefined && snmp?.totalInterfaces !== undefined ? `${snmp.activeInterfaces}/${snmp.totalInterfaces}` : '-'} />
              <MetricCell label="Errors" value={snmp?.errors !== undefined ? formatNumber(snmp.errors) : '-'} />
              <MetricCell label="Discards" value={snmp?.discards !== undefined ? formatNumber(snmp.discards) : '-'} />
              <MetricCell label="Uptime" value={snmp?.uptime !== undefined ? formatDuration(snmp.uptime) : '-'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'clamp(4px, 1.5%, 8px)', fontSize: 'clamp(8px, 2vw, 11px)', flex: '1 1 auto', minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ padding: 'clamp(3px, 1%, 6px) clamp(4px, 1.5%, 8px)', borderRadius: '6px', background: theme.bgSecondary, display: 'flex', flexDirection: 'column', gap: 'clamp(1px, 0.5%, 4px)', justifyContent: 'center', minHeight: 0 }}>
                <span style={{ fontSize: 'clamp(7px, 1.8vw, 10px)', color: theme.textMuted, textTransform: 'uppercase', lineHeight: 1.2 }}>Top Interface</span>
                {topInterface ? (
                  <>
                    <span style={{ fontSize: 'clamp(9px, 2.2vw, 12px)', fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                      {topInterface.name || `Interface ${topInterface.index ?? 1}`}
                    </span>
                    <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textSecondary, lineHeight: 1.2 }}>
                      {formatBytes(topInterface.throughput, 1)} / {topInterface.status === 'up' ? 'Up' : 'Down'}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, lineHeight: 1.2 }}>No interface data</span>
                )}
              </div>
              <div style={{ padding: 'clamp(3px, 1%, 6px) clamp(4px, 1.5%, 8px)', borderRadius: '6px', background: theme.bgSecondary, display: 'flex', flexDirection: 'column', gap: 'clamp(1px, 0.5%, 4px)', justifyContent: 'center', minHeight: 0 }}>
                <span style={{ fontSize: 'clamp(7px, 1.8vw, 10px)', color: theme.textMuted, textTransform: 'uppercase', lineHeight: 1.2 }}>Aggregate</span>
                <span style={{ fontSize: 'clamp(9px, 2.2vw, 12px)', fontWeight: 600, color: theme.text, lineHeight: 1.3 }}>
                  {formatBytes(aggregateThroughput, 1)}
                </span>
              </div>
            </div>
          </div>
        );
      }
      case 'api': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3px, 1%, 6px)', flex: 1, minHeight: 0, height: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(4px, 1.5%, 8px)', flex: '1 1 auto', minHeight: 0, alignContent: 'start' }}>
              <MetricCell
                label="Status"
                value={(api?.status || 'Unknown').toUpperCase()}
                valueColor={
                  api?.status
                    ? api.status.toLowerCase() === 'online'
                      ? theme.success
                      : api.status.toLowerCase() === 'offline'
                        ? theme.danger
                        : theme.warning
                    : theme.text
                }
              />
              <MetricCell label="Clients" value={api?.clients !== undefined ? formatNumber(api.clients) : '-'} />
              <MetricCell label="Public IP" value={api?.publicIp || '-'} monospace />
              <MetricCell label="Model" value={api?.device?.model || '-'} />
              <MetricCell label="Serial" value={api?.device?.serial || '-'} monospace />
              <MetricCell label="Last Sync" value={formatRelativeTime(api?.timestamp)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px', fontSize: '10px' }}>
              {api?.primaryWan && (
                <div style={{ background: theme.bgSecondary, borderRadius: '6px', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase' }}>WAN 1</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: theme.text }}>{(api.primaryWan.status || 'unknown').toUpperCase()}</span>
                  <span style={{ color: theme.textSecondary }}>{api.primaryWan.ip || '-'}</span>
                  <span style={{ color: theme.textSecondary }}>
                    {api.primaryWan.latencyMs !== undefined && api.primaryWan.latencyMs !== null ? `${api.primaryWan.latencyMs} ms` : 'Latency n/a'}
                  </span>
                </div>
              )}
              {api?.failoverWan && (
                <div style={{ background: theme.bgSecondary, borderRadius: '6px', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase' }}>WAN 2</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: theme.text }}>{(api.failoverWan.status || 'unknown').toUpperCase()}</span>
                  <span style={{ color: theme.textSecondary }}>{api.failoverWan.ip || '-'}</span>
                  <span style={{ color: theme.textSecondary }}>
                    {api.failoverWan.latencyMs !== undefined && api.failoverWan.latencyMs !== null ? `${api.failoverWan.latencyMs} ms` : 'Latency n/a'}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }
      default:
        return <div style={{ fontSize: '10px', color: theme.textMuted }}>No monitoring data</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
      {Object.entries(groupedSites).map(([groupName, groupSites]) => {
        const isExpanded = groupName === 'All Sites' || expandedGroups.has(groupName);
        const { columns: desiredGroupColumns } = computeGridShape(groupSites.length);
        const groupColumns = Math.max(1, Math.min(columns, desiredGroupColumns, groupSites.length || 1));
        const groupRows = Math.max(
          1,
          Math.min(MAX_ROWS, Math.ceil((groupSites.length || 1) / groupColumns))
        );

        return (
          <div
            key={groupName}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flex: isExpanded ? '1 1 auto' : '0 0 auto',
              minHeight: isExpanded ? 0 : 'auto'
            }}
          >
            {groupName !== 'All Sites' && (
              <div
                onClick={() => toggleGroup(groupName)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                {expandedGroups.has(groupName) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {groupName}
                <span style={{ color: theme.textMuted, fontSize: '12px', fontWeight: 400 }}>({groupSites.length})</span>
              </div>
            )}

            {isExpanded && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${groupColumns}, 1fr)`,
                  gridTemplateRows: `repeat(${groupRows}, 1fr)`,
                  gap: '6px',
                  flex: '1 1 auto',
                  minHeight: 0
                }}
              >
                {groupSites.map(site => {
                  const metrics = metricsData[site.id] || {};
                  const snmp = snmpData[site.id] || {};
                const api = apiData[site.id] || {};
                const status = getSiteStatus(site);
                const siteAlerts = alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id));
                const history = ensureArray(metricsHistory[site.id]);
                const latencyHistory = takeLast(
                    history
                      .map(point => (point && Number.isFinite(point.latency) ? Number(point.latency) : null))
                      .filter(value => value !== null),
                    30
                  );

                  const metricsLoading = !!loadingState?.metrics?.[site.id];
                  const snmpLoading = !!loadingState?.snmp?.[site.id];
                  const apiLoading = !!loadingState?.api?.[site.id];
                  const historyLoading = !!loadingState?.history?.[site.id];
                  const hasCardData = Object.keys(metrics).length > 0 ||
                    latencyHistory.length > 0 ||
                    Object.keys(snmp).length > 0 ||
                    Object.keys(api).length > 0;
                  const cardLoading = !hasCardData && (metricsLoading || snmpLoading || apiLoading || historyLoading);

                  const tabButtons = [
                    { key: 'icmp', label: 'ICMP', icon: Wifi, enabled: site.monitoringIcmp },
                    { key: 'snmp', label: 'SNMP', icon: Server, enabled: site.monitoringSnmp },
                    { key: 'api', label: 'API', icon: Globe, enabled: site.monitoringMeraki }
                  ];

                  const storedTab = cardActiveTabs[site.id];
                  const firstEnabledTab = tabButtons.find(tab => tab.enabled)?.key || 'icmp';
                  const canUseStoredTab = tabButtons.some(tab => tab.key === storedTab && tab.enabled);
                  const activeTab = canUseStoredTab ? storedTab : firstEnabledTab;

                  const handleTabChange = (tabKey) => {
                    if (activeTab === tabKey) return;
                    const targetTab = tabButtons.find(tab => tab.key === tabKey);
                    if (!targetTab || !targetTab.enabled) return;
                    setCardActiveTabs(prev => ({ ...prev, [site.id]: tabKey }));
                  };
                  const activeTabConfig = tabButtons.find(tab => tab.key === activeTab && tab.enabled);

                  const chipStyleBase = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 9px',
                    borderRadius: '999px',
                    background: theme.bgSecondary,
                    border: `1px solid ${theme.borderLight}`,
                    color: theme.textSecondary,
                    fontSize: '10px',
                    fontWeight: 600,
                    flexShrink: 1,
                    minWidth: 0,
                    maxWidth: '220px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  };
                  const headerChipData = [];
                  if (site.ip) {
                    headerChipData.push({
                      key: 'chip-ip',
                      label: 'IP',
                      value: site.ip,
                      monospace: true
                    });
                  }
                  if (site.isp) {
                    headerChipData.push({
                      key: 'chip-isp',
                      label: 'ISP',
                      value: site.isp
                    });
                  }
                  if (site.devices) {
                    headerChipData.push({
                      key: 'chip-circuit',
                      label: 'Circuit',
                      value: site.devices
                    });
                  }

                  return (
                    <div
                      key={site.id}
                      style={{
                        position: 'relative',
                        background: theme.card,
                        border: `1px solid ${selectedSites.has(site.id) ? theme.primary : theme.border}`,
                        borderRadius: '8px',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        cursor: 'pointer',
                        minWidth: 0,
                        minHeight: 0,
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                        height: '100%'
                      }}
                      onClick={() => setSelectedSite(site)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = `0 4px 12px ${theme.shadow}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {cardLoading && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: withAlpha(theme.bg, 0.45),
                            pointerEvents: 'none',
                            zIndex: 4
                          }}
                        >
                          <LoadingBar width="65%" height={8} />
                        </div>
                      )}
                      
                      {/* Header Row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                            {site.name}
                          </div>
                          <div style={{ fontSize: '10px', color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {site.customer}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              background: status.bg,
                              color: status.color,
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {status.label}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardMenuOpen(cardMenuOpen === site.id ? null : site.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: theme.textMuted,
                              padding: '2px',
                              cursor: 'pointer'
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </div>

                      {cardMenuOpen === site.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: '40px',
                            right: '10px',
                            background: theme.card,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            boxShadow: `0 12px 24px ${theme.shadow}`,
                            minWidth: '140px',
                            zIndex: 50,
                            overflow: 'hidden'
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSite(site);
                              setCardMenuOpen(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              background: 'transparent',
                              border: 'none',
                              color: theme.text,
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.bgSecondary)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Edit size={14} />
                            Edit Site
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSite(site.id, site.name);
                              setCardMenuOpen(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              background: 'transparent',
                              border: 'none',
                              color: theme.danger,
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              borderTop: `1px solid ${theme.border}`
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dangerBg)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Trash2 size={14} />
                            Delete Site
                          </button>
                        </div>
                      )}

                      {/* Metrics Grid - Prominent */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '8px',
                        padding: '8px',
                        background: theme.bgSecondary,
                        borderRadius: '6px'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '3px', fontWeight: 600 }}>Latency</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: status.color }}>
                            {formatLatency(metrics?.latency)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '3px', fontWeight: 600 }}>Loss</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: metrics?.packetLoss > 5 ? theme.warning : theme.text }}>
                            {metrics?.packetLoss !== undefined && metrics?.packetLoss !== null ? `${Number(metrics.packetLoss).toFixed(1)}%` : '-'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase', marginBottom: '3px', fontWeight: 600 }}>Uptime</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: metrics?.uptime !== undefined && metrics?.uptime !== null && metrics.uptime < 99 ? theme.warning : theme.text }}>
                            {metrics?.uptime !== undefined && metrics?.uptime !== null ? formatPercent(metrics.uptime, 1) : '-'}
                          </div>
                        </div>
                      </div>

                      {/* 3 Line Graphs - Latency, Loss, Uptime */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', height: '80px' }}>
                        {/* Latency Graph */}
                        <div style={{ background: theme.bgSecondary, borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '8px', color: theme.textMuted, textTransform: 'uppercase', fontWeight: 600, textAlign: 'center' }}>Latency</div>
                          <div style={{ flex: 1, minHeight: 0 }}>
                            {latencyHistory && latencyHistory.length > 0 ? (
                              <Sparkline 
                                data={latencyHistory} 
                                color={status.color}
                                theme={theme}
                                showMarker={true}
                                areaOpacity={0.4}
                              />
                            ) : (
                              <div style={{ fontSize: '9px', color: theme.textMuted, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data</div>
                            )}
                          </div>
                        </div>

                        {/* Packet Loss Graph */}
                        <div style={{ background: theme.bgSecondary, borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '8px', color: theme.textMuted, textTransform: 'uppercase', fontWeight: 600, textAlign: 'center' }}>Packet Loss</div>
                          <div style={{ flex: 1, minHeight: 0 }}>
                            {metricsHistory && metricsHistory[site.id] ? (
                              <Sparkline 
                                data={metricsHistory[site.id].map(m => m?.packetLoss ?? null)} 
                                color={metrics?.packetLoss > 5 ? theme.warning : theme.primary}
                                theme={theme}
                                showMarker={true}
                                areaOpacity={0.4}
                                threshold={5}
                              />
                            ) : (
                              <div style={{ fontSize: '9px', color: theme.textMuted, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data</div>
                            )}
                          </div>
                        </div>

                        {/* Uptime Graph */}
                        <div style={{ background: theme.bgSecondary, borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '8px', color: theme.textMuted, textTransform: 'uppercase', fontWeight: 600, textAlign: 'center' }}>Uptime</div>
                          <div style={{ flex: 1, minHeight: 0 }}>
                            {metricsHistory && metricsHistory[site.id] ? (
                              <Sparkline 
                                data={metricsHistory[site.id].map(m => m?.uptime ?? null)} 
                                color={metrics?.uptime < 99 ? theme.warning : theme.success}
                                theme={theme}
                                showMarker={true}
                                areaOpacity={0.4}
                                threshold={99}
                              />
                            ) : (
                              <div style={{ fontSize: '9px', color: theme.textMuted, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tab Buttons - Bottom */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {tabButtons.map(tab => {
                          const Icon = tab.icon;
                          const isEnabled = tab.enabled;
                          const isActive = activeTab === tab.key && isEnabled;
                          return (
                            <button
                              key={tab.key}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isEnabled) return;
                                handleTabChange(tab.key);
                              }}
                              disabled={!isEnabled}
                              title={isEnabled ? `${tab.label} metrics` : `${tab.label} not enabled`}
                              style={{
                                flex: 1,
                                padding: '6px 4px',
                                borderRadius: '4px',
                                border: 'none',
                                fontSize: '9px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                background: isActive ? theme.primary : theme.bgSecondary,
                                color: isActive ? '#fff' : isEnabled ? theme.textSecondary : theme.textMuted,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                cursor: isEnabled ? 'pointer' : 'not-allowed',
                                opacity: isEnabled ? 1 : 0.4
                              }}
                            >
                              <Icon size={11} />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const NOCView = ({
  sites,
  metricsData,
  metricsHistory,
  snmpData,
  apiData,
  extendedHistory,
  ensureHistory,
  theme,
  setSelectedSite,
  cardLatencyWindows,
  setCardLatencyWindows,
  loadingState,
  alerts = [],
  acknowledgedAlerts = new Set(),
  selectedSites = new Set(),
  toggleSiteSelection,
  cardMenuOpen,
  setCardMenuOpen,
  setEditingSite,
  deleteSite
}) => {
  const latencyWindowState = cardLatencyWindows || {};
  const updateLatencyWindow = typeof setCardLatencyWindows === 'function' ? setCardLatencyWindows : () => {};

  useEffect(() => {
    sites.forEach(site => {
      NOC_WINDOWS.forEach(hours => ensureHistory(site.id, hours));
    });
  }, [sites, ensureHistory]);

  const columns = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(sites.length || 1))));
  const rows = Math.max(1, Math.ceil((sites.length || 1) / columns));
  const acknowledgedSet = acknowledgedAlerts instanceof Set ? acknowledgedAlerts : new Set(acknowledgedAlerts || []);
  const selectedSet = selectedSites instanceof Set ? selectedSites : new Set(selectedSites || []);
  const safeSetCardMenuOpen = typeof setCardMenuOpen === 'function' ? setCardMenuOpen : () => {};
  const safeSetEditingSite = typeof setEditingSite === 'function' ? setEditingSite : () => {};
  const safeDeleteSite = typeof deleteSite === 'function' ? deleteSite : () => {};

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: '6px',
      flex: '1 1 auto',
      minHeight: 0,
      overflow: 'hidden',
      padding: '4px'
    }}>
      {sites.map(site => {
        const metrics = metricsData[site.id] || {};
        const snmp = snmpData?.[site.id] || {};
        const api = apiData?.[site.id] || {};
        const status = metrics?.isReachable
          ? { label: 'ONLINE', color: theme.success, bg: theme.successBg }
          : metrics
            ? { label: 'OFFLINE', color: theme.danger, bg: theme.dangerBg }
            : { label: 'UNKNOWN', color: theme.textMuted, bg: theme.bgSecondary };
        const metricsLoading = !!loadingState?.metrics?.[site.id];
        const snmpLoading = !!loadingState?.snmp?.[site.id];
        const apiLoading = !!loadingState?.api?.[site.id];
        const historyLoading = !!loadingState?.history?.[site.id];

        const siteHistory = extendedHistory[site.id] || {};
        const siteAlerts = (alerts || []).filter(alert => alert.siteId === site.id && !acknowledgedSet.has(alert.id));
        const isSelected = selectedSet.has(site.id);

        const windowStats = NOC_WINDOWS.map(hours => {
          const record = siteHistory[hours];
          const isLoading = !record || (!record.data && !record.error);
          const historyData = record?.data || [];
          const stats = computeLossStats(historyData);

          return {
            hours,
            loading: isLoading,
            error: record?.error,
            stats
          };
        });

        const activeLatencyWindow = latencyWindowState[site.id] || NOC_WINDOWS[0];
        const selectedWindow = windowStats.find(entry => entry.hours === activeLatencyWindow) || windowStats[0];
        const selectedStats = selectedWindow?.stats || computeLossStats([]);
        const selectedHistory = siteHistory[activeLatencyWindow]?.data || [];
        const selectedError = Boolean(selectedWindow?.error);
        const selectedLoading = Boolean(selectedWindow?.loading);
        const extendedKey = `${site.id}:${activeLatencyWindow}`;
        const extendedLoading = !!loadingState?.extendedHistory?.[extendedKey];
        const hasMetricsData = Object.keys(metrics).length > 0 || Object.keys(snmp).length > 0 || Object.keys(api).length > 0;
        const tileLoading = !hasMetricsData && (metricsLoading || snmpLoading || apiLoading || historyLoading || extendedLoading);
        const packetsSummary = selectedWindow && !selectedLoading && !selectedError
          ? {
              sent: Math.round(selectedStats.totalPacketsSent || 0),
              received: Math.round(selectedStats.totalPacketsReceived || 0),
              lost: Math.round(selectedStats.totalPacketsLost || 0)
            }
          : null;
        const sentDisplay = (selectedLoading || extendedLoading || !hasMetricsData) ? '—' : selectedError ? 'Error' : packetsSummary ? formatNumber(packetsSummary.sent) : '-';
        const receivedDisplay = (selectedLoading || extendedLoading || !hasMetricsData) ? '—' : selectedError ? 'Error' : packetsSummary ? formatNumber(packetsSummary.received) : '-';
        const lostDisplay = (selectedLoading || extendedLoading || !hasMetricsData) ? '—' : selectedError ? 'Error' : packetsSummary ? formatNumber(Math.round(packetsSummary.lost)) : '-';
        const latencyStats = computeLatencyStats(selectedHistory);
        const lastUpdatedRaw = metrics?._lastUpdated || metrics?.timestamp || selectedHistory[selectedHistory.length - 1]?.timestamp || null;
        const updatedDisplay = lastUpdatedRaw ? formatRelativeTime(lastUpdatedRaw) : 'No recent poll';
        const latencyDisplay = metrics?.latency !== undefined && metrics?.latency !== null ? `${Math.round(metrics.latency)} ms` : '-';
        const lossDisplay = metrics?.packetLoss !== undefined && metrics?.packetLoss !== null ? `${Number(metrics.packetLoss).toFixed(1)}%` : '-';
        const lossColor = metrics?.packetLoss > 1 ? theme.warning : theme.text;
        const handleLatencyWindowChange = (hours) => {
          if (hours === activeLatencyWindow) return;
          updateLatencyWindow(prev => ({ ...prev, [site.id]: hours }));
          ensureHistory(site.id, hours);
        };
        const chipStyleBase = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 9px',
          borderRadius: '999px',
          background: theme.bgSecondary,
          border: `1px solid ${theme.borderLight}`,
          color: theme.textSecondary,
          fontSize: '10px',
          fontWeight: 600,
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '220px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        };
        const headerChipData = [];
        if (site.ip) {
          headerChipData.push({
            key: 'chip-ip',
            label: 'IP',
            value: site.ip,
            monospace: true
          });
        }
        if (site.isp) {
          headerChipData.push({
            key: 'chip-isp',
            label: 'ISP',
            value: site.isp
          });
        }
        if (site.devices) {
          headerChipData.push({
            key: 'chip-circuit',
            label: 'Circuit',
            value: site.devices
          });
        }

        return (
          <div
            key={site.id}
            style={{
              position: 'relative',
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: '9px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              cursor: 'pointer',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
              boxSizing: 'border-box',
              height: '100%'
            }}
            onClick={() => setSelectedSite(site)}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 18px ${theme.shadow}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              {tileLoading && (
                <div
                  style={{
                    position: 'absolute',
                  inset: 0,
                  display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: withAlpha(theme.bg, 0.45),
                    pointerEvents: 'none',
                    zIndex: 5
                  }}
                >
                  <LoadingBar width="60%" height={8} />
                </div>
              )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 2.5%, 12px)', flexWrap: 'wrap', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 2%, 10px)', minWidth: 0, flexShrink: 0 }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(1px, 0.5%, 4px)' }}>
                  <div style={{ fontSize: 'clamp(11px, 2.5vw, 14px)', fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                    {site.name}
                  </div>
                  <div style={{ fontSize: 'clamp(9px, 2vw, 12px)', color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                    {site.customer}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(3px, 1.5%, 8px)', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
                {headerChipData.map(chip => {
                  const IconComponent = chip.icon;
                  return (
                    <span
                      key={chip.key}
                      style={{
                        ...chipStyleBase,
                        color: chip.monospace ? theme.text : theme.textSecondary
                      }}
                    >
                      {chip.label && (
                        <span style={{ fontSize: 'clamp(7px, 1.8vw, 10px)', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>
                          {chip.label}
                        </span>
                      )}
                      {IconComponent && (
                        <IconComponent size={Math.max(9, Math.min(14, window.innerWidth / 100))} style={{ flex: '0 0 auto', color: theme.textSecondary }} />
                      )}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontFamily: chip.monospace ? 'monospace' : 'inherit'
                        }}
                      >
                        {chip.value}
                      </span>
                    </span>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'clamp(3px, 1.5%, 8px)', minWidth: 0, marginLeft: 'auto', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(3px, 1.5%, 8px)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      background: status.bg,
                      color: status.color,
                      padding: 'clamp(2px, 0.8%, 5px) clamp(5px, 2%, 10px)',
                      borderRadius: '999px',
                      fontSize: 'clamp(8px, 2vw, 11px)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {status.label}
                  </div>
                  {siteAlerts.length > 0 && (
                    <div
                      style={{
                        background: siteAlerts.some(a => a.severity === 'critical') ? theme.danger : theme.warning,
                        color: '#fff',
                        padding: 'clamp(2px, 0.8%, 5px) clamp(4px, 1.5%, 8px)',
                        borderRadius: '999px',
                        fontSize: 'clamp(8px, 2vw, 11px)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}
                      title={`${siteAlerts.length} active alert${siteAlerts.length > 1 ? 's' : ''}`}
                    >
                      {siteAlerts.length}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      safeSetCardMenuOpen(cardMenuOpen === site.id ? null : site.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.textMuted,
                      padding: 'clamp(2px, 1%, 6px)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    title="Site actions"
                  >
                    <MoreVertical size={Math.max(12, Math.min(18, window.innerWidth / 80))} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(2px, 1%, 6px)', color: theme.textSecondary }}>
                  {site.monitoringIcmp && <Wifi size={Math.max(10, Math.min(14, window.innerWidth / 100))} />}
                  {site.monitoringSnmp && <Server size={Math.max(10, Math.min(14, window.innerWidth / 100))} />}
                  {site.monitoringMeraki && <Globe size={Math.max(10, Math.min(14, window.innerWidth / 100))} />}
                </div>
              </div>
            </div>

            {cardMenuOpen === site.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '46px',
                  right: '18px',
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  boxShadow: `0 12px 24px ${theme.shadow}`,
                  minWidth: '180px',
                  zIndex: 50
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    safeSetEditingSite(site);
                    safeSetCardMenuOpen(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: theme.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.bgSecondary)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Edit size={14} />
                  Edit Site
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    safeDeleteSite(site.id, site.name);
                    safeSetCardMenuOpen(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: theme.danger,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    borderTop: `1px solid ${theme.border}`
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.dangerBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 size={14} />
                  Delete Site
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    NOC_WINDOWS.forEach(hours => ensureHistory(site.id, hours, { force: true }));
                    safeSetCardMenuOpen(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: theme.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    borderTop: `1px solid ${theme.border}`
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.bgSecondary)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <RefreshCw size={14} />
                  Refresh History
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(4px, 1.5%, 8px)', fontSize: 'clamp(9px, 2.2vw, 12px)', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.8%, 5px)', minWidth: 0, justifyContent: 'center' }}>
                <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, fontWeight: 500 }}>Latency</span>
                <span style={{ fontSize: 'clamp(11px, 2.5vw, 14px)', fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                  {latencyDisplay}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.8%, 5px)', minWidth: 0, justifyContent: 'center' }}>
                <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, fontWeight: 500 }}>Current Loss</span>
                <span style={{ fontSize: 'clamp(11px, 2.5vw, 14px)', fontWeight: 600, color: lossColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                  {lossDisplay}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.8%, 5px)', minWidth: 0, justifyContent: 'center' }}>
                <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, fontWeight: 500 }}>Updated</span>
                <span style={{ fontSize: 'clamp(10px, 2.3vw, 13px)', fontWeight: 600, color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                  {updatedDisplay}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(4px, 1.5%, 8px)', fontSize: 'clamp(9px, 2.2vw, 12px)', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.8%, 5px)', minWidth: 0, justifyContent: 'center' }}>
                <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, fontWeight: 500 }}>Sent</span>
                <span style={{ fontSize: 'clamp(11px, 2.5vw, 14px)', fontWeight: 600, color: theme.text, lineHeight: 1.3 }}>{sentDisplay}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.8%, 5px)', minWidth: 0, justifyContent: 'center' }}>
                <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, fontWeight: 500 }}>Received</span>
                <span style={{ fontSize: 'clamp(11px, 2.5vw, 14px)', fontWeight: 600, color: theme.text, lineHeight: 1.3 }}>{receivedDisplay}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(2px, 0.8%, 5px)', minWidth: 0, justifyContent: 'center' }}>
                <span style={{ fontSize: 'clamp(8px, 2vw, 11px)', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, fontWeight: 500 }}>Lost</span>
                <span style={{ fontSize: 'clamp(11px, 2.5vw, 14px)', fontWeight: 600, color: packetsSummary && packetsSummary.lost > 0 ? theme.warning : theme.text, lineHeight: 1.3 }}>{lostDisplay}</span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                gap: 'clamp(4px, 1.5%, 8px)',
                alignItems: 'stretch',
                height: 'clamp(80px, 15vh, 120px)',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  background: theme.bgSecondary,
                  borderRadius: '6px',
                  padding: 'clamp(3px, 1%, 6px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'clamp(2px, 0.8%, 5px)',
                  minHeight: 0,
                  flex: 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'clamp(8px, 2vw, 10px)', color: theme.textSecondary, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: theme.text, fontWeight: 600, letterSpacing: '0.03em' }}>Latency Trend</span>
                    {/* Sparklines for each time window */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {windowStats.map(({ hours }) => {
                        const windowHistory = hours === 12 ? metricsHistory[site.id] :
                          (extendedHistory && extendedHistory[hours] && extendedHistory[hours].data) || [];
                        const sparkData = Array.isArray(windowHistory) ? windowHistory.slice(-20).map(p => p?.latency || 0) : [];
                        const isActive = hours === activeLatencyWindow;

                        return (
                          <div
                            key={`sparkline-${hours}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              opacity: isActive ? 1 : 0.5,
                              cursor: 'pointer',
                              transition: 'opacity 0.2s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLatencyWindowChange(hours);
                            }}
                            title={`View ${hours}-hour latency`}
                          >
                            <SimpleSparkline data={sparkData} width={28} height={12} color={isActive ? theme.primary : theme.borderLight} theme={theme} />
                            <span style={{ fontSize: '8px', marginTop: '1px', color: isActive ? theme.primary : theme.textMuted }}>{hours}h</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ opacity: 0.75 }}>
                      {(selectedLoading || extendedLoading) ? '' : `${activeLatencyWindow}h | ${latencyStats.sampleCount} pts`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {NOC_WINDOWS.map(hours => {
                        const isActive = hours === activeLatencyWindow;
                        return (
                          <button
                            key={`latency-dot-${hours}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLatencyWindowChange(hours);
                            }}
                            title={`View ${hours}-hour latency`}
                            style={{
                              width: isActive ? 10 : 7,
                              height: isActive ? 10 : 7,
                              borderRadius: '999px',
                              border: 'none',
                              padding: 0,
                              background: isActive ? theme.primary : theme.borderLight,
                              boxShadow: isActive ? `0 0 0 2px ${withAlpha(theme.primary, 0.25)}` : 'none',
                              opacity: isActive ? 1 : 0.6,
                              cursor: 'pointer'
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ flex: '1 1 auto', minHeight: '80px' }}>
                  <NocLatencyGraph history={selectedHistory} theme={theme} strokeWidth={0.8} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '4px', fontSize: '9px', color: theme.textSecondary }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    Min <strong style={{ color: theme.text }}>{latencyStats.min !== null ? `${Math.round(latencyStats.min)} ms` : '-'}</strong>
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    Avg <strong style={{ color: theme.text }}>{latencyStats.average !== null ? `${Math.round(latencyStats.average)} ms` : '-'}</strong>
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    P95 <strong style={{ color: theme.text }}>{latencyStats.p95 !== null ? `${Math.round(latencyStats.p95)} ms` : '-'}</strong>
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                    Max <strong style={{ color: theme.text }}>{latencyStats.max !== null ? `${Math.round(latencyStats.max)} ms` : '-'}</strong>
                  </span>
                </div>
              </div>
              <div
                style={{
                  background: theme.bgSecondary,
                  borderRadius: '6px',
                  padding: '6px 7px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  minHeight: 0
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: '9px', color: theme.text, fontWeight: 600, letterSpacing: 0.2 }}>Loss Overview</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'visible', paddingRight: 0 }}>
                  {windowStats.map(({ hours, loading, error, stats }, idx) => {
                    const isActive = hours === activeLatencyWindow;
                    return (
                    <div
                      key={`${site.id}-${hours}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(56px, auto) repeat(3, minmax(0, 1fr))',
                        gap: '4px',
                        fontSize: '9px',
                        alignItems: 'center',
                        padding: '4px 6px',
                        borderBottom: idx === windowStats.length - 1 ? 'none' : `1px solid ${withAlpha(theme.borderLight, 0.35)}`,
                        background: isActive ? withAlpha(theme.primary, 0.12) : 'transparent',
                        borderRadius: isActive ? '6px' : '0',
                        minWidth: 0,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ color: theme.textSecondary, minWidth: 0, lineHeight: 1.3 }}>
                        <strong style={{ color: theme.text }}>{hours}h</strong>
                        {loading ? (
                          <div style={{ marginTop: '4px' }}>
                            <LoadingBar width="60px" height={4} />
                          </div>
                        ) : (
                          <div style={{ fontSize: '9px' }}>{error ? 'Error' : `${stats.totalSamples} pts`}</div>
                        )}
                      </div>
                      <div style={{ color: theme.textSecondary, whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, lineHeight: 1.3 }}>
                        Avg <strong style={{ color: theme.text }}>
                          {loading ? '--' : (stats.averageLoss !== null ? `${stats.averageLoss.toFixed(1)}%` : '-')}
                        </strong>
                      </div>
                      <div style={{ color: theme.textSecondary, whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, lineHeight: 1.3 }}>
                        Max <strong style={{ color: theme.text }}>
                          {loading ? '--' : (stats.maxLoss !== null ? `${stats.maxLoss.toFixed(1)}%` : '-')}
                        </strong>
                      </div>
                      <div style={{ color: theme.textSecondary, whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, lineHeight: 1.3 }}>
                        Down <strong style={{ color: stats.downEvents > 0 ? theme.danger : theme.text }}>
                          {loading ? '--' : stats.downEvents}
                        </strong>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {sites.length === 0 && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '16px',
          background: theme.bgSecondary,
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '13px',
          color: theme.textSecondary
        }}>
          No sites match the current filters.
        </div>
      )}
    </div>
  );
};

// Map View Component
const MapView = ({ sites, metricsData, getSiteStatus, setSelectedSite, setEditingSite, theme }) => {
  const mapRef = useRef(null);
  const markerIconCache = useRef({});
  const geocodeCache = useRef({});
  const safeSetEditingSite = typeof setEditingSite === 'function' ? setEditingSite : null;
  const [markers, setMarkers] = useState([]);
  const [markersLoading, setMarkersLoading] = useState(false);

  const sanitize = useCallback((value) => (
    String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char] || char))
  ), []);

  const geocodeAddress = useCallback(async (address) => {
    if (!address) return null;
    const cached = geocodeCache.current[address];
    if (cached !== undefined) {
      return cached;
    }
    try {
      const response = await authFetch(`/api/geocode?address=${encodeURIComponent(address)}`, {
        headers: {
          Accept: 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Geocode failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
        const result = { latitude: data.latitude, longitude: data.longitude };
        geocodeCache.current[address] = result;
        return result;
      }
    } catch (err) {
      console.error('Geocode error:', err);
    }
    geocodeCache.current[address] = null;
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveMarkers = async () => {
      setMarkersLoading(true);
      const resolved = [];

      for (const site of sites) {
        if (cancelled) break;

        const status = getSiteStatus(site);
        const metrics = metricsData[site.id] || {};

        let lat = site?.latitude !== undefined ? Number(site.latitude) : NaN;
        let lng = site?.longitude !== undefined ? Number(site.longitude) : NaN;
        const initialValid = Number.isFinite(lat) && Number.isFinite(lng);

        const address = site?.location || site?.address || '';
        if (address) {
          const geocoded = await geocodeAddress(address);
          if (geocoded) {
            const diffLat = Math.abs((lat || 0) - geocoded.latitude);
            const diffLng = Math.abs((lng || 0) - geocoded.longitude);
            const needsUpdate = !initialValid || diffLat > 0.0003 || diffLng > 0.0003;
            if (needsUpdate) {
              lat = geocoded.latitude;
              lng = geocoded.longitude;
            }
            // small delay to keep Nominatim happy when batch geocoding
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          continue;
        }

        resolved.push({
          site,
          lat,
          lng,
          status,
          metrics
        });
      }

      if (!cancelled) {
        setMarkers(resolved);
        setMarkersLoading(false);
      }
    };

    resolveMarkers();

    return () => {
      cancelled = true;
      setMarkersLoading(false);
    };
  }, [sites, metricsData, getSiteStatus, geocodeAddress]);

  const getMarkerIcon = useCallback((marker) => {
    const { site, status } = marker;
    const color = status?.color || theme.primary;
    const companyName = site.customer || site.name || site.ip || 'Site';
    const markerTitle = sanitize(site.name || companyName);
    const alphanumeric = (companyName || '').replace(/[^A-Za-z0-9]/g, '');
    const abbreviationRaw = (alphanumeric || companyName || '').slice(0, 3).toUpperCase() || '???';
    const abbreviation = sanitize(abbreviationRaw);
    const cacheKey = `${site.id}-${color}-${abbreviation}`;
    if (!markerIconCache.current[cacheKey]) {
      markerIconCache.current[cacheKey] = L.divIcon({
        className: '',
        iconAnchor: [17, 34],
        popupAnchor: [0, -40],
        html: `
          <div style="
            position:relative;
            width:34px;
            pointer-events:auto;
            cursor:pointer;
          ">
            <div style="
              width:34px;
              height:34px;
              border-radius:999px;
              background:#fff;
              border:3px solid ${color};
              display:flex;
              align-items:center;
              justify-content:center;
              font-weight:700;
              font-size:12px;
              color:#111;
              box-shadow:0 8px 14px ${withAlpha('#000000', 0.3)};
            ">
              ${abbreviation}
            </div>
            <div style="
              position:absolute;
              top:38px;
              left:50%;
              transform:translateX(-50%);
              background:#fff;
              color:#111;
              border:1px solid ${withAlpha(color, 0.35)};
              border-radius:8px;
              padding:2px 8px;
              font-size:11px;
              font-weight:600;
              white-space:nowrap;
              max-width:200px;
              overflow:hidden;
              text-overflow:ellipsis;
              box-shadow:0 6px 12px ${withAlpha('#000000', 0.25)};
            " title="${markerTitle}">
              ${markerTitle}
            </div>
          </div>
        `
      });
    }
    return markerIconCache.current[cacheKey];
  }, [sanitize, theme]);

  useEffect(() => {
    if (!mapRef.current || markers.length === 0) return;
    const map = mapRef.current;
    map.invalidateSize();

    if (markers.length === 1) {
      const single = markers[0];
      map.setView([single.lat, single.lng], 16);
      return;
    }

    const bounds = L.latLngBounds(markers.map(marker => [marker.lat, marker.lng]));
    if (!bounds.isValid()) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const distance = L.latLng(ne).distanceTo(sw);

    if (distance < 5000) {
      map.setView(bounds.getCenter(), 16);
    } else {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    }
  }, [markers]);

  const renderMap = markers.length > 0;

  return (
    <div style={{
      background: theme.card,
      border: `1px solid ${theme.border}`,
      borderRadius: '10px',
      flex: '1 1 auto',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
        {renderMap ? (
          <MapContainer
            center={[markers[0]?.lat || 37.8, markers[0]?.lng || -96]}
            zoom={markers.length === 1 ? 16 : 6}
            minZoom={2}
            maxZoom={18}
            scrollWheelZoom
            zoomControl={false}
            attributionControl={false}
            whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {markers.map(marker => (
              <Marker
                key={marker.site.id}
                position={[marker.lat, marker.lng]}
                icon={getMarkerIcon(marker)}
              >
                <Popup>
                  <div style={{ minWidth: '180px', color: '#111', position: 'relative', paddingRight: safeSetEditingSite ? '38px' : '0' }}>
                    {safeSetEditingSite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          safeSetEditingSite(marker.site);
                        }}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: '#f3f4f6',
                          border: '1px solid rgba(17, 24, 39, 0.12)',
                          color: '#111',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                        }}
                      >
                        Edit
                      </button>
                    )}
                    <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>{marker.site.name}</div>
                    <div style={{ fontSize: '11px', color: '#444', marginBottom: '6px' }}>{marker.site.customer}</div>
                    <div style={{ fontSize: '11px' }}>
                      <strong>IP:</strong> {marker.site.ip || 'n/a'}
                    </div>
                    {marker.site.failoverIp && (
                      <div style={{ fontSize: '11px' }}>
                        <strong>Failover:</strong> {marker.site.failoverIp}
                      </div>
                    )}
                    {marker.metrics?.latency !== undefined && marker.metrics?.latency !== null && (
                      <div style={{ fontSize: '11px' }}>
                        <strong>Latency:</strong> {Math.round(marker.metrics.latency)} ms
                      </div>
                    )}
                    {marker.metrics?.packetLoss !== undefined && marker.metrics?.packetLoss !== null && (
                      <div style={{ fontSize: '11px' }}>
                        <strong>Loss:</strong> {Number(marker.metrics.packetLoss).toFixed(1)}%
                      </div>
                    )}
                    {marker.site.location && (
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '6px' }}>
                        {marker.site.location}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          !markersLoading && (
            <div style={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '32px',
              color: theme.textSecondary,
              textAlign: 'center'
            }}>
              <MapPin size={40} color={theme.textMuted} />
              <div style={{ fontSize: '14px', color: theme.text }}>No geocoded sites yet</div>
              <div style={{ fontSize: '12px' }}>
                Add latitude and longitude to your sites to project them here.
              </div>
            </div>
          )
        )}

        {renderMap && (
          <div style={{
            position: 'absolute',
            right: '12px',
            bottom: '10px',
            fontSize: '9px',
            color: '#111',
            background: 'rgba(255,255,255,0.85)',
            padding: '2px 6px',
            borderRadius: '4px',
            boxShadow: `0 2px 6px ${withAlpha('#000000', 0.25)}`,
            zIndex: 10
          }}>
            © OpenStreetMap contributors
          </div>
        )}

        {markersLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 15,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: withAlpha(theme.bg, 0.6)
          }}>
            <LoadingBar width="120px" height={8} />
            <span style={{ fontSize: '11px', color: theme.textSecondary }}>Loading map data…</span>
          </div>
        )}
      </div>
    </div>
  );
};

export {
  TableView,
  GridView,
  NOCView,
  MapView,
  Sparkline,
  LatencySpark,
  computeLatencyStats,
  computeLossStats,
  NocLatencyGraph
};
