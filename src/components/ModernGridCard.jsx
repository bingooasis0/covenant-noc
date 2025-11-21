import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, Wifi, AlertTriangle, Server, Zap, Clock, ChevronRight } from 'lucide-react';

const ModernGridCard = ({ site, metrics, history, onClick, isSelected, theme = {} }) => {
  // Calculate status color
  const statusColor = useMemo(() => {
    if (!theme.danger || !theme.warning || !theme.success) return '#3fb950'; // Fallback
    if (!metrics?.isReachable) return theme.danger;
    if (metrics?.latency > 100 || metrics?.packetLoss > 0) return theme.warning;
    return theme.success;
  }, [metrics, theme]);

  const statusGlow = `0 0 10px ${statusColor}40`;

  // Prepare graph data (downsample if needed for performance)
  const graphData = useMemo(() => {
    if (!history || history.length === 0) return [];
    // Take last 20 points for the sparkline
    return history.slice(-20).map(h => ({
      latency: h.latency || 0,
      packetLoss: h.packetLoss || 0,
      timestamp: h.timestamp
    }));
  }, [history]);

  return (
    <div
      onClick={() => onClick(site)}
      style={{
        background: theme.card,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isSelected ? theme.primary : theme.border}`,
        borderRadius: '12px',
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isSelected ? `0 0 20px ${theme.primary}20` : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = theme.borderLight;
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.borderColor = theme.border;
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: theme.text,
            letterSpacing: '0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusColor,
              boxShadow: statusGlow
            }} />
            {site.name}
          </h3>
          <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '2px' }}>
            {site.ip}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: metrics?.latency > 100 ? theme.warning : theme.primary,
            fontFamily: 'monospace'
          }}>
            {metrics?.latency ? Math.round(metrics.latency) : '--'}
            <span style={{ fontSize: '10px', color: theme.textMuted, marginLeft: '2px' }}>ms</span>
          </div>
        </div>
      </div>

      {/* Graphs Area */}
      <div style={{ flex: 1, minHeight: '60px', margin: '0 -8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={graphData}>
            <defs>
              <linearGradient id={`gradLat-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={theme.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="latency"
              stroke={theme.primary}
              strokeWidth={1.5}
              fill={`url(#gradLat-${site.id})`}
              isAnimationActive={false}
            />
            {/* Overlay Packet Loss if any */}
            <Area
              type="step"
              dataKey="packetLoss"
              stroke={theme.danger}
              fill="transparent"
              strokeWidth={metrics?.packetLoss > 0 ? 1 : 0}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '8px',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: `1px solid ${theme.border}`
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', color: theme.textMuted }}>LOSS</span>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: (metrics?.packetLoss || 0) > 0 ? theme.danger : theme.success
          }}>
            {metrics?.packetLoss || 0}%
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', color: theme.textMuted }}>JITTER</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: theme.text }}>
            {metrics?.jitter ? Math.round(metrics.jitter) : 0}ms
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '10px', color: theme.textMuted }}>UPTIME</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: theme.success }}>
            {/* Placeholder for uptime, can be calculated */}
            99.9%
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModernGridCard;
