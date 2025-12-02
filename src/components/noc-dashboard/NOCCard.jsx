import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Activity, Wifi, AlertTriangle, Server, Zap, Clock, ChevronRight, Shield, Globe, Cpu, Database, BarChart2, Layout, Type, TrendingUp, List, Image } from 'lucide-react';

const COMPONENT_TYPES = {
  HEADER: 'header',
  METRIC_GRID: 'metric_grid',
  GRAPH: 'graph',
  SINGLE_METRIC: 'single_metric',
  SPARKLINE: 'sparkline',
  STATUS_BADGE: 'status_badge',
  LOG_STREAM: 'log_stream',
  TEXT: 'text',
  DIVIDER: 'divider',
  SPACER: 'spacer',
  GAUGE: 'gauge',
  MARKDOWN: 'markdown',
  IMAGE: 'image',
  KEY_VALUE_LIST: 'key_value_list'
};

const NOCCard = ({ site, metrics, history, snmp, onClick, isSelected, layout, theme = {}, cardConfig = {} }) => {
  // Helper to safely get metric values
  const getMetricValue = (key) => {
    if (!key) return null;
    
    // Standard metrics
    if (key === 'latency') return metrics?.latency;
    if (key === 'packetLoss') return metrics?.packetLoss;
    if (key === 'jitter') return metrics?.jitter;
    
    // Uptime: Availability (Site Health) based on ping history if available, otherwise ping success
    if (key === 'uptime') {
      if (history && history.length > 0) {
        const successfulPings = history.filter(h => (h.packetLoss === null || h.packetLoss < 100) && h.latency !== null).length;
        return (successfulPings / history.length) * 100;
      }
      return metrics?.isReachable ? 100 : 0;
    }
    
    // System Uptime (from SNMP)
    if (key === 'sysUptime') return snmp?.uptime ? (snmp.uptime / 86400).toFixed(1) + 'd' : '--';
    
    if (key === 'cpu') return snmp?.cpuUsage;
    if (key === 'memory') return snmp?.memoryUsage;
    
    // Traffic metrics (aggregated from interfaces)
    if (['packetsIn', 'packetsOut', 'trafficIn', 'trafficOut'].includes(key)) {
      if (!snmp?.interfaceStats || !Array.isArray(snmp.interfaceStats)) return 0;
      
      const total = snmp.interfaceStats.reduce((acc, iface) => {
        if (key === 'packetsIn') return acc + (iface.inPackets || 0);
        if (key === 'packetsOut') return acc + (iface.outPackets || 0);
        if (key === 'trafficIn') return acc + (iface.inOctets || 0) * 8; // Bytes to bits
        if (key === 'trafficOut') return acc + (iface.outOctets || 0) * 8; // Bytes to bits
        return acc;
      }, 0);
      return total;
    }
    
    if (key === 'interfaces') return snmp?.interfaceStats?.length || 0;
    
    return null;
  };

  // Helper to format values
  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '--';
    
    if (key === 'latency' || key === 'jitter') return Math.round(value);
    if (key === 'packetLoss' || key === 'cpu' || key === 'memory') return Math.round(value);
    if (key === 'uptime') return typeof value === 'number' ? value.toFixed(1) : value;
    if (key === 'sysUptime') return value; 
    
    if (['packetsIn', 'packetsOut'].includes(key)) {
      if (value > 1000000) return (value / 1000000).toFixed(1) + 'M';
      if (value > 1000) return (value / 1000).toFixed(1) + 'k';
      return value;
    }
    
    if (['trafficIn', 'trafficOut', 'bandwidth'].includes(key)) {
      if (value > 1000000000) return (value / 1000000000).toFixed(1) + 'G';
      if (value > 1000000) return (value / 1000000).toFixed(1) + 'M';
      if (value > 1000) return (value / 1000).toFixed(1) + 'k';
      return value;
    }
    
    return value;
  };

  // Calculate status color
  const statusColor = useMemo(() => {
    if (!metrics?.isReachable) return theme.danger || '#d93025';
    if (metrics?.latency > 100 || metrics?.packetLoss > 0) return theme.warning || '#f9ab00';
    return theme.success || '#1e8e3e';
  }, [metrics, theme]);

  // Prepare graph data - preserve null values for accurate representation
  const graphData = useMemo(() => {
    if (!history || !Array.isArray(history) || history.length === 0) return [];
    
    // Need at least 2 points for AreaChart to render a line
    const dataPoints = history.slice(-30);
    if (dataPoints.length === 1) {
      // Duplicate the single point to create a visible line
      dataPoints.push({ ...dataPoints[0] });
    }
    
    return dataPoints.map(h => {
      // Preserve null values - don't convert to 0 (0ms is valid latency, null means no data)
      const latency = h.latency !== null && h.latency !== undefined 
        ? Number(h.latency) 
        : null;
      
      const packetLoss = h.packetLoss !== null && h.packetLoss !== undefined 
        ? Number(h.packetLoss) 
        : null;
      
      return {
        latency: latency,
        packetLoss: packetLoss !== null ? packetLoss : 0, // Packet loss: 0 is valid
        timestamp: h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
      };
    });
  }, [history]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Determine if dark mode based on theme background color
      const isDark = theme.bg === '#0a0e14' || theme.bg === '#13161c' || theme.bg?.startsWith('#0') || theme.bg?.startsWith('#1');
      
      return (
        <div style={{
          background: isDark ? (theme.card || '#13161c') : '#ffffff',
          border: `1px solid ${theme.border || (isDark ? '#1f2429' : '#d0d7de')}`,
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.6)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
          fontSize: '11px',
          color: theme.text || (isDark ? '#e6edf3' : '#24292f'),
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: theme.text || (isDark ? '#e6edf3' : '#24292f') }}>{label}</p>
          <p style={{ margin: '0 0 2px 0', color: theme.primary || '#2f81f7' }}>Latency: {payload[0].value}ms</p>
          {payload[1] && payload[1].value > 0 && (
            <p style={{ margin: 0, color: theme.danger || '#f85149' }}>Loss: {payload[1].value}%</p>
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
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '12px',
            padding: props.padding || '0 0 8px 0',
            background: theme[props.backgroundColor] || props.backgroundColor || 'transparent',
            borderBottom: props.borderBottom ? `1px solid ${theme.border}` : 'none',
            borderRadius: props.borderRadius
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor }} />
                <h3 style={{ 
                    margin: 0, 
                    fontSize: props.fontSize || '16px', 
                    fontWeight: props.fontWeight || 500, 
                    color: theme[props.textColor] || props.textColor || theme.text, 
                    fontFamily: '"Google Sans", Roboto, Arial, sans-serif' 
                }}>
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
              let unit = '';
              let color = theme.text;
              
              const rawValue = getMetricValue(key);
              const value = formatValue(key, rawValue);

              // Custom labels/units
              if (key === 'latency') { label = 'Latency'; unit = 'ms'; }
              if (key === 'packetLoss') { label = 'Loss'; unit = '%'; color = rawValue > 0 ? theme.danger : theme.success; }
              if (key === 'jitter') { label = 'Jitter'; unit = 'ms'; }
              if (key === 'uptime') { label = 'Uptime'; unit = ''; color = theme.success; }
              if (key === 'cpu') { label = 'CPU'; unit = '%'; }
              if (key === 'memory') { label = 'Mem'; unit = '%'; }
              if (key === 'packetsIn') { label = 'Pkts In'; unit = ''; }
              if (key === 'packetsOut') { label = 'Pkts Out'; unit = ''; }
              if (key === 'trafficIn') { label = 'In'; unit = 'bps'; }
              if (key === 'trafficOut') { label = 'Out'; unit = 'bps'; }

              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', color: theme.textSecondary, textTransform: 'uppercase' }}>{label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color }}>
                    {value}<span style={{ fontSize: '0.8em', marginLeft: '1px', opacity: 0.7 }}>{unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
        );

      case COMPONENT_TYPES.GRAPH:
        // Ensure colors are valid, fallback to defaults
        const graphStrokeColor = props.color && props.color !== 'transparent' ? props.color : theme.primary;
        const graphFillColor = props.fillOpacity ? graphStrokeColor : 'transparent';
        const graphFillOpacity = props.fillOpacity || 0.1;

        return (
          <div style={{ flex: 1, minHeight: props.height || 60, position: 'relative', padding: props.padding, borderRadius: props.borderRadius, background: theme[props.backgroundColor] || props.backgroundColor || 'transparent' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 5, right: 0, left: props.showAxes ? -20 : 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gradLat-${site.id}-${component.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={graphStrokeColor} stopOpacity={graphFillOpacity} />
                      <stop offset="95%" stopColor={graphStrokeColor} stopOpacity={0} />
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
                    stroke={graphStrokeColor}
                    strokeWidth={2}
                    fill={`url(#gradLat-${site.id}-${component.id})`}
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

      case COMPONENT_TYPES.TRAFFIC_GRAPH:
        // Fallback data if no history available
        // Currently using mock data to visualize the graph component structure since backend history doesn't include traffic yet
        // In a production environment with traffic history, this would map h.trafficIn/out
        const trafficData = (history || []).slice(-20).map((h, i) => ({
            i,
            // If we had historical traffic data it would go here. 
            // For now, we display 0 to indicate missing data rather than fake data
            in: 0, 
            out: 0
        }));

        // If we have current SNMP data, let's at least show the latest point or something
        // But a graph with 1 point is just a dot.
        // Better to show a placeholder message if no data.
        const hasTrafficData = false; // Always false for now as we don't have history

        if (!hasTrafficData) {
             return (
                <div style={{ 
                    height: props.height || 100, 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: theme.bgSecondary,
                    borderRadius: '4px',
                    color: theme.textSecondary,
                    fontSize: '11px'
                }}>
                    No Traffic History Available
                </div>
             );
        }

        return (
            <div style={{ height: props.height || 100, width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trafficData}>
                        <defs>
                            <linearGradient id={`gradIn-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={props.inColor || '#10b981'} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={props.inColor || '#10b981'} stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id={`gradOut-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={props.outColor || '#3b82f6'} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={props.outColor || '#3b82f6'} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Tooltip 
                            contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, fontSize: '11px' }}
                            labelStyle={{ color: theme.text }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="in" 
                            stroke={props.inColor || '#10b981'} 
                            fill={`url(#gradIn-${site.id})`} 
                            strokeWidth={2}
                            name="Inbound"
                        />
                        <Area 
                            type="monotone" 
                            dataKey="out" 
                            stroke={props.outColor || '#3b82f6'} 
                            fill={`url(#gradOut-${site.id})`} 
                            strokeWidth={2} 
                            name="Outbound"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );

      case COMPONENT_TYPES.TEXT:
        return (
          <div style={{
            fontSize: props.fontSize,
            fontWeight: props.fontWeight,
            color: theme[props.color] || props.color || theme.text || '#24292f',
            textAlign: props.align,
            marginBottom: '8px',
            background: theme[props.backgroundColor] || props.backgroundColor || 'transparent',
            padding: props.padding,
            borderRadius: props.borderRadius
          }}>
            {props.content}
          </div>
        );

      case COMPONENT_TYPES.DIVIDER:
        return (
          <div style={{
            height: props.thickness || '1px',
            background: theme[props.color] || props.color || theme.border,
            width: '100%',
            margin: `${props.margin} 0`
          }} />
        );

      case COMPONENT_TYPES.SPACER:
        return <div style={{ height: props.height || 20 }} />;

      case COMPONENT_TYPES.STATUS_BADGE:
        const isHealthy = metrics?.isReachable;
        return (
          <div style={{
            display: 'flex',
            width: props.fullWidth ? '100%' : 'fit-content',
            padding: '6px 12px',
            borderRadius: '20px', // Pill shape
            background: isHealthy ? (theme.successBg || '#e6f4ea') : (theme.dangerBg || '#fce8e6'),
            color: isHealthy ? (theme.success || '#1e8e3e') : (theme.danger || '#d93025'),
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            margin: '8px 0'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
            {props.showLabel && (isHealthy ? 'Operational' : 'Critical')}
          </div>
        );

      case COMPONENT_TYPES.GAUGE:
        const gaugeValue = getMetricValue(props.metric) || 0;
        const gaugeMax = props.max || 100;
        
        const gaugeFillColor = (() => {
             if (props.metric === 'packetLoss' && gaugeValue > 0) return theme.danger || '#d93025';
             if (props.metric === 'latency' && gaugeValue > 100) return theme.warning || '#f9ab00';
             return theme.primary || '#2f81f7';
        })();

        const gaugeData = [
            { value: gaugeValue },
            { value: Math.max(0, gaugeMax - gaugeValue) }
        ];
        
        return (
            <div style={{ height: props.height || 120, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={gaugeData}
                            cx="50%"
                            cy="70%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={props.thickness ? `${80 - props.thickness}%` : "60%"}
                            outerRadius="80%"
                            dataKey="value"
                            stroke="none"
                        >
                            <Cell fill={gaugeFillColor} />
                            <Cell fill={theme.border || '#e0e0e0'} />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '65%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: theme.text }}>
                        {formatValue(props.metric, gaugeValue)}<span style={{ fontSize: '0.6em' }}>
                            {props.metric === 'latency' ? 'ms' : (props.metric === 'packetLoss' ? '%' : '')}
                        </span>
                    </div>
                    {props.showLabel && (
                        <div style={{ fontSize: '11px', color: theme.textSecondary, textTransform: 'uppercase' }}>
                            {props.metric}
                        </div>
                    )}
                </div>
            </div>
        );

      case COMPONENT_TYPES.SINGLE_METRIC:
         const singleValue = getMetricValue(props.metric);
         const singleFormatted = formatValue(props.metric, singleValue);
         
         // Determine unit for display
         let singleUnit = '';
         if (props.metric === 'latency' || props.metric === 'jitter') singleUnit = 'ms';
         if (props.metric === 'packetLoss' || props.metric === 'uptime' || props.metric === 'cpu' || props.metric === 'memory') singleUnit = '%';
         if (props.metric.startsWith('traffic')) singleUnit = 'bps';

         return (
            <div style={{ 
                padding: props.padding, 
                background: theme[props.backgroundColor] || props.backgroundColor || 'transparent',
                borderRadius: props.borderRadius,
                display: 'flex',
                flexDirection: 'column',
                alignItems: props.alignment || 'center',
                justifyContent: 'center',
                height: props.height,
                marginBottom: '8px'
            }}>
                <div style={{ fontSize: props.fontSize || '24px', fontWeight: 700, color: theme[props.textColor] || theme.text }}>
                    {singleFormatted}<span style={{ fontSize: '0.6em', opacity: 0.7, marginLeft: '2px' }}>{singleUnit}</span>
                </div>
                {props.label && (
                    <div style={{ fontSize: '12px', color: theme[props.labelColor] || theme.textSecondary }}>
                        {props.label}
                    </div>
                )}
            </div>
         );

      case COMPONENT_TYPES.SPARKLINE:
        const sparkMetric = props.metric || 'latency';
        const sparkData = (history || []).slice(-20).map((h, i) => ({
            i,
            value: sparkMetric === 'packetLoss' ? (h.packetLoss || 0) : (h.latency || 0)
        }));
        
        const sparkColor = props.color || (sparkMetric === 'packetLoss' ? theme.danger : theme.primary) || '#2f81f7';

        return (
            <div style={{ height: props.height || 40, marginBottom: '8px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData}>
                        <defs>
                            <linearGradient id={`spark-${site.id}-${sparkMetric}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={sparkColor} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={sparkColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={sparkColor} 
                            fill={props.showArea ? `url(#spark-${site.id}-${sparkMetric})` : 'none'} 
                            strokeWidth={2}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );

      case COMPONENT_TYPES.LOG_STREAM:
        const logs = (metrics?.logs || []).slice(0, props.limit || 5);
        return (
            <div style={{ 
                height: props.height || 150, 
                overflowY: 'auto', 
                background: theme.bgSecondary || '#f6f8fa', 
                borderRadius: '4px',
                padding: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                marginBottom: '8px'
            }}>
                {logs.length > 0 ? logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: '4px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '4px' }}>
                        {props.showTimestamp && <span style={{ color: theme.textSecondary, marginRight: '8px' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>}
                        <span style={{ color: log.level === 'error' ? theme.danger : theme.text }}>{log.message}</span>
                    </div>
                )) : (
                    <div style={{ color: theme.textSecondary, fontStyle: 'italic' }}>No logs available</div>
                )}
            </div>
        );

      case COMPONENT_TYPES.MARKDOWN:
        // Basic markdown rendering (headers, lists, bold)
        const renderMarkdown = (text) => {
            if (!text) return null;
            return text.split('\n').map((line, i) => {
                if (line.startsWith('### ')) return <h5 key={i} style={{ margin: '4px 0', fontSize: '14px' }}>{line.replace('### ', '')}</h5>;
                if (line.startsWith('## ')) return <h4 key={i} style={{ margin: '6px 0', fontSize: '16px' }}>{line.replace('## ', '')}</h4>;
                if (line.startsWith('# ')) return <h3 key={i} style={{ margin: '8px 0', fontSize: '18px' }}>{line.replace('# ', '')}</h3>;
                if (line.startsWith('* ') || line.startsWith('- ')) return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 4, height: 4, borderRadius: '50%', background: theme.text }} />{line.replace(/^[*-] /, '')}</div>;
                return <div key={i} style={{ marginBottom: '4px' }}>{line}</div>;
            });
        };
        return (
            <div style={{ 
                height: props.height, 
                overflowY: 'auto', 
                fontSize: '12px', 
                color: theme.text,
                marginBottom: '8px'
            }}>
                {renderMarkdown(props.content)}
            </div>
        );

      case COMPONENT_TYPES.IMAGE:
        return (
            <div style={{ 
                height: props.height || 150, 
                marginBottom: '8px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                background: theme.bgSecondary,
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                {props.url ? (
                    <img 
                        src={props.url} 
                        alt="Card graphic" 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: props.fit || 'contain' 
                        }} 
                    />
                ) : (
                    <div style={{ color: theme.textSecondary, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Image size={24} />
                        <span>No Image URL</span>
                    </div>
                )}
            </div>
        );

      case COMPONENT_TYPES.KEY_VALUE_LIST:
        return (
            <div style={{ marginBottom: '8px', height: props.height === 'auto' ? 'auto' : props.height, overflowY: 'auto' }}>
                {(props.items || []).map((item, i) => (
                    <div key={i} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        padding: '4px 0',
                        borderBottom: i < props.items.length - 1 ? `1px solid ${theme.border}` : 'none',
                        fontSize: '12px'
                    }}>
                        <span style={{ color: theme.textSecondary }}>{item.key}</span>
                        <span style={{ fontWeight: 500, color: theme.text }}>{item.value}</span>
                    </div>
                ))}
            </div>
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

