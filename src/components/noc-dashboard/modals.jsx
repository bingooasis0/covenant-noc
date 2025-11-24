import React, { useState, useRef, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import {
  MapPin,
  Globe,
  Server,
  Wifi,
  RefreshCw,
  X,
  Settings as SettingsIcon,
  Palette,
  Activity,
  Bell,
  Webhook,
  FileText,
  Users,
  Bug,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader,
  Info
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
  LATENCY_WARN_THRESHOLD_MS
} from './utils';
import LoadingBar from './LoadingBar';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import Tooltip from '../Tooltip';
import {
  showSuccess,
  showError,
  notifySiteCreated,
  notifySiteUpdated,
  notifySiteDeleted,
  notifyAlertAcknowledged,
  notifyGeocodeSuccess,
  notifyGeocodeFailed,
  notifyDataExported,
  notifyDataImported,
  notifyConnectionSuccess,
  notifyConnectionFailed,
  notifyCacheCleared,
  showLoading,
  dismissToast
} from '../../services/toast';
import notificationSounds, { setSoundVolume, setSoundEnabled } from '../../services/notificationSounds';

// Site Detail Modal
const SiteDetailModal = ({ site, metrics, history, snmp, api, alerts, onClose, onEdit, onAcknowledgeAlert, theme, loadingState }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const metricsLoading = !!loadingState?.metrics?.[site.id];
  const snmpLoading = !!loadingState?.snmp?.[site.id];
  const apiLoading = !!loadingState?.api?.[site.id];
  const historyLoading = !!loadingState?.history?.[site.id];
  const hasMetricsData = metrics && Object.keys(metrics).length > 0;
  const hasSnmpData = snmp && Object.keys(snmp).length > 0;
  const hasApiData = api && Object.keys(api).length > 0;
  const hasHistoryData = Array.isArray(history) && history.length > 0;
  const monitoringBadges = [
    site.monitoringIcmp && 'ICMP',
    site.monitoringSnmp && 'SNMP',
    site.monitoringMeraki && 'API'
  ].filter(Boolean);

  const statusColor = metrics?.status === 'critical'
    ? theme.danger
    : metrics?.status === 'degraded'
      ? theme.warning
      : theme.success;

  const detailStatus = (() => {
    if (!metrics) {
      return { label: 'Unknown', color: theme.textMuted, bg: theme.borderLight };
    }
    if (!metrics.isReachable) {
      return { label: 'DOWN', color: theme.danger, bg: theme.dangerBg };
    }
    const packetLoss = metrics.packetLoss || 0;
    if (packetLoss >= 75) {
      return { label: 'CRITICAL', color: theme.danger, bg: theme.dangerBg };
    }
    if (packetLoss >= 35) {
      return { label: 'DEGRADED', color: theme.warning, bg: theme.warningBg };
    }
    return { label: 'HEALTHY', color: theme.success, bg: theme.successBg };
  })();

  const modalLastUpdated = metrics?._lastUpdated || metrics?.timestamp || null;

  const quickStats = [
    { label: 'Latency', value: formatLatency(metrics?.latency), color: statusColor },
    {
      label: 'Packet Loss',
      value: metrics?.packetLoss !== undefined && metrics?.packetLoss !== null
        ? `${Number(metrics.packetLoss).toFixed(1)}%`
        : '-',
      color: metrics?.packetLoss > 5 ? theme.warning : undefined
    },
    {
      label: 'Uptime',
      value: metrics?.uptime !== undefined && metrics?.uptime !== null ? formatPercent(metrics.uptime, 1) : '-',
      color: metrics?.uptime !== undefined && metrics?.uptime !== null && metrics.uptime < 99 ? theme.warning : undefined
    },
    {
      label: 'Alerts',
      value: alerts.length,
      color: alerts.length > 0 ? theme.warning : theme.text
    }
  ];

  const latencyHistory = takeLast(
    ensureArray(history)
      .map(point => (point && Number.isFinite(point.latency) ? Number(point.latency) : null))
      .filter(value => value !== null),
    120
  );

  const latencyStats = latencyHistory.length > 0
    ? {
        avg: latencyHistory.reduce((sum, value) => sum + value, 0) / latencyHistory.length,
        max: Math.max(...latencyHistory),
        min: Math.min(...latencyHistory)
      }
    : null;

  const LatencyTrend = ({ points }) => {
    const samples = ensureArray(points).filter(value => Number.isFinite(value));
    if (samples.length === 0) {
      return (
        <div style={{
          background: theme.bgSecondary,
          border: `1px dashed ${theme.borderLight}`,
          borderRadius: '10px',
          padding: '18px',
          fontSize: '12px',
          color: theme.textMuted,
          textAlign: 'center'
        }}>
          No latency trend available for the selected history window.
        </div>
      );
    }

    const goodThreshold = LATENCY_GOOD_THRESHOLD_MS;
    const warnThreshold = LATENCY_WARN_THRESHOLD_MS;
    const observedMax = Math.max(...samples);
    const targetMax = Math.max(warnThreshold * 1.25, observedMax, goodThreshold);
    const maxValue = targetMax <= 0 ? 1 : targetMax;
    const toPercent = (value) => Math.min(100, Math.max(0, (value / maxValue) * 100));
    const goodStop = toPercent(goodThreshold);
    const warnStop = toPercent(warnThreshold);
    const background = `linear-gradient(to top,
      ${withAlpha(theme.success, 0.18)} 0%,
      ${withAlpha(theme.success, 0.18)} ${goodStop}%,
      ${withAlpha(theme.warning, 0.18)} ${goodStop}%,
      ${withAlpha(theme.warning, 0.18)} ${warnStop}%,
      ${withAlpha(theme.danger, 0.18)} ${warnStop}%,
      ${withAlpha(theme.danger, 0.18)} 100%)`;

    const sampleCount = samples.length;
    const peak = Math.max(...samples);
    const average = samples.reduce((acc, value) => acc + value, 0) / sampleCount;

    const markerLines = [
      { value: warnThreshold, label: `${warnThreshold} ms`, color: theme.warning },
      { value: goodThreshold, label: `${goodThreshold} ms`, color: theme.success }
    ];

    return (
      <div style={{
        position: 'relative',
        borderRadius: '12px',
        background: theme.bgSecondary,
        border: `1px solid ${theme.borderLight}`,
        padding: '12px 18px 12px',
        height: '200px',
        overflow: 'hidden'
      }}>
        <div style={{ width: '100%', height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={samples.map((v, i) => ({ value: v, index: i }))}>
              <XAxis hide />
              <YAxis hide domain={[0, 'auto']} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: theme.bgSecondary, border: `1px solid ${theme.border}` }}
                itemStyle={{ color: theme.text }}
                labelStyle={{ display: 'none' }}
                formatter={(value) => [`${Math.round(value)} ms`, 'Latency']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={statusColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const overviewItems = [
    { label: 'IP Address', value: site.ip || '-', monospace: true },
    { label: 'Failover IP', value: site.failoverIp || 'None', monospace: true },
    { label: 'Location', value: site.location || 'Not set', truncate: true },
    { label: 'Device Type', value: site.device || 'Unknown' },
    { label: 'ISP', value: site.isp || 'Unknown' },
    { label: 'Status', value: site.status || 'Unknown', valueColor: statusColor },
    { label: 'Active Alerts', value: alerts.length, valueColor: alerts.length > 0 ? theme.warning : theme.text },
    { label: 'Last Update', value: metrics?.timestamp ? formatRelativeTime(metrics.timestamp) : 'No recent data' }
  ];

  const InfoTile = ({ label, value, valueColor, monospace, truncate }) => {
    const displayValue = value === null || value === undefined ? '-' : value;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: theme.textMuted }}>{label}</span>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: valueColor || theme.text,
            fontFamily: monospace ? 'monospace' : 'inherit',
            whiteSpace: truncate ? 'nowrap' : 'normal',
            overflow: truncate ? 'hidden' : 'visible',
            textOverflow: truncate ? 'ellipsis' : 'clip'
          }}
          title={truncate && typeof displayValue === 'string' ? displayValue : undefined}
        >
          {displayValue}
        </span>
      </div>
    );
  };

  const renderOverview = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
      {overviewItems.map(item => (
        <InfoTile key={item.label} {...item} />
      ))}
      {monitoringBadges.length > 0 && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>Monitoring</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {monitoringBadges.map(label => (
              <span
                key={label}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: theme.bgSecondary,
                  color: theme.text,
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderIcmp = () => {
    const trendPoints = latencyHistory.length > 0
      ? latencyHistory
      : metrics?.latency !== undefined && metrics?.latency !== null
        ? [Number(metrics.latency)]
        : [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
          <InfoTile label="Latency" value={formatLatency(metrics?.latency)} valueColor={statusColor} />
          <InfoTile
            label="Packet Loss"
            value={metrics?.packetLoss !== undefined && metrics?.packetLoss !== null ? `${Number(metrics.packetLoss).toFixed(1)}%` : '-'}
            valueColor={metrics?.packetLoss > 5 ? theme.warning : undefined}
          />
          <InfoTile label="Jitter" value={formatLatency(metrics?.jitter)} />
          <InfoTile
            label="Availability"
            value={metrics?.uptime !== undefined && metrics?.uptime !== null ? formatPercent(metrics.uptime, 1) : '-'}
            valueColor={metrics?.uptime !== undefined && metrics?.uptime !== null && metrics.uptime < 99 ? theme.warning : undefined}
          />
          <InfoTile
            label="Path"
            value={metrics?.usingFailover ? 'Failover' : 'Primary'}
            valueColor={metrics?.usingFailover ? theme.warning : theme.text}
          />
          <InfoTile label="Active IP" value={metrics?.activeIp || site.ip} monospace />
        </div>
        {latencyStats && (
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: theme.textSecondary, flexWrap: 'wrap' }}>
            <span>Min: <strong style={{ color: theme.text }}>{formatLatency(latencyStats.min)}</strong></span>
            <span>Avg: <strong style={{ color: theme.text }}>{`${Math.round(latencyStats.avg)} ms`}</strong></span>
            <span>Max: <strong style={{ color: theme.text }}>{formatLatency(latencyStats.max)}</strong></span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: theme.textSecondary, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: withAlpha(theme.success, 0.8),
              border: `1px solid ${theme.success}`
            }} />
            {`< ${LATENCY_GOOD_THRESHOLD_MS} ms healthy`}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: withAlpha(theme.warning, 0.8),
              border: `1px solid ${theme.warning}`
            }} />
            {`${LATENCY_GOOD_THRESHOLD_MS}-${LATENCY_WARN_THRESHOLD_MS} ms watch`}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: withAlpha(theme.danger, 0.8),
              border: `1px solid ${theme.danger}`
            }} />
            {`> ${LATENCY_WARN_THRESHOLD_MS} ms critical`}
          </span>
        </div>
        <LatencyTrend points={trendPoints} />
      </div>
    );
  };

  const renderSnmp = () => {
    const interfaces = ensureArray(snmp?.interfaces)
      .map(item => ({
        ...item,
        throughput: Number(item?.inOctets || 0) + Number(item?.outOctets || 0)
      }))
      .sort((a, b) => b.throughput - a.throughput)
      .slice(0, 12);

    const topInterface = interfaces[0];
    const aggregateThroughput = interfaces.reduce((sum, iface) => sum + (iface.throughput || 0), 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
          <InfoTile
            label="CPU"
            value={snmp?.cpu !== undefined && snmp?.cpu !== null ? formatPercent(snmp.cpu, 0) : '-'}
            valueColor={snmp?.cpu >= 85 ? theme.warning : undefined}
          />
          <InfoTile
            label="Memory"
            value={snmp?.memory !== undefined && snmp?.memory !== null ? formatPercent(snmp.memory, 0) : '-'}
            valueColor={snmp?.memory >= 85 ? theme.warning : undefined}
          />
          <InfoTile
            label="Interfaces"
            value={snmp?.activeInterfaces !== undefined && snmp?.totalInterfaces !== undefined
              ? `${snmp.activeInterfaces}/${snmp.totalInterfaces}`
              : '-'}
          />
          <InfoTile label="Errors" value={snmp?.errors !== undefined ? formatNumber(snmp.errors) : '-'} />
          <InfoTile label="Discards" value={snmp?.discards !== undefined ? formatNumber(snmp.discards) : '-'} />
          <InfoTile label="Uptime" value={snmp?.uptime !== undefined ? formatDuration(snmp.uptime) : '-'} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
          <div style={{ padding: '6px 8px', borderRadius: '6px', background: theme.bgSecondary, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase' }}>Top Interface</span>
            {topInterface ? (
              <>
                <span style={{ fontSize: '12px', fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {topInterface.name || `Interface ${topInterface.index ?? 1}`}
                </span>
                <span style={{ fontSize: '11px', color: theme.textSecondary }}>
                  {formatBytes(topInterface.throughput, 1)} · {topInterface.status === 'up' ? 'Up' : 'Down'}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '11px', color: theme.textMuted }}>No interface data</span>
            )}
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '6px', background: theme.bgSecondary, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase' }}>Aggregate Throughput</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: theme.text }}>
              {formatBytes(aggregateThroughput, 1)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderApi = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
        <InfoTile
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
        <InfoTile label="Clients" value={api?.clients !== undefined ? formatNumber(api.clients) : '-'} />
        <InfoTile label="Public IP" value={api?.publicIp || '-'} monospace />
        <InfoTile label="Model" value={api?.device?.model || '-'} />
        <InfoTile label="Serial" value={api?.device?.serial || '-'} monospace />
        <InfoTile label="Network" value={api?.network?.name || '-'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '11px' }}>
        {api?.primaryWan && (
          <div style={{ background: theme.bgSecondary, borderRadius: '6px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase' }}>WAN 1</span>
            <span style={{ fontWeight: 600, color: theme.text }}>{(api.primaryWan.status || 'unknown').toUpperCase()}</span>
            <span style={{ color: theme.textSecondary }}>{api.primaryWan.ip || '-'}</span>
            <span style={{ color: theme.textSecondary }}>
              {api.primaryWan.latencyMs !== undefined && api.primaryWan.latencyMs !== null ? `${api.primaryWan.latencyMs} ms` : 'Latency n/a'}
            </span>
          </div>
        )}
        {api?.failoverWan && (
          <div style={{ background: theme.bgSecondary, borderRadius: '6px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase' }}>WAN 2</span>
            <span style={{ fontWeight: 600, color: theme.text }}>{(api.failoverWan.status || 'unknown').toUpperCase()}</span>
            <span style={{ color: theme.textSecondary }}>{api.failoverWan.ip || '-'}</span>
            <span style={{ color: theme.textSecondary }}>
              {api.failoverWan.latencyMs !== undefined && api.failoverWan.latencyMs !== null ? `${api.failoverWan.latencyMs} ms` : 'Latency n/a'}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {alerts.length > 0 ? alerts.map(alert => (
        <div
          key={alert.id}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: alert.severity === 'critical' ? theme.dangerBg : theme.warningBg,
            border: `1px solid ${alert.severity === 'critical' ? theme.danger : theme.warning}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, color: alert.severity === 'critical' ? theme.danger : theme.warning, fontSize: '14px', textTransform: 'uppercase' }}>
                {alert.severity || 'ALERT'}
              </div>
              <div style={{ color: theme.text, fontSize: '13px' }}>{alert.message}</div>
              <div style={{ color: theme.textSecondary, fontSize: '12px', marginTop: '4px' }}>{formatRelativeTime(alert.timestamp)}</div>
            </div>
            <button
              onClick={() => onAcknowledgeAlert(alert.id)}
              style={{
                padding: '6px 12px',
                background: theme.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )) : (
        <div style={{ fontSize: '13px', color: theme.textSecondary }}>No active alerts.</div>
      )}
    </div>
  );

  const renderActiveTab = () => {
    let content = null;
    let showLoading = false;

    switch (activeTab) {
      case 'overview':
        content = renderOverview();
        showLoading = (!hasMetricsData && metricsLoading) ||
          (!hasSnmpData && snmpLoading) ||
          (!hasApiData && apiLoading);
        break;
      case 'icmp':
        content = renderIcmp();
        showLoading = !hasHistoryData && (metricsLoading || historyLoading);
        break;
      case 'snmp':
        content = renderSnmp();
        showLoading = !hasSnmpData && snmpLoading;
        break;
      case 'api':
        content = renderApi();
        showLoading = !hasApiData && apiLoading;
        break;
      case 'alerts':
        content = renderAlerts();
        showLoading = false;
        break;
      case 'history':
        content = renderHistory();
        showLoading = !hasHistoryData && historyLoading;
        break;
      default:
        content = null;
    }

    if (!content) {
      return null;
    }

    return (
      <div style={{ position: 'relative' }}>
        {content}
        {showLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              background: withAlpha(theme.bg, 0.05)
            }}
          >
            <LoadingBar width="60%" height={8} />
          </div>
        )}
      </div>
    );
  };

  const tabs = ['overview', 'icmp', 'snmp', 'api', 'alerts'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            padding: '20px 28px 0',
            borderBottom: `1px solid ${theme.border}`,
            background: theme.bgSecondary,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: theme.text,
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {site.name}
                </h2>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: detailStatus.bg,
                  color: detailStatus.color,
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.05em'
                }}>
                  {detailStatus.label}
                </span>
                {modalLastUpdated && (
                  <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                    Updated {formatRelativeTime(modalLastUpdated)}
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '13px',
                color: theme.textSecondary,
                alignItems: 'center',
                minWidth: 0
              }}>
                <span style={{ color: theme.text, fontWeight: 500 }}>{site.customer || 'Unassigned customer'}</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <MapPin size={14} color={theme.textMuted} />
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: theme.textSecondary
                    }}
                    title={site.location || 'Location not set'}
                  >
                    {site.location || 'Location not set'}
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: theme.textSecondary }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={13} color={theme.textMuted} />
                  <span style={{ fontFamily: 'monospace', color: theme.text }}>{site.ip || '—'}</span>
                </span>
                {site.failoverIp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={13} color={theme.textMuted} />
                    <span style={{ fontFamily: 'monospace', color: theme.text }}>{site.failoverIp}</span>
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={13} color={theme.textMuted} />
                  {site.device || 'Device type N/A'}
                </span>
                {site.isp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wifi size={13} color={theme.textMuted} />
                    {site.isp}
                  </span>
                )}
              </div>
              {monitoringBadges.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {monitoringBadges.map(label => (
                    <span
                      key={label}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: theme.card,
                        border: `1px solid ${theme.borderLight}`,
                        color: theme.text,
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.05em'
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: theme.textMuted,
                padding: '6px',
                alignSelf: 'flex-start'
              }}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '8px'
            }}
          >
            {quickStats.map(stat => (
              <div
                key={stat.label}
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.borderLight}`,
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: 0
                }}
              >
                <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {stat.label}
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: stat.color || theme.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 28px',
            borderBottom: `1px solid ${theme.border}`,
            background: theme.bgSecondary,
            flexWrap: 'wrap'
          }}
        >
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                background: activeTab === tab ? theme.primary : 'transparent',
                color: activeTab === tab ? '#fff' : theme.text,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                textTransform: 'uppercase'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {renderActiveTab()}
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.border}`,
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onEdit}
            style={{
              padding: '8px 16px',
              background: theme.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Edit Site
          </button>
        </div>
      </div>
    </div>
  );
};

// Add/Edit Site Modal
const AddEditSiteModal = ({ site, onClose, onSave, theme }) => {
  const [formData, setFormData] = useState(() => {
    const defaults = {
      customer: '',
      name: '',
      ip: '',
      failover_ip: '',
      location: '',
      latitude: '',
      longitude: '',
      devices: '',
      status: 'Operational',
      isp: '',
      device: 'Router',
      monitoring_icmp: true,
      monitoring_snmp: false,
      monitoring_meraki: false,
      snmp_community: 'public',
      api_key: '',
      api_endpoint: ''
    };

    if (!site) {
      return defaults;
    }

    const {
      monitoring_netflow: _ignoredMonitoringNetflow,
      netflow_port: _ignoredNetflowPort,
      ...rest
    } = site;

    return {
      ...defaults,
      customer: rest.customer || '',
      name: rest.name || '',
      ip: rest.ip || '',
      failover_ip: rest.failoverIp || '',
      location: rest.location || '',
      latitude: rest.latitude || '',
      longitude: rest.longitude || '',
      isp: rest.isp || '',
      device: rest.device || 'Meraki',
      devices: rest.devices || '',
      monitoring_icmp: rest.monitoringIcmp ?? true,
      monitoring_snmp: rest.monitoringSnmp ?? false,
      monitoring_meraki: rest.monitoringMeraki ?? false,
      snmp_community: rest.snmpCommunity || 'public',
      api_key: rest.apiKey || ''
    };
  });

  const [geocodeResult, setGeocodeResult] = useState(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState(null);

  const checkAddress = async () => {
    if (!formData.location) {
      const errorMsg = 'Please enter a location first';
      setGeocodeError(errorMsg);
      showError(errorMsg);
      return;
    }

    setGeocodeLoading(true);
    setGeocodeError(null);
    setGeocodeResult(null);

    const loadingToastId = showLoading('Looking up location...');

    try {
      const res = await authFetch(`/api/geocode?address=${encodeURIComponent(formData.location)}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Location not found' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setGeocodeResult(data);

      // Auto-update formData with geocoded values
      setFormData({
        ...formData,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude
      });

      dismissToast(loadingToastId);
      notifyGeocodeSuccess(data.location);
    } catch (err) {
      console.error('Geocode error:', err);
      const errorMsg = err.message || 'Failed to connect to geocoding service';
      setGeocodeError(errorMsg);
      dismissToast(loadingToastId);
      notifyGeocodeFailed();
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const loadingToastId = showLoading(site ? 'Updating site...' : 'Creating site...');

    try {
      const url = site ? `/api/sites/${site.id}` : '/api/sites';
      const method = site ? 'PUT' : 'POST';

      // Convert snake_case form fields to camelCase for API
      const apiData = {
        ...formData,
        failoverIp: formData.failover_ip,
        monitoringIcmp: formData.monitoring_icmp,
        monitoringSnmp: formData.monitoring_snmp,
        monitoringMeraki: formData.monitoring_meraki,
        snmpCommunity: formData.snmp_community,
        apiKey: formData.api_key
      };
      // Remove snake_case fields
      delete apiData.failover_ip;
      delete apiData.monitoring_icmp;
      delete apiData.monitoring_snmp;
      delete apiData.monitoring_meraki;
      delete apiData.snmp_community;
      delete apiData.api_key;

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to save site' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      dismissToast(loadingToastId);

      if (site) {
        notifySiteUpdated(formData.name || site.name);
      } else {
        notifySiteCreated(formData.name);
      }

      onSave();
    } catch (err) {
      console.error('Failed to save site:', err);
      dismissToast(loadingToastId);
      showError(err.message || 'Failed to save site. Please try again.');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    background: theme.bgSecondary,
    color: theme.text,
    fontSize: '14px',
    outline: 'none'
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{site ? 'Edit Site' : 'Add Site'}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: theme.textMuted,
              padding: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Basic Information */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Basic Information</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>Customer *</label>
                  <input
                    type="text"
                    required
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g., Covenant Technology"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>Site Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g., Main Office"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <Tooltip content="Primary IP address for monitoring this site (required)" position="top" isDark={theme.bg === '#0a0e14'}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>IP Address *</label>
                    </Tooltip>
                    <input
                      type="text"
                      required
                      value={formData.ip}
                      onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                      style={inputStyle}
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <Tooltip content="Secondary IP for failover monitoring (optional)" position="top" isDark={theme.bg === '#0a0e14'}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>Failover IP</label>
                    </Tooltip>
                    <input
                      type="text"
                      value={formData.failover_ip || ''}
                      onChange={(e) => setFormData({ ...formData, failover_ip: e.target.value })}
                      style={inputStyle}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <Tooltip content="Physical address of the site - click Check to geocode and get map coordinates" position="top" isDark={theme.bg === '#0a0e14'}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>Location</label>
                  </Tooltip>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, location: e.target.value });
                        setGeocodeResult(null);
                        setGeocodeError(null);
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="123 Main St, City, State 12345"
                    />
                    <Tooltip content="Verify address and get GPS coordinates for map view" position="left" isDark={theme.bg === '#0a0e14'}>
                      <button
                        type="button"
                        onClick={checkAddress}
                        disabled={geocodeLoading || !formData.location}
                        style={{
                          padding: '8px 16px',
                          background: geocodeLoading ? theme.bgSecondary : theme.primary,
                          color: geocodeLoading ? theme.textMuted : '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: geocodeLoading || !formData.location ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          opacity: !formData.location ? 0.5 : 1
                        }}
                      >
                        {geocodeLoading ? 'Checking...' : '📍 Check'}
                      </button>
                    </Tooltip>
                  </div>
                  {geocodeResult && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: theme.successBg,
                      border: `1px solid ${theme.success}`,
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}>
                      <div style={{ color: theme.success, fontWeight: 600, marginBottom: '4px' }}>✓ Address Found</div>
                      <div style={{ color: theme.textSecondary }}>{geocodeResult.location}</div>
                      <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '4px' }}>
                        Coordinates: {geocodeResult.latitude.toFixed(6)}, {geocodeResult.longitude.toFixed(6)}
                      </div>
                    </div>
                  )}
                  {geocodeError && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: theme.dangerBg,
                      border: `1px solid ${theme.danger}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: theme.danger
                    }}>
                      ✗ {geocodeError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <Tooltip content="Internet Service Provider name" position="top" isDark={theme.bg === '#0a0e14'}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>ISP</label>
                    </Tooltip>
                    <input
                      type="text"
                      value={formData.isp || ''}
                      onChange={(e) => setFormData({ ...formData, isp: e.target.value })}
                      style={inputStyle}
                      placeholder="e.g., Comcast"
                    />
                  </div>
                  <div>
                    <Tooltip content="Gateway device manufacturer/type at this site" position="top" isDark={theme.bg === '#0a0e14'}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>Gateway</label>
                    </Tooltip>
                    <select
                      value={formData.device || 'Meraki'}
                      onChange={(e) => setFormData({ ...formData, device: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="Meraki">Meraki</option>
                      <option value="Ubiquiti">Ubiquiti</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Tooltip content="Internet circuit bandwidth (e.g., 100 Mbps, 1 Gbps)" position="top" isDark={theme.bg === '#0a0e14'}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>Circuit Speed</label>
                  </Tooltip>
                  <input
                    type="text"
                    value={formData.devices || ''}
                    onChange={(e) => setFormData({ ...formData, devices: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g., 1000 Mbps"
                  />
                </div>
              </div>
            </div>

            {/* ICMP Monitoring */}
            <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="monitoring_icmp"
                  checked={formData.monitoring_icmp}
                  onChange={(e) => setFormData({ ...formData, monitoring_icmp: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="monitoring_icmp" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wifi size={16} color={theme.success} />
                  Enable ICMP Monitoring
                </label>
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginLeft: '26px' }}>
                Basic ping monitoring - latency, packet loss, reachability
              </div>
            </div>

            {/* SNMP Monitoring */}
            <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${formData.monitoring_snmp ? theme.primary : theme.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="monitoring_snmp"
                  checked={formData.monitoring_snmp}
                  onChange={(e) => setFormData({ ...formData, monitoring_snmp: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="monitoring_snmp" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={16} color={theme.info} />
                  Enable SNMP Monitoring
                </label>
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginLeft: '26px', marginBottom: '12px' }}>
                Device metrics - CPU, memory, interfaces
              </div>
              {formData.monitoring_snmp && (
                <div style={{ marginLeft: '26px' }}>
                  <Tooltip content="SNMP community string for device access (v2c) - typically 'public' for read-only" position="top" isDark={theme.bg === '#0a0e14'}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>SNMP Community String *</label>
                  </Tooltip>
                  <input
                    type="text"
                    value={formData.snmp_community || 'public'}
                    onChange={(e) => setFormData({ ...formData, snmp_community: e.target.value })}
                    style={inputStyle}
                    placeholder="public"
                  />
                </div>
              )}
            </div>

            {/* API Monitoring */}
            <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${formData.monitoring_meraki ? theme.primary : theme.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="monitoring_meraki"
                  checked={formData.monitoring_meraki}
                  onChange={(e) => setFormData({ ...formData, monitoring_meraki: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="monitoring_meraki" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={16} color={theme.primary} />
                  Enable API Monitoring (Meraki)
                </label>
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginLeft: '26px', marginBottom: '12px' }}>
                Cisco Meraki dashboard integration
              </div>
              {formData.monitoring_meraki && (
                <div style={{ marginLeft: '26px', display: 'grid', gap: '12px' }}>
                  <div>
                    <Tooltip content="API key from Meraki Dashboard for monitoring device status, uplink, and traffic" position="top" isDark={theme.bg === '#0a0e14'}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary, cursor: 'help' }}>Meraki API Key *</label>
                    </Tooltip>
                    <input
                      type="text"
                      value={formData.api_key || ''}
                      onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                      style={inputStyle}
                      placeholder="Your Meraki API key"
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textMuted }}>
                    Generate API key at dashboard.meraki.com → Organization → Settings → Dashboard API access
                  </div>
                </div>
              )}
            </div>

          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '24px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: theme.bgSecondary,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                background: theme.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {site ? 'Save Changes' : 'Add Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Settings Modal with Debug Menu
const SettingsModal = ({ isOpen, onClose, theme, isDark, setIsDark, sites, metricsData, user, onDeleteAllSites, onSitesImported, refreshInterval, onRefreshIntervalChange }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const fileInputRef = useRef(null);
  const [dataMessage, setDataMessage] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedToastType, setSelectedToastType] = useState('');
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const saved = localStorage.getItem('noc-sounds-enabled');
    return saved === null ? true : saved === 'true';
  });
  const [soundVolume, setSoundVolumeState] = useState(() => {
    const saved = localStorage.getItem('noc-sound-volume');
    return saved ? parseFloat(saved) : 0.3;
  });

  const handleSoundEnabledChange = (enabled) => {
    setSoundEnabledState(enabled);
    setSoundEnabled(enabled);
    localStorage.setItem('noc-sounds-enabled', enabled);
    if (enabled) {
      notificationSounds.playInfo();
    }
  };

  const handleSoundVolumeChange = (volume) => {
    const newVolume = parseFloat(volume);
    setSoundVolumeState(newVolume);
    setSoundVolume(newVolume);
    localStorage.setItem('noc-sound-volume', newVolume);
  };

  // Webhooks state
  const [webhooks, setWebhooks] = useState(() => {
    const saved = localStorage.getItem('noc-webhooks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState([]);

  // User management state
  const [users, setUsers] = useState([]);
  const [newUserData, setNewUserData] = useState({ username: '', email: '', role: 'viewer', password: '' });
  const [editingUserId, setEditingUserId] = useState(null);
  const userFormRef = useRef(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await authFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showError('Failed to load users');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      showError('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  // Load users when Settings modal opens on users tab
  useEffect(() => {
    if (isOpen && activeTab === 'users') {
      fetchUsers();
    }
  }, [isOpen, activeTab]);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('noc-notification-settings');
    return saved ? JSON.parse(saved) : {
      emailNotifications: false,
      emailAddress: '',
      desktopNotifications: true,
      alertThresholds: {
        latency: 200,
        packetLoss: 5,
        cpu: 90,
        memory: 90
      }
    };
  });

  // Collect debug info
  const debugInfo = {
    version: '2.0.0',
    user: user.email,
    totalSites: sites.length,
    onlineSites: sites.filter(s => metricsData[s.id]?.isReachable).length,
    offlineSites: sites.filter(s => metricsData[s.id] && !metricsData[s.id].isReachable).length,
    unknownSites: sites.filter(s => !metricsData[s.id]).length,
    browser: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    theme: isDark ? 'dark' : 'light',
    localStorage: Object.keys(localStorage).length + ' items',
    sessionStorage: Object.keys(sessionStorage).length + ' items',
    performance: performance.memory ? {
      usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
    } : 'Not available'
  };

  const exportDebugInfo = () => {
    const data = {
      ...debugInfo,
      sites: sites.map(s => ({
        id: s.id,
        name: s.name,
        customer: s.customer,
        ip: s.ip,
        metrics: metricsData[s.id] || null
      })),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocturnal-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    notifyCacheCleared();
    setTimeout(() => {
      location.reload();
    }, 500);
  };

  const testBackendConnection = async () => {
    const loadingToastId = showLoading('Testing backend connection...');
    const log = { time: new Date().toISOString(), tests: [] };

    try {
      const res = await authFetch('/api/auth/me');
      log.tests.push({ name: 'Auth Check', status: res.ok ? 'OK' : 'FAIL', code: res.status });
      if (res.ok) {
        dismissToast(loadingToastId);
        notifyConnectionSuccess();
      } else {
        dismissToast(loadingToastId);
        notifyConnectionFailed();
      }
    } catch (err) {
      log.tests.push({ name: 'Auth Check', status: 'ERROR', error: err.message });
      dismissToast(loadingToastId);
      notifyConnectionFailed();
    }

    try {
      const res = await authFetch('/api/sites');
      log.tests.push({ name: 'Sites API', status: res.ok ? 'OK' : 'FAIL', code: res.status });
    } catch (err) {
      log.tests.push({ name: 'Sites API', status: 'ERROR', error: err.message });
    }

    if (sites.length > 0) {
      try {
        const res = await authFetch(`/api/monitoring/${sites[0].id}`);
        log.tests.push({ name: 'Monitoring API', status: res.ok ? 'OK' : 'FAIL', code: res.status });
      } catch (err) {
        log.tests.push({ name: 'Monitoring API', status: 'ERROR', error: err.message });
      }
    }

    setDebugLogs(prev => [log, ...prev].slice(0, 10));
  };

  // Toast notification testing
  const toastTests = {
    // Success notifications
    'success-basic': { fn: () => showSuccess('This is a success message!'), label: 'Success - Basic' },
    'success-site-created': { fn: () => notifySiteCreated('Test Site'), label: 'Success - Site Created' },
    'success-site-updated': { fn: () => notifySiteUpdated('Test Site'), label: 'Success - Site Updated' },
    'success-site-deleted': { fn: () => notifySiteDeleted('Test Site'), label: 'Success - Site Deleted' },
    'success-bulk-delete': { fn: () => notifyBulkDelete(5), label: 'Success - Bulk Delete' },
    'success-data-refreshed': { fn: () => notifyDataRefreshed(), label: 'Success - Data Refreshed' },
    'success-data-exported': { fn: () => notifyDataExported(12), label: 'Success - Data Exported' },
    'success-data-imported': { fn: () => notifyDataImported(8), label: 'Success - Data Imported' },
    'success-login': { fn: () => showSuccess('Welcome back, TestUser!'), label: 'Success - Login' },
    'success-geocode': { fn: () => notifyGeocodeSuccess('123 Main St, Nashville, TN'), label: 'Success - Geocode' },
    'success-connection': { fn: () => notifyConnectionSuccess(), label: 'Success - Connection Test' },

    // Error notifications
    'error-basic': { fn: () => showError('This is an error message!'), label: 'Error - Basic' },
    'error-network': { fn: () => showError('Network connection failed. Please check your connection.'), label: 'Error - Network' },
    'error-api': { fn: () => showError('API request failed: /api/sites'), label: 'Error - API Failure' },
    'error-connection': { fn: () => notifyConnectionFailed(), label: 'Error - Connection Failed' },
    'error-geocode': { fn: () => notifyGeocodeFailed(), label: 'Error - Geocode Failed' },
    'error-validation': { fn: () => showError('Please fill in all required fields'), label: 'Error - Validation' },
    'error-auth': { fn: () => showError('Invalid username or password'), label: 'Error - Auth Failed' },

    // Warning notifications
    'warning-basic': { fn: () => showSuccess('This is a warning message!'), label: 'Warning - Basic' },
    'warning-site-down': { fn: () => notifyNewAlert('Main Office', 'Site Down'), label: 'Warning - Site Down' },
    'warning-high-latency': { fn: () => notifyNewAlert('Data Center', 'High Latency (250ms)'), label: 'Warning - High Latency' },
    'warning-packet-loss': { fn: () => notifyNewAlert('Branch Office', 'Packet Loss (15%)'), label: 'Warning - Packet Loss' },
    'warning-high-cpu': { fn: () => notifyNewAlert('Server Room', 'High CPU (95%)'), label: 'Warning - High CPU' },
    'warning-high-memory': { fn: () => notifyNewAlert('HQ Router', 'High Memory (92%)'), label: 'Warning - High Memory' },

    // Info notifications
    'info-basic': { fn: () => showSuccess('This is an info message'), label: 'Info - Basic' },
    'info-logout': { fn: () => showSuccess('Logged out successfully'), label: 'Info - Logout' },
    'info-theme-switch': { fn: () => showSuccess('Switched to dark theme'), label: 'Info - Theme Switch' },
    'info-alert-ack': { fn: () => notifyAlertAcknowledged('High Latency'), label: 'Info - Alert Acknowledged' },
    'info-cache-clear': { fn: () => notifyCacheCleared(), label: 'Info - Cache Cleared' },
    'info-device-reboot': { fn: () => showSuccess('Rebooting MX84...', { duration: 5000 }), label: 'Info - Device Reboot' },
    'info-device-blink': { fn: () => showSuccess('Blinking LEDs on MX84', { duration: 3000 }), label: 'Info - Device Blink' },

    // Status change notifications
    'status-online': { fn: () => showSuccess('Main Office is now online'), label: 'Status - Site Online' },
    'status-offline': { fn: () => showError('Data Center is offline', { duration: 7000 }), label: 'Status - Site Offline' },
    'status-degraded': { fn: () => showSuccess('Branch Office status: degraded'), label: 'Status - Site Degraded' },

    // Loading notifications
    'loading-basic': { fn: () => { const id = showLoading('Loading data...'); setTimeout(() => dismissToast(id), 2000); }, label: 'Loading - Basic (2s auto-dismiss)' },
    'loading-long': { fn: () => { const id = showLoading('Processing large file...'); setTimeout(() => dismissToast(id), 5000); }, label: 'Loading - Long (5s auto-dismiss)' },
  };

  const handleTestToast = () => {
    if (!selectedToastType) return;
    const test = toastTests[selectedToastType];
    if (test && test.fn) {
      test.fn();
    }
  };

  const handleExportSites = async () => {
    setIsExporting(true);
    setDataMessage(null);

    const loadingToastId = showLoading('Exporting sites...');

    try {
      const res = await authFetch('/api/sites/export');
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const payload = await res.json();
      const exportPayload = Array.isArray(payload)
        ? { sites: payload }
        : (payload && typeof payload === 'object' ? payload : { sites: [] });
      const sitesData = Array.isArray(exportPayload.sites) ? exportPayload.sites : [];
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `nocturnal-sites-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      dismissToast(loadingToastId);
      notifyDataExported(sitesData.length);
      setDataMessage({
        type: 'success',
        message: `Exported ${sitesData.length} site${sitesData.length === 1 ? '' : 's'}.`
      });
    } catch (err) {
      console.error('Export sites failed:', err);
      dismissToast(loadingToastId);
      showError(err.message || 'Failed to export sites.');
      setDataMessage({ type: 'error', message: err.message || 'Failed to export sites.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportFileChange = async (event) => {
    const input = event.target;
    const file = input?.files && input.files[0];
    if (!file) {
      return;
    }

    setIsImporting(true);
    setDataMessage(null);

    const loadingToastId = showLoading('Importing sites...');

    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error('Selected file is not valid JSON.');
      }

      const sitesData = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.sites)
          ? parsed.sites
          : null;

      if (!sitesData || sitesData.length === 0) {
        throw new Error('No sites found in import file.');
      }

      const res = await authFetch('/api/sites/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites: sitesData })
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || 'Import failed.');
      }

      if (typeof onSitesImported === 'function') {
        onSitesImported();
      }

      const messageParts = [
        `Imported ${result.created || 0} new`,
        `updated ${result.updated || 0}`
      ];
      if (result.skipped) {
        messageParts.push(`skipped ${result.skipped}`);
      }

      const warnings = Array.isArray(result.errors) ? result.errors.length : 0;
      const totalImported = (result.created || 0) + (result.updated || 0);

      dismissToast(loadingToastId);

      if (warnings > 0) {
        console.warn('Import warnings:', result.errors);
        showSuccess(`${messageParts.join(', ')} with ${warnings} warning${warnings === 1 ? '' : 's'}`, { duration: 5000 });
      } else {
        notifyDataImported(totalImported);
      }

      setDataMessage({
        type: warnings > 0 ? 'warning' : 'success',
        message: `${messageParts.join(', ')}.${warnings > 0 ? ` ${warnings} warning${warnings === 1 ? '' : 's'} – see console for details.` : ''}`
      });
    } catch (err) {
      console.error('Import sites failed:', err);
      dismissToast(loadingToastId);
      showError(err.message || 'Failed to import sites.');
      setDataMessage({ type: 'error', message: err.message || 'Failed to import sites.' });
    } finally {
      setIsImporting(false);
      if (input) {
        input.value = '';
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          width: '100%',
          maxWidth: '900px',
          height: '90vh',
          maxHeight: '850px',
          minHeight: '700px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: theme.textMuted,
              padding: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.border}`,
          background: theme.bgSecondary,
          justifyContent: 'center'
        }}>
          {[
            { id: 'general', icon: SettingsIcon, label: 'General' },
            { id: 'appearance', icon: Palette, label: 'Appearance' },
            { id: 'monitoring', icon: Activity, label: 'Monitoring' },
            { id: 'notifications', icon: Bell, label: 'Notifications' },
            { id: 'webhooks', icon: Webhook, label: 'Webhooks' },
            { id: 'reports', icon: FileText, label: 'Reports' },
            { id: 'users', icon: Users, label: 'Users' },
            { id: 'debug', icon: Bug, label: 'Debug' }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <Tooltip key={tab.id} content={tab.label} position="bottom" isDark={isDark}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px',
                    background: activeTab === tab.id ? theme.primary : 'transparent',
                    color: activeTab === tab.id ? '#fff' : theme.textSecondary,
                    border: `1px solid ${activeTab === tab.id ? theme.primary : 'transparent'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    minWidth: '40px',
                    minHeight: '40px'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = theme.card;
                      e.currentTarget.style.borderColor = theme.border;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <Icon size={18} />
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>User Information</h3>
                <div style={{ color: theme.textSecondary, fontSize: '13px' }}>
                  Logged in as: <strong>{user.email}</strong>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Dashboard Stats</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: theme.bgSecondary, borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>Total Sites</div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>{debugInfo.totalSites}</div>
                  </div>
                  <div style={{ padding: '12px', background: theme.bgSecondary, borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>Online</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: theme.success }}>{debugInfo.onlineSites}</div>
                  </div>
                  <div style={{ padding: '12px', background: theme.bgSecondary, borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>Offline</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: theme.danger }}>{debugInfo.offlineSites}</div>
                  </div>
                  <div style={{ padding: '12px', background: theme.bgSecondary, borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>Unknown</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: theme.textMuted }}>{debugInfo.unknownSites}</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px' }}>Data Management</h3>
                  <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                    Export or import complete site definitions, including SNMP and API settings.
                  </span>
                </div>
                {dataMessage && (
                  <div style={{
                    fontSize: '12px',
                    color: dataMessage.type === 'error' ? theme.danger : dataMessage.type === 'warning' ? theme.warning : theme.success
                  }}>
                    {dataMessage.message}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleExportSites}
                    disabled={isExporting}
                    style={{
                      padding: '8px 16px',
                      background: theme.primary,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isExporting ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      opacity: isExporting ? 0.7 : 1
                    }}
                  >
                    {isExporting ? 'Exporting...' : 'Export Sites'}
                  </button>
                  <button
                    onClick={handleSelectImport}
                    disabled={isImporting}
                    style={{
                      padding: '8px 16px',
                      background: theme.bgSecondary,
                      color: theme.text,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      cursor: isImporting ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      opacity: isImporting ? 0.7 : 1
                    }}
                  >
                    {isImporting ? 'Importing...' : 'Import Sites'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>
                  Imported records overwrite matching sites by ID or IP and create new entries for the rest.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Theme</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setIsDark(false)}
                    style={{
                      flex: 1,
                      padding: '40px 20px',
                      background: !isDark ? theme.primary : theme.bgSecondary,
                      color: !isDark ? '#fff' : theme.text,
                      border: `2px solid ${!isDark ? theme.primary : theme.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    ☀️ Light Mode
                  </button>
                  <button
                    onClick={() => setIsDark(true)}
                    style={{
                      flex: 1,
                      padding: '40px 20px',
                      background: isDark ? theme.primary : theme.bgSecondary,
                      color: isDark ? '#fff' : theme.text,
                      border: `2px solid ${isDark ? theme.primary : theme.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  >
                    🌙 Dark Mode
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Refresh Interval</h3>
                <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px' }}>
                  How often to poll for new metrics data
                </div>
                <select
                  value={refreshInterval}
                  onChange={(e) => onRefreshIntervalChange(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.border}`,
                    background: theme.bgSecondary,
                    color: theme.text,
                    fontSize: '14px'
                  }}
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds (default)</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Notification Sounds</h3>
                <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Enable Sounds</div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>Play audio alerts for important notifications</div>
                      </div>
                      <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={soundEnabled}
                          onChange={(e) => handleSoundEnabledChange(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: soundEnabled ? theme.primary : theme.border,
                          borderRadius: '24px',
                          transition: '0.3s',
                          cursor: 'pointer'
                        }}>
                          <span style={{
                            position: 'absolute',
                            content: '',
                            height: '18px',
                            width: '18px',
                            left: soundEnabled ? '26px' : '3px',
                            bottom: '3px',
                            backgroundColor: '#fff',
                            borderRadius: '50%',
                            transition: '0.3s'
                          }} />
                        </span>
                      </label>
                    </div>

                    {soundEnabled && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label style={{ fontSize: '14px', fontWeight: 600 }}>Volume</label>
                          <span style={{ fontSize: '13px', color: theme.textSecondary }}>{Math.round(soundVolume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={soundVolume}
                          onChange={(e) => handleSoundVolumeChange(e.target.value)}
                          onMouseUp={() => notificationSounds.playInfo()}
                          style={{
                            width: '100%',
                            height: '4px',
                            borderRadius: '2px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '8px' }}>
                          Adjust volume and release to test
                        </div>
                      </div>
                    )}

                    <div style={{ paddingTop: '12px', borderTop: `1px solid ${theme.border}` }}>
                      <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '8px' }}>Sound types:</div>
                      <div style={{ display: 'grid', gap: '6px', fontSize: '11px', color: theme.textMuted }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={12} color={theme.success} />
                          Site Online - Triumphant ascending chime
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <XCircle size={12} color={theme.danger} />
                          Site Offline - Urgent descending alarm
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={12} color={theme.danger} />
                          Critical Alert - Attention-demanding siren
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={12} color={theme.warning} />
                          High Latency - Pulsing warning beep
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={12} color={theme.warning} />
                          Packet Loss - Choppy interrupted sound
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Server size={12} color={theme.warning} />
                          High CPU/Memory - Rapid beeping
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={12} color={theme.success} />
                          Success - Pleasant ascending chime
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <XCircle size={12} color={theme.danger} />
                          Error - Descending attention tone
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Monitoring Methods</h3>
                <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '6px' }}>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Wifi size={16} color={theme.success} />
                      <span style={{ fontSize: '13px' }}>ICMP - Ping monitoring</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Server size={16} color={theme.info} />
                      <span style={{ fontSize: '13px' }}>SNMP - Device metrics</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={16} color={theme.primary} />
                      <span style={{ fontSize: '13px' }}>API - Meraki integration</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'debug' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>System Information</h3>
                <div style={{
                  padding: '12px',
                  background: theme.bgSecondary,
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: theme.textSecondary
                }}>
                  <div>Version: {debugInfo.version}</div>
                  <div>Sites: {debugInfo.totalSites} ({debugInfo.onlineSites} online)</div>
                  <div>Theme: {debugInfo.theme}</div>
                  <div>Viewport: {debugInfo.viewport}</div>
                  {typeof debugInfo.performance === 'object' && (
                    <>
                      <div>Memory Used: {debugInfo.performance.usedJSHeapSize}</div>
                      <div>Memory Total: {debugInfo.performance.totalJSHeapSize}</div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={testBackendConnection}
                    style={{
                      padding: '10px 16px',
                      background: theme.primary,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: 'center'
                    }}
                  >
                    <Wifi size={14} />
                    Test Backend Connection
                  </button>
                  <button
                    onClick={exportDebugInfo}
                    style={{
                      padding: '10px 16px',
                      background: theme.bgSecondary,
                      color: theme.text,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: 'center'
                    }}
                  >
                    <FileText size={14} />
                    Export Debug Info
                  </button>
                  <button
                    onClick={clearCache}
                    style={{
                      padding: '10px 16px',
                      background: theme.dangerBg,
                      color: theme.danger,
                      border: `1px solid ${theme.danger}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: 'center'
                    }}
                  >
                    <RefreshCw size={14} />
                    Clear Cache & Reload
                  </button>
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    style={{
                      padding: '10px 16px',
                      background: theme.danger,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: 'center'
                    }}
                  >
                    <AlertTriangle size={14} />
                    Delete All Sites
                  </button>
                </div>
              </div>

              {/* Toast Notification Testing */}
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Test Toast Notifications</h3>
                <div style={{
                  padding: '16px',
                  background: theme.bgSecondary,
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                    Select a notification type to test from the dropdown below. This allows you to preview all notification styles and behaviors.
                  </div>
                  <select
                    value={selectedToastType}
                    onChange={(e) => setSelectedToastType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.border}`,
                      background: theme.card,
                      color: theme.text,
                      fontSize: '13px',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select a notification type...</option>
                    <optgroup label="Success Notifications">
                      <option value="success-basic">Success - Basic Message</option>
                      <option value="success-site-created">Success - Site Created</option>
                      <option value="success-site-updated">Success - Site Updated</option>
                      <option value="success-site-deleted">Success - Site Deleted</option>
                      <option value="success-bulk-delete">Success - Bulk Delete (5 sites)</option>
                      <option value="success-data-refreshed">Success - Data Refreshed</option>
                      <option value="success-data-exported">Success - Data Exported</option>
                      <option value="success-data-imported">Success - Data Imported</option>
                      <option value="success-login">Success - Login Welcome</option>
                      <option value="success-geocode">Success - Geocode Found</option>
                      <option value="success-connection">Success - Connection Test</option>
                    </optgroup>
                    <optgroup label="Error Notifications">
                      <option value="error-basic">Error - Basic Message</option>
                      <option value="error-network">Error - Network Failure</option>
                      <option value="error-api">Error - API Failure</option>
                      <option value="error-connection">Error - Connection Failed</option>
                      <option value="error-geocode">Error - Geocode Failed</option>
                      <option value="error-validation">Error - Form Validation</option>
                      <option value="error-auth">Error - Auth Failed</option>
                    </optgroup>
                    <optgroup label="Warning/Alert Notifications">
                      <option value="warning-basic">Warning - Basic Message</option>
                      <option value="warning-site-down">Alert - Site Down</option>
                      <option value="warning-high-latency">Alert - High Latency</option>
                      <option value="warning-packet-loss">Alert - Packet Loss</option>
                      <option value="warning-high-cpu">Alert - High CPU</option>
                      <option value="warning-high-memory">Alert - High Memory</option>
                    </optgroup>
                    <optgroup label="Info Notifications">
                      <option value="info-basic">Info - Basic Message</option>
                      <option value="info-logout">Info - Logout</option>
                      <option value="info-theme-switch">Info - Theme Switch</option>
                      <option value="info-alert-ack">Info - Alert Acknowledged</option>
                      <option value="info-cache-clear">Info - Cache Cleared</option>
                      <option value="info-device-reboot">Info - Device Reboot</option>
                      <option value="info-device-blink">Info - Device Blink LEDs</option>
                    </optgroup>
                    <optgroup label="Status Change Notifications">
                      <option value="status-online">Status - Site Online</option>
                      <option value="status-offline">Status - Site Offline</option>
                      <option value="status-degraded">Status - Site Degraded</option>
                    </optgroup>
                    <optgroup label="Loading Notifications">
                      <option value="loading-basic">Loading - Basic (2s)</option>
                      <option value="loading-long">Loading - Long Process (5s)</option>
                    </optgroup>
                  </select>
                  <button
                    onClick={handleTestToast}
                    disabled={!selectedToastType}
                    style={{
                      padding: '10px 16px',
                      background: selectedToastType ? theme.primary : theme.bgSecondary,
                      color: selectedToastType ? '#fff' : theme.textMuted,
                      border: selectedToastType ? 'none' : `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      cursor: selectedToastType ? 'pointer' : 'not-allowed',
                      fontSize: '13px',
                      fontWeight: 600,
                      opacity: selectedToastType ? 1 : 0.6
                    }}
                  >
                    🔔 Trigger Notification
                  </button>
                  <div style={{
                    fontSize: '11px',
                    color: theme.textMuted,
                    padding: '8px',
                    background: theme.card,
                    borderRadius: '4px',
                    border: `1px solid ${theme.borderLight}`
                  }}>
                    <strong>Note:</strong> Notifications will appear in the top-right corner.
                    Success/Info auto-dismiss in 3-4s, Errors in 5s, Warnings in 4-6s.
                    Loading notifications will auto-dismiss after the specified time.
                  </div>
                </div>
              </div>

              {/* Delete all confirmation */}
              {showDeleteAllConfirm && (
                <div style={{
                  padding: '16px',
                  background: theme.dangerBg,
                  border: `2px solid ${theme.danger}`,
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: theme.danger, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} />
                    Confirm Delete All Sites
                  </div>
                  <div style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '12px' }}>
                    This will permanently delete all {sites.length} sites. This action cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowDeleteAllConfirm(false)}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        background: theme.bgSecondary,
                        color: theme.text,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDeleteAllSites();
                        setShowDeleteAllConfirm(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        background: theme.danger,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      Yes, Delete All
                    </button>
                  </div>
                </div>
              )}

              {debugLogs.length > 0 && (
                <div>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Connection Test Results</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {debugLogs.map((log, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        background: theme.bgSecondary,
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <div style={{ color: theme.textMuted, marginBottom: '8px' }}>{log.time}</div>
                        {log.tests.map((test, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>{test.name}</span>
                            <span style={{
                              color: test.status === 'OK' ? theme.success : theme.danger,
                              fontWeight: 600
                            }}>
                              {test.status} {test.code && `(${test.code})`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Notification Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Desktop Notifications */}
                  <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>Desktop Notifications</div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                          Show browser notifications for critical alerts
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.desktopNotifications}
                        onChange={(e) => {
                          const newSettings = { ...notificationSettings, desktopNotifications: e.target.checked };
                          setNotificationSettings(newSettings);
                          localStorage.setItem('noc-notification-settings', JSON.stringify(newSettings));
                          if (e.target.checked) {
                            showInfo('Desktop notifications enabled');
                            if ('Notification' in window && Notification.permission === 'default') {
                              Notification.requestPermission();
                            }
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  {/* Email Notifications */}
                  <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>Email Notifications</div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                          Receive email alerts for critical events
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailNotifications}
                        onChange={(e) => {
                          const newSettings = { ...notificationSettings, emailNotifications: e.target.checked };
                          setNotificationSettings(newSettings);
                          localStorage.setItem('noc-notification-settings', JSON.stringify(newSettings));
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </div>
                    {notificationSettings.emailNotifications && (
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>Email Address</label>
                        <input
                          type="email"
                          value={notificationSettings.emailAddress}
                          onChange={(e) => {
                            const newSettings = { ...notificationSettings, emailAddress: e.target.value };
                            setNotificationSettings(newSettings);
                            localStorage.setItem('noc-notification-settings', JSON.stringify(newSettings));
                          }}
                          placeholder="alerts@company.com"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.border}`,
                            background: theme.card,
                            color: theme.text,
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Alert Thresholds */}
                  <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Alert Thresholds</h4>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                          High Latency Threshold (ms)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.latency}
                          onChange={(e) => {
                            const newSettings = {
                              ...notificationSettings,
                              alertThresholds: { ...notificationSettings.alertThresholds, latency: Number(e.target.value) }
                            };
                            setNotificationSettings(newSettings);
                            localStorage.setItem('noc-notification-settings', JSON.stringify(newSettings));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.border}`,
                            background: theme.card,
                            color: theme.text,
                            fontSize: '13px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                          Packet Loss Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.packetLoss}
                          onChange={(e) => {
                            const newSettings = {
                              ...notificationSettings,
                              alertThresholds: { ...notificationSettings.alertThresholds, packetLoss: Number(e.target.value) }
                            };
                            setNotificationSettings(newSettings);
                            localStorage.setItem('noc-notification-settings', JSON.stringify(newSettings));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.border}`,
                            background: theme.card,
                            color: theme.text,
                            fontSize: '13px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                          High CPU Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.cpu}
                          onChange={(e) => {
                            const newSettings = {
                              ...notificationSettings,
                              alertThresholds: { ...notificationSettings.alertThresholds, cpu: Number(e.target.value) }
                            };
                            setNotificationSettings(newSettings);
                            localStorage.setItem('noc-notification-settings', JSON.stringify(newSettings));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.border}`,
                            background: theme.card,
                            color: theme.text,
                            fontSize: '13px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                          High Memory Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.memory}
                          onChange={(e) => {
                            const newSettings = {
                              ...notificationSettings,
                              alertThresholds: { ...notificationSettings.alertThresholds, memory: Number(e.target.value) }
                            };
                            setNotificationSettings(newSettings);
                            localStorage.setItem('noc-notification-settings', JSON.stringify(newSettings));
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${theme.border}`,
                            background: theme.card,
                            color: theme.text,
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Webhooks</h3>
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '16px' }}>
                  Configure webhooks to send real-time notifications to external systems when events occur.
                </div>

                {/* Add Webhook Form */}
                <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600 }}>Add New Webhook</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                        Webhook URL *
                      </label>
                      <input
                        type="url"
                        value={newWebhookUrl}
                        onChange={(e) => setNewWebhookUrl(e.target.value)}
                        placeholder="https://your-server.com/webhook"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.border}`,
                          background: theme.card,
                          color: theme.text,
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                        Events
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {['site.down', 'site.up', 'alert.high_latency', 'alert.packet_loss', 'alert.high_cpu', 'alert.high_memory'].map(event => (
                          <label key={event} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={newWebhookEvents.includes(event)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewWebhookEvents([...newWebhookEvents, event]);
                                } else {
                                  setNewWebhookEvents(newWebhookEvents.filter(ev => ev !== event));
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            {event}
                          </label>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!newWebhookUrl) {
                          showError('Please enter a webhook URL');
                          return;
                        }
                        const newWebhook = {
                          id: Date.now(),
                          url: newWebhookUrl,
                          events: newWebhookEvents.length > 0 ? newWebhookEvents : ['site.down', 'site.up'],
                          enabled: true,
                          createdAt: new Date().toISOString()
                        };
                        const updated = [...webhooks, newWebhook];
                        setWebhooks(updated);
                        localStorage.setItem('noc-webhooks', JSON.stringify(updated));
                        setNewWebhookUrl('');
                        setNewWebhookEvents([]);
                        showSuccess('Webhook added successfully');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: theme.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      Add Webhook
                    </button>
                  </div>
                </div>

                {/* Webhooks List */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600 }}>Configured Webhooks</h4>
                  {webhooks.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                      No webhooks configured. Add one above to get started.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {webhooks.map(webhook => (
                        <div key={webhook.id} style={{ padding: '12px', background: theme.bgSecondary, borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {webhook.url}
                                <span style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  background: webhook.enabled ? theme.successBg : theme.dangerBg,
                                  color: webhook.enabled ? theme.success : theme.danger,
                                  fontWeight: 600
                                }}>
                                  {webhook.enabled ? 'ACTIVE' : 'DISABLED'}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '6px' }}>
                                Events: {webhook.events.join(', ')}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                <button
                                  onClick={() => {
                                    const updated = webhooks.map(w =>
                                      w.id === webhook.id ? { ...w, enabled: !w.enabled } : w
                                    );
                                    setWebhooks(updated);
                                    localStorage.setItem('noc-webhooks', JSON.stringify(updated));
                                    showSuccess(webhook.enabled ? 'Webhook disabled' : 'Webhook enabled');
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    background: theme.card,
                                    color: theme.text,
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px'
                                  }}
                                >
                                  {webhook.enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  onClick={() => {
                                    showLoading('Testing webhook...');
                                    setTimeout(() => {
                                      dismissToast();
                                      showSuccess('Test payload sent to webhook');
                                    }, 1000);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    background: theme.infoBg,
                                    color: theme.info,
                                    border: `1px solid ${theme.info}`,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px'
                                  }}
                                >
                                  Test
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const updated = webhooks.filter(w => w.id !== webhook.id);
                                setWebhooks(updated);
                                localStorage.setItem('noc-webhooks', JSON.stringify(updated));
                                showSuccess('Webhook removed');
                              }}
                              style={{
                                padding: '4px 8px',
                                background: theme.dangerBg,
                                color: theme.danger,
                                border: `1px solid ${theme.danger}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Reports</h3>
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '16px' }}>
                  Generate and export performance reports for your monitored sites.
                </div>

                {/* Report Scheduling */}
                <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Scheduled Reports</div>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        defaultChecked={false}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Enable automatic daily reports at 8:00 AM</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        defaultChecked={false}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Enable weekly summary reports (Monday)</span>
                    </label>
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                        Email reports to:
                      </label>
                      <input
                        type="email"
                        placeholder="admin@example.com"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.border}`,
                          background: theme.card,
                          color: theme.text,
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Report Types */}
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Uptime Report</div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                          Site availability and uptime statistics
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          showLoading('Generating report...');
                          setTimeout(() => {
                            dismissToast();
                            const report = {
                              type: 'uptime',
                              generatedAt: new Date().toISOString(),
                              sites: sites.map(site => ({
                                name: site.name,
                                customer: site.customer,
                                uptime: metricsData[site.id]?.uptime || 0,
                                status: metricsData[site.id]?.isReachable ? 'online' : 'offline'
                              }))
                            };
                            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `uptime-report-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            showSuccess('Report generated successfully');
                          }, 1000);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: theme.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Performance Report</div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                          Latency, packet loss, and performance metrics
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          showLoading('Generating report...');
                          setTimeout(() => {
                            dismissToast();
                            const report = {
                              type: 'performance',
                              generatedAt: new Date().toISOString(),
                              sites: sites.map(site => ({
                                name: site.name,
                                customer: site.customer,
                                latency: metricsData[site.id]?.latency || 0,
                                packetLoss: metricsData[site.id]?.packetLoss || 0,
                                jitter: metricsData[site.id]?.jitter || 0
                              }))
                            };
                            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            showSuccess('Report generated successfully');
                          }, 1000);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: theme.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Alert History</div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                          Historical alert data and trends
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          showLoading('Generating report...');
                          setTimeout(() => {
                            dismissToast();
                            const report = {
                              type: 'alerts',
                              generatedAt: new Date().toISOString(),
                              alerts: alerts.map(alert => ({
                                site: alert.siteName,
                                customer: alert.customer,
                                type: alert.type,
                                severity: alert.severity,
                                message: alert.message,
                                timestamp: alert.timestamp
                              }))
                            };
                            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `alert-history-${new Date().toISOString().split('T')[0]}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            showSuccess('Report generated successfully');
                          }, 1000);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: theme.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>User Management</h3>
                <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '16px' }}>
                  Manage users and access permissions.
                </div>

                {/* Current User */}
                <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Current User</div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: theme.textSecondary }}>Username:</span>
                      <span style={{ fontWeight: 600 }}>{user.email}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: theme.textSecondary }}>Role:</span>
                      <span style={{ fontWeight: 600 }}>Administrator</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: theme.textSecondary }}>Sites Access:</span>
                      <span style={{ fontWeight: 600 }}>All Sites ({sites.length})</span>
                    </div>
                  </div>
                </div>

                {/* Add New User */}
                <div ref={userFormRef} style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {editingUserId ? 'Edit User' : 'Add New User'}
                    </div>
                    {editingUserId && (
                      <button
                        onClick={() => {
                          setEditingUserId(null);
                          setNewUserData({ username: '', email: '', role: 'viewer', password: '' });
                        }}
                        style={{
                          padding: '4px 8px',
                          background: theme.card,
                          color: theme.textMuted,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                        Username
                      </label>
                      <input
                        type="text"
                        value={newUserData.username}
                        onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                        placeholder="johndoe"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.border}`,
                          background: theme.card,
                          color: theme.text,
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        placeholder="john@example.com"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.border}`,
                          background: theme.card,
                          color: theme.text,
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                        Role
                      </label>
                      <select
                        value={newUserData.role}
                        onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.border}`,
                          background: theme.card,
                          color: theme.text,
                          fontSize: '12px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="viewer">Viewer - Read-only access</option>
                        <option value="operator">Operator - Can manage sites and alerts</option>
                        <option value="admin">Administrator - Full access</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '6px' }}>
                        {editingUserId ? 'Password (leave blank to keep current)' : 'Initial Password'}
                      </label>
                      <input
                        type="password"
                        value={newUserData.password}
                        onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                        placeholder={editingUserId ? 'Leave blank to keep current password' : 'Temporary password'}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.border}`,
                          background: theme.card,
                          color: theme.text,
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <button
                      onClick={async () => {
                        // Validate inputs
                        if (!newUserData.username.trim()) {
                          showError('Username is required');
                          return;
                        }
                        if (!newUserData.email.trim()) {
                          showError('Email is required');
                          return;
                        }
                        if (!newUserData.email.includes('@')) {
                          showError('Please enter a valid email address');
                          return;
                        }

                        if (editingUserId) {
                          // EDIT MODE - Use API
                          try {
                            const res = await authFetch(`/api/users/${editingUserId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                username: newUserData.username.trim(),
                                email: newUserData.email.trim(),
                                role: newUserData.role,
                                password: newUserData.password.trim() || undefined,
                                active: true
                              })
                            });

                            if (res.ok) {
                              showSuccess('User updated successfully');
                              setEditingUserId(null);
                              setNewUserData({ username: '', email: '', role: 'viewer', password: '' });
                              fetchUsers(); // Refresh list
                            } else {
                              const error = await res.json();
                              showError(error.error || 'Failed to update user');
                            }
                          } catch (err) {
                            console.error('Update user error:', err);
                            showError('Failed to update user');
                          }
                        } else {
                          // CREATE MODE - Use API
                          if (!newUserData.password.trim()) {
                            showError('Password is required');
                            return;
                          }
                          if (newUserData.password.length < 6) {
                            showError('Password must be at least 6 characters');
                            return;
                          }

                          try {
                            const res = await authFetch('/api/users', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                username: newUserData.username.trim(),
                                email: newUserData.email.trim(),
                                role: newUserData.role,
                                password: newUserData.password
                              })
                            });

                            if (res.ok) {
                              const createdUser = await res.json();
                              showSuccess(`User ${createdUser.username} created successfully`);
                              setNewUserData({ username: '', email: '', role: 'viewer', password: '' });
                              fetchUsers(); // Refresh list
                            } else {
                              const error = await res.json();
                              showError(error.error || 'Failed to create user');
                            }
                          } catch (err) {
                            console.error('Create user error:', err);
                            showError('Failed to create user');
                          }
                        }
                      }}
                      style={{
                        padding: '10px 16px',
                        background: theme.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      {editingUserId ? 'Update User' : 'Create User'}
                    </button>
                  </div>
                </div>

                {/* User List */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600 }}>All Users ({users.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {users.map(u => {
                      const isCurrentUser = u.username === user.email;
                      const roleDisplay = {
                        admin: 'Administrator',
                        operator: 'Operator',
                        viewer: 'Viewer'
                      }[u.role] || u.role;

                      return (
                        <div
                          key={u.id}
                          style={{
                            padding: '12px',
                            background: isCurrentUser ? theme.successBg : theme.bgSecondary,
                            borderRadius: '6px',
                            border: `1px solid ${isCurrentUser ? theme.success : theme.border}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                                {u.username}
                                {isCurrentUser && (
                                  <span style={{
                                    fontSize: '10px',
                                    marginLeft: '8px',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    background: theme.success,
                                    color: '#fff',
                                    fontWeight: 600
                                  }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px' }}>
                                {u.email}
                              </div>
                              <div style={{ fontSize: '11px', color: theme.textSecondary }}>
                                Role: {roleDisplay}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                              <span style={{
                                fontSize: '10px',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: u.active ? theme.successBg : theme.dangerBg,
                                color: u.active ? theme.success : theme.danger,
                                fontWeight: 600
                              }}>
                                {u.active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                              {!isCurrentUser && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await authFetch(`/api/users/${u.id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            username: u.username,
                                            email: u.email,
                                            role: u.role,
                                            active: !u.active
                                          })
                                        });

                                        if (res.ok) {
                                          showSuccess(`User ${u.username} ${!u.active ? 'activated' : 'deactivated'}`);
                                          fetchUsers(); // Refresh list
                                        } else {
                                          const error = await res.json();
                                          showError(error.error || 'Failed to update user');
                                        }
                                      } catch (err) {
                                        console.error('Toggle user active error:', err);
                                        showError('Failed to update user');
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      background: theme.card,
                                      color: theme.text,
                                      border: `1px solid ${theme.border}`,
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px'
                                    }}
                                  >
                                    {u.active ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingUserId(u.id);
                                      setNewUserData({
                                        username: u.username,
                                        email: u.email,
                                        role: u.role,
                                        password: ''
                                      });
                                      // Scroll to form after state updates
                                      setTimeout(() => {
                                        if (userFormRef.current) {
                                          userFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                      }, 100);
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      background: theme.card,
                                      color: theme.text,
                                      border: `1px solid ${theme.border}`,
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px'
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setUserToDelete(u)}
                                    style={{
                                      padding: '4px 8px',
                                      background: theme.dangerBg,
                                      color: theme.danger,
                                      border: `1px solid ${theme.danger}`,
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px'
                                    }}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {users.length === 0 && (
                      <div style={{ padding: '32px', textAlign: 'center', color: theme.textMuted }}>
                        No users found. Create your first user above.
                      </div>
                    )}
                  </div>
                </div>

                {/* Activity Logs */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600 }}>Recent Activity</h4>
                  <div style={{ padding: '12px', background: theme.bgSecondary, borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: theme.textMuted }}>
                      <div style={{ padding: '16px', textAlign: 'center', color: theme.textMuted }}>
                        No recent activity. User actions will appear here.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px',
              background: theme.primary,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Close
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleImportFileChange}
      />

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <ConfirmModal
          title="Delete User"
          message={`Are you sure you want to delete user "${userToDelete.username}"? This action cannot be undone.`}
          onConfirm={async () => {
            try {
              const res = await authFetch(`/api/users/${userToDelete.id}`, {
                method: 'DELETE'
              });

              if (res.ok) {
                showSuccess(`User ${userToDelete.username} deleted successfully`);
                setUserToDelete(null);
                fetchUsers(); // Refresh list
              } else {
                const error = await res.json();
                showError(error.error || 'Failed to delete user');
                setUserToDelete(null);
              }
            } catch (err) {
              console.error('Delete user error:', err);
              showError('Failed to delete user');
              setUserToDelete(null);
            }
          }}
          onCancel={() => setUserToDelete(null)}
          theme={theme}
        />
      )}
    </div>
  );
};

// Confirmation Modal (no browser popups!)
const ConfirmModal = ({ title, message, onConfirm, onCancel, theme }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000, // Higher than SlideOver panel (9999) to appear on top
      padding: '24px'
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          width: '100%',
          maxWidth: '450px',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>{title}</h2>
          <p style={{ margin: 0, color: theme.textSecondary, fontSize: '14px', lineHeight: '1.6' }}>
            {message}
          </p>
        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: theme.bgSecondary,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              background: theme.danger,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export {
  SiteDetailModal,
  AddEditSiteModal,
  SettingsModal,
  ConfirmModal
};
