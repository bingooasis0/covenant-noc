import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Activity, Wifi, AlertTriangle, Server, Zap, Clock,
  ChevronRight, MapPin, Globe, RefreshCw, Shield,
  CheckCircle, XCircle, AlertCircle, Settings
} from 'lucide-react';

// Obsidian/Neon Theme Constants


// Helper for status color
const getStatusColor = (metrics, theme) => {
  if (!theme) return '#6e7681'; // Fallback if theme not provided
  if (!metrics) return theme.textMuted;
  if (!metrics.isReachable) return theme.danger;
  if (metrics.latency > 150 || metrics.packetLoss > 2) return theme.warning;
  return theme.success;
};

const getStatusText = (metrics) => {
  if (!metrics) return 'UNKNOWN';
  if (!metrics.isReachable) return 'OFFLINE';
  if (metrics.latency > 150 || metrics.packetLoss > 2) return 'DEGRADED';
  return 'HEALTHY';
};

// --- Detailed Grid Card (The "Screenshot" Look) ---
export const DetailedGridCard = ({ site, metrics, history, snmp, api, alerts, onClick, isSelected, theme = {}, onEditSite }) => {
  const statusColor = getStatusColor(metrics, theme);
  const statusText = getStatusText(metrics);

  const graphData = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.slice(-30).map(h => {
      // Preserve null values for latency - don't convert to 0 (0ms is valid, null means no data)
      // The graph library will handle null by not drawing a point, which is correct
      const latency = h.latency !== null && h.latency !== undefined 
        ? Number(h.latency) 
        : null;
      
      const packetLoss = h.packetLoss !== null && h.packetLoss !== undefined 
        ? Number(h.packetLoss) 
        : null;
      
      return {
        latency: latency,
        loss: packetLoss !== null ? packetLoss : 0, // Packet loss: 0 is valid, null becomes 0
        time: h.timestamp
      };
    });
  }, [history]);

  return (
    <div
      onClick={() => onClick(site)}
      style={{
        background: theme.card,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isSelected ? theme.primary : theme.border}`,
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isSelected ? `0 0 20px ${theme.primary}20` : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.borderLight;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
        // Show settings button on hover
        const settingsBtn = e.currentTarget.querySelector('.card-settings-btn');
        if (settingsBtn) settingsBtn.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.border;
          e.currentTarget.style.transform = 'none';
        }
        // Hide settings button
        const settingsBtn = e.currentTarget.querySelector('.card-settings-btn');
        if (settingsBtn) settingsBtn.style.opacity = '0';
      }}
    >
      {/* Settings Gear Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onEditSite) onEditSite(site);
        }}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: theme.bgSecondary,
          border: `1px solid ${theme.border}`,
          color: theme.textSecondary,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'all 0.2s',
          zIndex: 10
        }}
        className="card-settings-btn"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.primary + '15';
          e.currentTarget.style.borderColor = theme.primary;
          e.currentTarget.style.color = theme.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = theme.bgSecondary;
          e.currentTarget.style.borderColor = theme.border;
          e.currentTarget.style.color = theme.textSecondary;
        }}
      >
        <Settings size={16} />
      </button>

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: theme.text }}>
              {site.name}
            </h3>
            <span style={{
              background: `${statusColor}20`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              letterSpacing: '0.05em'
            }}>
              {statusText}
            </span>
            <span style={{ fontSize: '11px', color: theme.textMuted }}>
              Updated {metrics?._lastUpdated ? 'just now' : '-'}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: theme.textMuted, fontWeight: 500 }}>
            {site.customer}
          </div>
        </div>
        {/* Close/Menu placeholder if needed */}
      </div>

      {/* Details Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: theme.textMuted }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} />
          <span style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {site.location || 'Unknown Location'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={14} />
          <span style={{ fontFamily: 'monospace' }}>{site.ip}</span>
        </div>
        {site.failoverIp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} />
            <span style={{ fontFamily: 'monospace' }}>{site.failoverIp}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Server size={14} />
          <span>{site.device || 'Device Type N/A'}</span>
        </div>
      </div>

      {/* Monitoring Tags */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {['ICMP', 'SNMP', 'API'].map(type => {
          const isActive =
            (type === 'ICMP' && site.monitoringIcmp) ||
            (type === 'SNMP' && site.monitoringSnmp) ||
            (type === 'API' && site.monitoringMeraki);

          return (
            <span key={type} style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px',
              background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
              color: isActive ? theme.text : theme.textMuted,
              border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}`
            }}>
              {type}
            </span>
          );
        })}
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
        <MetricBox label="LATENCY" value={`${metrics?.latency ? Math.round(metrics.latency) : '-'} ms`} color={metrics?.latency > 150 ? theme.warning : theme.success} theme={theme} />
        <MetricBox label="PACKET LOSS" value={`${metrics?.packetLoss || 0}%`} color={metrics?.packetLoss > 0 ? theme.danger : theme.text} theme={theme} />
        <MetricBox label="UPTIME" value={metrics?.uptime ? `${metrics.uptime}%` : '-'} color={theme.text} theme={theme} />
        <MetricBox label="ALERTS" value={alerts?.length || 0} color={alerts?.length > 0 ? theme.danger : theme.text} theme={theme} />
      </div>

      {/* Graph Area */}
      <div style={{ height: '80px', width: '100%', marginTop: 'auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={graphData}>
            <defs>
              <linearGradient id={`grad-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={statusColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`grad-loss-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.danger || '#d93025'} stopOpacity={0.5} />
                <stop offset="95%" stopColor={theme.danger || '#d93025'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0].payload;
                return (
                  <div style={{
                    background: theme.card || '#1a1a1a',
                    border: `1px solid ${theme.border || '#333'}`,
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: theme.text || '#fff'
                  }}>
                    <div>Latency: {data.latency ? `${Math.round(data.latency)}ms` : '-'}</div>
                    <div style={{ color: data.loss > 0 ? (theme.danger || '#d93025') : theme.textMuted }}>
                      Loss: {data.loss !== null && data.loss !== undefined ? `${data.loss}%` : '0%'}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="latency"
              stroke={statusColor}
              fill={`url(#grad-${site.id})`}
              strokeWidth={2}
              isAnimationActive={false}
            />
            {/* Packet Loss Visualization - shows as red bars/area when loss > 0 */}
            <Area
              type="monotone"
              dataKey="loss"
              stroke={theme.danger || '#d93025'}
              fill={`url(#grad-loss-${site.id})`}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const MetricBox = ({ label, value, color, theme }) => (
  <div style={{
    background: theme.bgSecondary || (theme.bg === '#0a0e14' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  }}>
    <span style={{ fontSize: '10px', color: theme.textMuted, letterSpacing: '0.05em' }}>{label}</span>
    <span style={{ fontSize: '16px', fontWeight: 700, color: color, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

// --- Compact NOC Card (High Visibility) ---
export const CompactNOCCard = ({ site, metrics, alerts, onClick, isSelected, theme = {} }) => {
  const statusColor = getStatusColor(metrics, theme);
  const statusText = getStatusText(metrics);

  return (
    <div
      onClick={() => onClick(site)}
      style={{
        background: theme.card,
        backdropFilter: 'blur(12px)',
        // Border color indicates status heavily in NOC view
        border: `2px solid ${statusColor}`,
        borderRadius: '8px',
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        position: 'relative',
        boxShadow: `0 0 15px ${statusColor}20`
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: theme.text }}>
            {site.name}
          </h3>
          <div style={{ fontSize: '12px', color: theme.textMuted }}>{site.ip}</div>
        </div>
        <StatusIcon status={statusText} color={statusColor} />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: '16px'
      }}>
        <div>
          <div style={{ fontSize: '10px', color: theme.textMuted }}>LATENCY</div>
          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: theme.text }}>
            {metrics?.latency ? Math.round(metrics.latency) : '-'} <span style={{ fontSize: '12px' }}>ms</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: theme.textMuted }}>LOSS</div>
          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: metrics?.packetLoss > 0 ? theme.danger : theme.text }}>
            {metrics?.packetLoss || 0}%
          </div>
        </div>
      </div>

      {alerts?.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '6px',
          background: theme.danger,
          color: '#fff',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <AlertTriangle size={12} />
          {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

const StatusIcon = ({ status, color }) => {
  if (status === 'OFFLINE') return <XCircle color={color} size={24} />;
  if (status === 'DEGRADED') return <AlertCircle color={color} size={24} />;
  return <CheckCircle color={color} size={24} />;
};


