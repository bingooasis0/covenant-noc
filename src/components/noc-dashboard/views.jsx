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
import { DetailedGridCard, CompactNOCCard } from './cards';
import NOCCard from './NOCCard';
import SlideOver from '../SlideOver';
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
export const TableView = ({
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

  const sanitizeColumnSelection = useCallback((input) => {
    const initial = Array.isArray(input) ? input : [];
    const merged = new Set(REQUIRED_TABLE_COLUMNS);
    initial.forEach((columnId) => {
      if (ALL_TABLE_COLUMNS.includes(columnId)) {
        merged.add(columnId);
      }
    });
    const ordered = ALL_TABLE_COLUMNS.filter((columnId) => merged.has(columnId));
    return ordered.length ? ordered : DEFAULT_TABLE_COLUMNS.slice();
  }, []);

  const loadStoredColumns = useCallback(() => {
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
  }, [sanitizeColumnSelection]);


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
        return sanitizeColumnSelection(remaining);
      }
      return sanitizeColumnSelection([...previous, columnId]);
    });
  }, [sanitizeColumnSelection]);

  const resetColumns = useCallback(() => {
    setVisibleColumns(sanitizeColumnSelection(DEFAULT_TABLE_COLUMNS));
  }, [sanitizeColumnSelection]);

  const enableAllColumns = useCallback(() => {
    setVisibleColumns(sanitizeColumnSelection(ALL_TABLE_COLUMNS));
  }, [sanitizeColumnSelection]);

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      fontSize: '14px'
    }}>
      {/* Column selector toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', position: 'relative' }}>
        <button
          onClick={() => setColumnSelectorOpen(!columnSelectorOpen)}
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
          <SlidersHorizontal size={14} />
          Columns
        </button>

        {columnSelectorOpen && (
          <div
            ref={columnSelectorRef}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              boxShadow: `0 4px 12px ${theme.shadow}`,
              zIndex: 1000,
              width: '220px',
              padding: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button
                onClick={resetColumns}
                style={{ fontSize: '11px', color: theme.primary, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset Default
              </button>
              <button
                onClick={enableAllColumns}
                style={{ fontSize: '11px', color: theme.primary, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Show All
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ALL_TABLE_COLUMNS.map(col => (
                <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col)}
                    onChange={() => handleColumnToggle(col)}
                    disabled={REQUIRED_TABLE_COLUMNS.includes(col)}
                  />
                  <span style={{ textTransform: 'capitalize' }}>
                    {col.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: visibleColumns.map(col => {
          if (col === 'status') return '40px';
          if (col === 'actions') return '40px';
          if (col === 'monitoring') return '120px';
          if (col === 'alerts') return '60px';
          return '1fr';
        }).join(' '),
        gap: '16px',
        padding: '12px 16px',
        background: theme.bgSecondary,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        borderBottom: `1px solid ${theme.border}`,
        fontWeight: 600,
        color: theme.textSecondary,
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        {visibleColumns.map(col => {
          if (col === 'actions') return <div key={col}></div>;
          return (
            <div
              key={col}
              onClick={() => handleSort(col)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}
            >
              {col.replace(/([A-Z])/g, ' $1').trim()}
              <SortIcon field={col} />
            </div>
          );
        })}
      </div>

      {/* Table Body */}
      {filteredSites.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted }}>
          No sites match your filters
        </div>
      ) : (
        filteredSites.map(site => {
          const metrics = metricsData[site.id];
          const api = apiData[site.id];
          const status = getSiteStatus(site);
          const isSelected = selectedSites.has(site.id);
          const siteAlerts = alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id));

          return (
            <div
              key={site.id}
              style={{
                display: 'grid',
                gridTemplateColumns: visibleColumns.map(col => {
                  if (col === 'status') return '40px';
                  if (col === 'actions') return '40px';
                  if (col === 'monitoring') return '120px';
                  if (col === 'alerts') return '60px';
                  return '1fr';
                }).join(' '),
                gap: '16px',
                padding: '12px 16px',
                background: theme.card,
                borderBottom: `1px solid ${theme.border}`,
                alignItems: 'center',
                fontSize: '13px'
              }}
            >
              {visibleColumns.map(col => {
                switch (col) {
                  case 'status':
                    return (
                      <div key={col} style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: status.color
                        }} />
                      </div>
                    );
                  case 'name':
                    return (
                      <div key={col} style={{ fontWeight: 500, color: theme.text, cursor: 'pointer' }} onClick={() => safeSetSelectedSite(site)}>
                        {site.name}
                      </div>
                    );
                  case 'customer':
                    return <div key={col} style={{ color: theme.textSecondary }}>{site.customer}</div>;
                  case 'ip':
                    return <div key={col} style={{ fontFamily: 'monospace', color: theme.textSecondary }}>{site.ip}</div>;
                  case 'location':
                    return <div key={col} style={{ color: theme.textSecondary }}>{site.location || '-'}</div>;
                  case 'latency':
                    return (
                      <div key={col} style={{
                        fontFamily: 'monospace',
                        color: !metrics ? theme.textMuted :
                          metrics.latency > LATENCY_WARN_THRESHOLD_MS ? theme.warning : theme.success
                      }}>
                        {formatLatency(metrics?.latency)}
                      </div>
                    );
                  case 'packetLoss':
                    return (
                      <div key={col} style={{
                        fontFamily: 'monospace',
                        color: !metrics ? theme.textMuted :
                          metrics.packetLoss > 0 ? theme.danger : theme.success
                      }}>
                        {metrics?.packetLoss !== undefined && metrics?.packetLoss !== null ? `${Number(metrics.packetLoss).toFixed(1)}%` : '-'}
                      </div>
                    );
                  case 'uptime':
                    return (
                      <div key={col} style={{ fontFamily: 'monospace' }}>
                        {metrics?.uptime !== undefined && metrics?.uptime !== null ? formatPercent(metrics.uptime, 1) : '-'}
                      </div>
                    );
                  case 'lastCheck':
                    return <div key={col} style={{ color: theme.textMuted, fontSize: '12px' }}>{formatRelativeTime(metrics?._lastUpdated)}</div>;
                  case 'monitoring':
                    return (
                      <div key={col} style={{ display: 'flex', gap: '4px' }}>
                        {site.monitoringIcmp && (
                          <div title="ICMP Monitoring" style={{ padding: '2px', borderRadius: '4px', background: metrics ? theme.successBg : theme.card }}>
                            <Activity size={14} color={metrics ? theme.success : theme.textMuted} />
                          </div>
                        )}
                        {site.monitoringSnmp && (
                          <div title="SNMP Monitoring" style={{ padding: '2px', borderRadius: '4px', background: snmpData[site.id] ? theme.infoBg : theme.card }}>
                            <Server size={14} color={snmpData[site.id] ? theme.info : theme.textMuted} />
                          </div>
                        )}
                        {site.monitoringMeraki && (
                          <div title="Meraki API" style={{ padding: '2px', borderRadius: '4px', background: api ? theme.successBg : theme.card }}>
                            <Globe size={14} color={api ? theme.success : theme.textMuted} />
                          </div>
                        )}
                      </div>
                    );
                  case 'alerts':
                    return (
                      <div key={col}>
                        {siteAlerts.length > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: theme.danger,
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            <AlertTriangle size={14} />
                            {siteAlerts.length}
                          </div>
                        )}
                      </div>
                    );
                  case 'actions':
                    return (
                      <div key={col} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => safeSetEditingSite(site)}
                          style={{
                            padding: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: theme.textMuted,
                            cursor: 'pointer'
                          }}
                        >
                          <Edit size={14} />
                        </button>
                      </div>
                    );
                  default:
                    return <div key={col}></div>;
                }
              })}
            </div>
          );
        })
      )}
    </div>
  );
};

