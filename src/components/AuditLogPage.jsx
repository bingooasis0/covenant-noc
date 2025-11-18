import React, { useState } from 'react';
import {
  ArrowLeft, Moon, Sun, Clock, Activity, AlertTriangle, CheckCircle, XCircle,
  User, Settings, Wifi, Server, Bell, RefreshCw, Trash2, Plus, Edit, Eye,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';

// Audit Log / History Page
const AuditLogPage = ({ onBack }) => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('noc-theme') === 'dark');
  const [filterType, setFilterType] = useState('all'); // all, status, alerts, user, system
  const [timeRange, setTimeRange] = useState('24h'); // 1h, 24h, 7d, 30d, all

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

  // Audit log data - would come from backend API in production
  // For now, this would be populated by actual system events, user actions, etc.
  const auditLogs = [];

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get icon and color for log type
  const getLogIcon = (type) => {
    switch (type) {
      case 'status-up':
        return { icon: CheckCircle, color: theme.success, bg: theme.successBg };
      case 'status-down':
        return { icon: XCircle, color: theme.danger, bg: theme.dangerBg };
      case 'status-degraded':
        return { icon: AlertTriangle, color: theme.warning, bg: theme.warningBg };
      case 'alert-packet-loss':
      case 'alert-high-cpu':
      case 'alert-high-memory':
        return { icon: AlertTriangle, color: theme.danger, bg: theme.dangerBg };
      case 'alert-acknowledged':
        return { icon: Eye, color: theme.info, bg: theme.infoBg };
      case 'alert-resolved':
        return { icon: CheckCircle, color: theme.success, bg: theme.successBg };
      case 'user-login':
        return { icon: User, color: theme.info, bg: theme.infoBg };
      case 'site-created':
        return { icon: Plus, color: theme.success, bg: theme.successBg };
      case 'site-updated':
        return { icon: Edit, color: theme.info, bg: theme.infoBg };
      case 'site-deleted':
        return { icon: Trash2, color: theme.danger, bg: theme.dangerBg };
      case 'system-backup':
        return { icon: Server, color: theme.success, bg: theme.successBg };
      case 'settings-updated':
        return { icon: Settings, color: theme.info, bg: theme.infoBg };
      case 'webhook-triggered':
        return { icon: Bell, color: theme.primary, bg: theme.infoBg };
      case 'report-generated':
        return { icon: Activity, color: theme.info, bg: theme.infoBg };
      default:
        return { icon: Activity, color: theme.textMuted, bg: theme.bgSecondary };
    }
  };

  // Get log message
  const getLogMessage = (log) => {
    switch (log.type) {
      case 'status-up':
        return (
          <span>
            <strong>{log.site}</strong> came back <span style={{ color: theme.success, fontWeight: 600 }}>ONLINE</span>
            {log.duration && <span style={{ color: theme.textMuted }}> (was down for {log.duration})</span>}
          </span>
        );
      case 'status-down':
        return (
          <span>
            <strong>{log.site}</strong> went <span style={{ color: theme.danger, fontWeight: 600 }}>OFFLINE</span>
            {log.reason && <span style={{ color: theme.textMuted }}> ({log.reason})</span>}
          </span>
        );
      case 'status-degraded':
        return (
          <span>
            <strong>{log.site}</strong> <span style={{ color: theme.warning, fontWeight: 600 }}>DEGRADED</span>
            {' - '}{log.metric}: <span style={{ color: theme.warning }}>{log.value}</span>
            <span style={{ color: theme.textMuted }}> (threshold: {log.threshold})</span>
          </span>
        );
      case 'alert-packet-loss':
        return (
          <span>
            <strong>{log.site}</strong> - High Packet Loss: <span style={{ color: theme.danger }}>{log.value}</span>
            <span style={{ color: theme.textMuted }}> (threshold: {log.threshold})</span>
          </span>
        );
      case 'alert-high-cpu':
        return (
          <span>
            <strong>{log.site}</strong> - High CPU Usage: <span style={{ color: theme.danger }}>{log.value}</span>
            <span style={{ color: theme.textMuted }}> (threshold: {log.threshold})</span>
          </span>
        );
      case 'alert-high-memory':
        return (
          <span>
            <strong>{log.site}</strong> - High Memory Usage: <span style={{ color: theme.danger }}>{log.value}</span>
            <span style={{ color: theme.textMuted }}> (threshold: {log.threshold})</span>
          </span>
        );
      case 'alert-acknowledged':
        return (
          <span>
            <strong>{log.user}</strong> acknowledged alert: <strong>{log.alert}</strong> for <strong>{log.site}</strong>
          </span>
        );
      case 'alert-resolved':
        return (
          <span>
            Alert <strong>{log.alert}</strong> for <strong>{log.site}</strong> resolved
            {log.duration && <span style={{ color: theme.textMuted }}> (duration: {log.duration})</span>}
          </span>
        );
      case 'user-login':
        return (
          <span>
            User <strong>{log.user}</strong> logged in
            {log.ip && <span style={{ color: theme.textMuted }}> from {log.ip}</span>}
          </span>
        );
      case 'site-created':
        return (
          <span>
            <strong>{log.user}</strong> created site <strong>{log.site}</strong>
          </span>
        );
      case 'site-updated':
        return (
          <span>
            <strong>{log.user}</strong> updated <strong>{log.site}</strong>
            {log.changes && <span style={{ color: theme.textMuted }}> ({log.changes})</span>}
          </span>
        );
      case 'site-deleted':
        return (
          <span>
            <strong>{log.user}</strong> deleted site <strong>{log.site}</strong>
          </span>
        );
      case 'system-backup':
        return (
          <span>
            Automatic backup completed - {log.sites} sites backed up
          </span>
        );
      case 'settings-updated':
        return (
          <span>
            <strong>{log.user}</strong> updated <strong>{log.setting}</strong>: {log.oldValue} → {log.newValue}
          </span>
        );
      case 'webhook-triggered':
        return (
          <span>
            Webhook triggered: <strong>{log.event}</strong> sent to <code style={{ color: theme.primary }}>{log.webhook}</code>
          </span>
        );
      case 'report-generated':
        return (
          <span>
            <strong>{log.user}</strong> generated <strong>{log.report}</strong>
          </span>
        );
      default:
        return <span>Unknown event</span>;
    }
  };

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    if (filterType === 'all') return true;
    if (filterType === 'status') return log.type.startsWith('status-');
    if (filterType === 'alerts') return log.type.startsWith('alert-');
    if (filterType === 'user') return ['user-login', 'site-created', 'site-updated', 'site-deleted'].includes(log.type);
    if (filterType === 'system') return ['system-backup', 'settings-updated', 'webhook-triggered', 'report-generated'].includes(log.type);
    return true;
  });

  // Statistics
  const stats = {
    total: auditLogs.length,
    statusChanges: auditLogs.filter(l => l.type.startsWith('status-')).length,
    alerts: auditLogs.filter(l => l.type.startsWith('alert-')).length,
    userActions: auditLogs.filter(l => ['user-login', 'site-created', 'site-updated', 'site-deleted'].includes(l.type)).length,
    systemEvents: auditLogs.filter(l => ['system-backup', 'settings-updated', 'webhook-triggered', 'report-generated'].includes(l.type)).length,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: theme.bgSecondary,
        borderBottom: `1px solid ${theme.border}`,
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: `0 2px 8px ${theme.shadow}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={onBack}
              style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: 'pointer',
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px'
              }}
            >
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={24} color={theme.primary} />
                Audit Log & History
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.textSecondary }}>
                Complete activity log for all sites, alerts, and user actions
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            style={{
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              padding: '8px 12px',
              cursor: 'pointer',
              color: theme.text,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Statistics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '12px', background: theme.card, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px' }}>TOTAL EVENTS</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.total}</div>
          </div>
          <div style={{ padding: '12px', background: theme.card, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px' }}>STATUS CHANGES</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: theme.warning }}>{stats.statusChanges}</div>
          </div>
          <div style={{ padding: '12px', background: theme.card, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px' }}>ALERTS</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: theme.danger }}>{stats.alerts}</div>
          </div>
          <div style={{ padding: '12px', background: theme.card, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px' }}>USER ACTIONS</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: theme.info }}>{stats.userActions}</div>
          </div>
          <div style={{ padding: '12px', background: theme.card, borderRadius: '8px', border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px' }}>SYSTEM EVENTS</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: theme.success }}>{stats.systemEvents}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '16px 24px', background: theme.bgSecondary, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: 600 }}>Filter:</span>
          {[
            { value: 'all', label: 'All Events' },
            { value: 'status', label: 'Status Changes' },
            { value: 'alerts', label: 'Alerts' },
            { value: 'user', label: 'User Actions' },
            { value: 'system', label: 'System Events' }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setFilterType(filter.value)}
              style={{
                padding: '6px 12px',
                background: filterType === filter.value ? theme.primary : theme.card,
                color: filterType === filter.value ? '#fff' : theme.text,
                border: `1px solid ${filterType === filter.value ? theme.primary : theme.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log */}
      <div style={{ padding: '24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredLogs.map((log, index) => {
              const { icon: Icon, color, bg } = getLogIcon(log.type);
              return (
                <div
                  key={log.id}
                  style={{
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderLeft: `4px solid ${color}`,
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'start',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = theme.cardHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = theme.card}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={20} color={color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', marginBottom: '6px' }}>
                      {getLogMessage(log)}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={12} />
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredLogs.length === 0 && (
            <div style={{ padding: '64px', textAlign: 'center', color: theme.textMuted }}>
              <Activity size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No events found</div>
              <div style={{ fontSize: '13px' }}>Try adjusting your filters</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
