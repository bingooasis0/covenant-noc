import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Activity, Wifi, AlertTriangle, Server, Zap, Clock, ChevronRight, Shield, Globe, Cpu, Database, BarChart2, Layout, Type } from 'lucide-react';

const COMPONENT_TYPES = {
  HEADER: 'header',
  METRIC_GRID: 'metric_grid',
  GRAPH: 'graph',
  STATUS_BADGE: 'status_badge',
  TEXT: 'text',
  DIVIDER: 'divider',
  SPACER: 'spacer'
};

const NOCCard = ({ site, metrics, history, onClick, isSelected, layout, theme = {}, cardConfig = {} }) => {
  // Calculate status color
  const statusColor = useMemo(() => {
    if (!metrics?.isReachable) return theme.danger || '#d93025';
    if (metrics?.latency > 100 || metrics?.packetLoss > 0) return theme.warning || '#f9ab00';
    return theme.success || '#1e8e3e';
  }, [metrics, theme]);

  // Prepare graph data
  const graphData = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.slice(-30).map(h => ({
      latency: h.latency || 0,
      packetLoss: h.packetLoss || 0,
      timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
  }, [history]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: `1px solid ${theme.border}`,
          padding: '8px',
          borderRadius: '4px',
          boxShadow: theme.shadow,
          fontSize: '11px',
          color: theme.text
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
          <p style={{ margin: 0, color: theme.primary }}>Latency: {payload[0].value}ms</p>
          {payload[1] && payload[1].value > 0 && (
            <p style={{ margin: 0, color: theme.danger }}>Loss: {payload[1].value}%</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Default layout if none provided
  const activeLayout = layout || [
    { id: 'def-1', type: 'header', props: { showIp: true, showDeviceType: true, showFailover: true } },
    { id: 'def-2', type: 'metric_grid', props: { columns: 4, metrics: ['latency', 'packetLoss', 'jitter', 'uptime'] } },
    { id: 'def-3', type: 'graph', props: { height: 100, showAxes: true, showTooltip: true } }
  ];

  const renderComponent = (component) => {
    const { type, props } = component;

    switch (type) {
      case COMPONENT_TYPES.HEADER:
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: theme.text, fontFamily: '"Google Sans", Roboto, Arial, sans-serif' }}>
                  {site.name}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: theme.textSecondary }}>
                {props.showIp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={12} /> {site.ip}
                  </span>
                )}
                {props.showFailover && site.failoverIp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={12} /> {site.failoverIp}
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 400,
                color: metrics?.latency > 100 ? theme.warning : theme.primary,
                fontFamily: 'Roboto, monospace'
              }}>
                {metrics?.latency ? Math.round(metrics.latency) : '--'}
                <span style={{ fontSize: '12px', color: theme.textSecondary, marginLeft: '2px' }}>ms</span>
              </div>
            </div>
          </div>
        );

      case COMPONENT_TYPES.METRIC_GRID:
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${props.columns || 3}, 1fr)`,
            gap: '8px',
            marginBottom: '16px',
            padding: '8px 0',
            borderTop: `1px solid ${theme.border}`,
            borderBottom: `1px solid ${theme.border}`
          }}>
            {(props.metrics || []).map(key => {
              let label = key;
              let value = '--';
              let color = theme.text;
              let unit = '';

              if (key === 'latency') { label = 'Latency'; value = metrics?.latency ? Math.round(metrics.latency) : '--'; unit = 'ms'; }
              if (key === 'packetLoss') { label = 'Loss'; value = metrics?.packetLoss || 0; unit = '%'; color = (metrics?.packetLoss || 0) > 0 ? theme.danger : theme.success; }
              if (key === 'jitter') { label = 'Jitter'; value = metrics?.jitter ? Math.round(metrics.jitter) : 0; unit = 'ms'; }
              if (key === 'uptime') { label = 'Uptime'; value = metrics?.uptime ? metrics.uptime.toFixed(1) : '100.0'; unit = '%'; color = theme.success; }

              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', color: theme.textSecondary, textTransform: 'uppercase' }}>{label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color }}>
                    {value}{unit}
                  </span>
                </div>
              );
            })}
          </div>
        );

      case COMPONENT_TYPES.GRAPH:
        return (
          <div style={{ flex: 1, minHeight: props.height || 60, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 5, right: 0, left: props.showAxes ? -20 : 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gradLat-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.primary} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={theme.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {props.showAxes && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} />}
                  {props.showAxes && (
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 10, fill: theme.textSecondary }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={30}
                    />
                  )}
                  {props.showAxes && (
                    <YAxis
                      tick={{ fontSize: 10, fill: theme.textSecondary }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 'auto']}
                    />
                  )}
                  {props.showTooltip && <Tooltip content={<CustomTooltip />} />}
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke={theme.primary}
                    strokeWidth={2}
                    fill={`url(#gradLat-${site.id})`}
                    isAnimationActive={false}
                  />
                  <Area
                    type="step"
                    dataKey="packetLoss"
                    stroke={theme.danger}
                    fill="transparent"
                    strokeWidth={metrics?.packetLoss > 0 ? 2 : 0}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case COMPONENT_TYPES.TEXT:
        return (
          <div style={{
            fontSize: props.fontSize,
            color: theme[props.color] || theme.text || '#24292f',
            textAlign: props.align,
            marginBottom: '8px'
          }}>
            {props.content}
          </div>
        );

      case COMPONENT_TYPES.DIVIDER:
        return (
          <div style={{
            height: '1px',
            background: theme.border,
            width: '100%',
            margin: `${props.margin} 0`
          }} />
        );

      default:
        return null;
    }
  };

  // Card height configuration - Grafana-style
  const cardHeight = cardConfig.height || 'auto'; // 'auto', number (px), or 'fit-content'
  const minHeight = cardConfig.minHeight || 200; // Minimum height in px
  const maxHeight = cardConfig.maxHeight || null; // Maximum height in px (null = unlimited)

  const heightStyle = cardHeight === 'auto' || cardHeight === 'fit-content' 
    ? { minHeight: `${minHeight}px`, height: 'auto' }
    : { height: typeof cardHeight === 'number' ? `${cardHeight}px` : cardHeight, minHeight: `${minHeight}px` };

  if (maxHeight) {
    heightStyle.maxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;
  }

  return (
    <div
      onClick={() => onClick(site)}
      style={{
        background: theme.card || theme.cardBg || '#ffffff',
        border: `1px solid ${isSelected ? theme.primary : theme.border}`,
        borderRadius: '8px',
        padding: '16px',
        ...heightStyle,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        boxShadow: isSelected ? `0 0 0 2px ${theme.primary}40` : 'none',
        overflow: cardConfig.overflow || 'visible' // Allow overflow for auto-sizing
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.borderLight || theme.border;
          e.currentTarget.style.boxShadow = theme.shadow || 'rgba(0,0,0,0.1) 0 2px 8px';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = theme.border;
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {activeLayout.map(component => (
        <React.Fragment key={component.id}>
          {renderComponent(component)}
        </React.Fragment>
      ))}

      {/* Footer / Status Text (Always at bottom if not in layout) */}
      {!activeLayout.find(c => c.type === 'status_badge') && (
        <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: theme.textMuted }}>
          <span>Last updated: {metrics?._lastUpdated ? new Date(metrics._lastUpdated).toLocaleTimeString() : 'Never'}</span>
          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            background: metrics?.isReachable ? (theme.successBg || '#e6f4ea') : (theme.dangerBg || '#fce8e6'),
            color: metrics?.isReachable ? theme.success : theme.danger,
            fontWeight: 500
          }}>
            {metrics?.isReachable ? 'HEALTHY' : 'CRITICAL'}
          </span>
        </div>
      )}
    </div>
  );
};

export default NOCCard;