// Grid View Component (Detailed "Screenshot" Style)
export const GridView = ({
  groupedSites,
  expandedGroups,
  toggleGroup,
  selectedSites,
  toggleSiteSelection,
  metricsData,
  metricsHistory,
  snmpData,
  apiData,
  alerts,
  acknowledgedAlerts,
  getSiteStatus,
  setSelectedSite,
  setEditingSite,
  deleteSite,
  cardMenuOpen,
  setCardMenuOpen,
  cardActiveTabs,
  setCardActiveTabs,
  theme,
  loadingState,
  gridCardLayouts = {},
  isFocusMode = false
}) => {
  const [activeDrillDown, setActiveDrillDown] = useState(null);

  // Flatten sites if in focus mode to show a single unified grid
  const sitesToRender = isFocusMode 
    ? Object.values(groupedSites).flat() 
    : null;

  if (isFocusMode) {
    return (
      <div style={{
        display: 'grid',
        // Auto-fit grid that scales with screen size - larger cards for TV mode
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '24px',
        padding: '24px',
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        background: theme.bg
      }}>
        {sitesToRender.map(site => {
          const siteLayoutData = gridCardLayouts[site.id] || gridCardLayouts['global'];
          const siteLayout = Array.isArray(siteLayoutData) ? siteLayoutData : (siteLayoutData?.layout || null);
          const cardConfig = siteLayoutData?.cardConfig || {};
          
          // Always use DetailedGridCard for focus mode for now, or NOCCard if configured
          // Scaling up the card size
          return (
            <div key={site.id} style={{ transform: 'scale(1)', transformOrigin: 'top left', height: '100%' }}>
               {siteLayout && Array.isArray(siteLayout) && siteLayout.length > 0 ? (
                  <NOCCard
                    site={site}
                    metrics={metricsData[site.id]}
                    history={metricsHistory[site.id]}
                    alerts={alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id))}
                    isSelected={selectedSites.has(site.id)}
                    onClick={(s) => setActiveDrillDown(s)}
                    layout={siteLayout}
                    theme={theme}
                    cardConfig={cardConfig}
                  />
               ) : (
                  <DetailedGridCard
                    site={site}
                    metrics={metricsData[site.id]}
                    history={metricsHistory[site.id]}
                    snmp={snmpData[site.id]}
                    api={apiData[site.id]}
                    alerts={alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id))}
                    isSelected={selectedSites.has(site.id)}
                    onClick={(s) => setActiveDrillDown(s)}
                    theme={theme}
                  />
               )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
        {Object.entries(groupedSites).map(([groupName, groupSites]) => {
          const isExpanded = groupName === 'All Sites' || expandedGroups.has(groupName);

          if (!isExpanded && groupName !== 'All Sites') {
            return (
              <div
                key={groupName}
                onClick={() => toggleGroup(groupName)}
                style={{
                  padding: '8px 12px',
                  background: theme.bgSecondary,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.text
                }}
              >
                <ChevronRight size={16} />
                {groupName}
                <span style={{ color: theme.textMuted, fontWeight: 400 }}>({groupSites.length})</span>
              </div>
            );
          }

          return (
            <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {groupName !== 'All Sites' && (
                <div
                  onClick={() => toggleGroup(groupName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.text,
                    paddingLeft: '4px'
                  }}
                >
                  <ChevronDown size={16} />
                  {groupName}
                  <span style={{ color: theme.textMuted, fontSize: '12px', fontWeight: 400 }}>({groupSites.length})</span>
                </div>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '20px',
              }}>
                {groupSites.map(site => {
                  // Check if there's a custom layout for this site or global
                  const siteLayoutData = gridCardLayouts[site.id] || gridCardLayouts['global'];
                  const siteLayout = Array.isArray(siteLayoutData) ? siteLayoutData : (siteLayoutData?.layout || null);
                  const cardConfig = siteLayoutData?.cardConfig || {};
                  
                  // Use NOCCard if custom layout exists, otherwise use DetailedGridCard
                  if (siteLayout && Array.isArray(siteLayout) && siteLayout.length > 0) {
                    return (
                      <NOCCard
                        key={site.id}
                        site={site}
                        metrics={metricsData[site.id]}
                        history={metricsHistory[site.id]}
                        alerts={alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id))}
                        isSelected={selectedSites.has(site.id)}
                        onClick={(s) => setActiveDrillDown(s)}
                        layout={siteLayout}
                        theme={theme}
                        cardConfig={cardConfig}
                      />
                    );
                  }
                  
                  // Default to DetailedGridCard
                  return (
                    <DetailedGridCard
                      key={site.id}
                      site={site}
                      metrics={metricsData[site.id]}
                      history={metricsHistory[site.id]}
                      snmp={snmpData[site.id]}
                      api={apiData[site.id]}
                      alerts={alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id))}
                      isSelected={selectedSites.has(site.id)}
                      onClick={(s) => setActiveDrillDown(s)}
                      theme={theme}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <SlideOver
        isOpen={!!activeDrillDown}
        site={activeDrillDown}
        onClose={() => setActiveDrillDown(null)}
        onUpdateSite={() => {
          setActiveDrillDown(null);
        }}
      />
    </>
  );
};

// NOC View Component (Compact High-Visibility)
export const NOCView = ({
  sites, metricsData, metricsHistory, snmpData, apiData,
  extendedHistory, ensureHistory, theme, setSelectedSite,
  cardLatencyWindows, setCardLatencyWindows, loadingState,
  alerts, acknowledgedAlerts, selectedSites, toggleSiteSelection,
  cardMenuOpen, setCardMenuOpen, setEditingSite, deleteSite, cardLayout
}) => {
  const [activeDrillDown, setActiveDrillDown] = useState(null);

  // NOC View doesn't strictly respect the grouping from the main dashboard state passed down as 'groupedSites' usually,
  // but here we are receiving flat 'sites'. If we want grouping we'd need that prop.
  // For NOC view, let's keep it flat and dense for now as per "glance up" requirement, 
  // or just use a simple grid.

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: '16px',
        padding: '20px',
        overflowY: 'auto',
        height: '100%'
      }}>
        {sites.map(site => {
          // Support both old format (just layout array) and new format (object with layout and cardConfig)
          const layoutData = Array.isArray(cardLayout) ? cardLayout : (cardLayout?.layout || null);
          const cardConfig = cardLayout?.cardConfig || {};
          
          return (
            <NOCCard
              key={site.id}
              site={site}
              metrics={metricsData[site.id]}
              history={metricsHistory[site.id]}
              alerts={alerts.filter(a => a.siteId === site.id && !acknowledgedAlerts.has(a.id))}
              isSelected={selectedSites.has(site.id)}
              onClick={(s) => setActiveDrillDown(s)}
              layout={layoutData}
              theme={theme}
              cardConfig={cardConfig}
            />
          );
        })}
      </div>

      <SlideOver
        isOpen={!!activeDrillDown}
        site={activeDrillDown}
        onClose={() => setActiveDrillDown(null)}
        onUpdateSite={() => {
          setActiveDrillDown(null);
        }}
      />
    </>
  );
};

// Map View Component
export const MapView = ({
  sites, metricsData, getSiteStatus, setSelectedSite, setEditingSite, theme
}) => {
  const mapRef = useRef(null);

  // Default center (US)
  const defaultCenter = [39.8283, -98.5795];
  const defaultZoom = 4;

  // Fix Leaflet icon issues
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  return (
    <div style={{ height: '100%', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${theme.border}` }}>
      {typeof window !== 'undefined' && (
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url={theme.bg === '#0a0e14'
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {sites.filter(s => s.latitude && s.longitude).map(site => {
            const status = getSiteStatus(site);
            const metrics = metricsData[site.id];

            return (
              <Marker
                key={site.id}
                position={[site.latitude, site.longitude]}
                eventHandlers={{
                  click: () => setSelectedSite(site),
                }}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: status.color }} />
                      <strong style={{ fontSize: '14px' }}>{site.name}</strong>
                    </div>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Customer:</strong> {site.customer}</div>
                      <div><strong>IP:</strong> {site.ip}</div>
                      <div><strong>Location:</strong> {site.location}</div>
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                        <div><strong>Latency:</strong> {formatLatency(metrics?.latency)}</div>
                        <div><strong>Packet Loss:</strong> {metrics?.packetLoss || 0}%</div>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
};
