import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Globe, Shield, Image } from 'lucide-react';
import { COMPONENT_TYPES } from './ComponentRegistry';

// High-fidelity mock data for preview
const MOCK_METRICS = {
    latency: 24,
    packetLoss: 0,
    jitter: 2,
    uptime: 99.9,
    isReachable: true,
    _lastUpdated: new Date().toISOString(),
    logs: [
        { timestamp: new Date().toISOString(), level: 'info', message: 'Interface GigabitEthernet1/0/1 up' },
        { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'warn', message: 'High latency detected' },
        { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'info', message: 'Configuration saved' }
    ]
};

const MOCK_SNMP = {
    uptime: 10368000, // 120 days
    cpuUsage: 15,
    memoryUsage: 42,
    interfaceStats: [
        { name: 'Gi1/0/1', status: 'up', inOctets: 50000000, outOctets: 30000000, inPackets: 15000, outPackets: 12000 },
        { name: 'Gi1/0/2', status: 'up', inOctets: 1000000, outOctets: 500000, inPackets: 500, outPackets: 300 }
    ]
};

const MOCK_HISTORY = Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString(),
    latency: 20 + Math.random() * 10,
    packetLoss: Math.random() > 0.9 ? 2 : 0,
    jitter: Math.random() * 2
}));

const MOCK_SITE = {
    name: 'Preview Site',
    ip: '192.168.1.1',
    failoverIp: '10.0.0.1'
};

export const CardRenderer = ({ component, theme }) => {
    const { type, props } = component;
    const metrics = MOCK_METRICS;
    const snmp = MOCK_SNMP;
    const history = MOCK_HISTORY;
    const site = MOCK_SITE;

    // Helper to safely get metric values (Copied from NOCCard logic)
    const getMetricValue = (key) => {
        if (!key) return null;
        
        if (key === 'latency') return metrics?.latency;
        if (key === 'packetLoss') return metrics?.packetLoss;
        if (key === 'jitter') return metrics?.jitter;
        
        if (key === 'uptime') return 100; // Mock availability
        if (key === 'sysUptime') return '120d';
        
        if (key === 'cpu') return snmp?.cpuUsage;
        if (key === 'memory') return snmp?.memoryUsage;
        
        if (['packetsIn', 'packetsOut', 'trafficIn', 'trafficOut'].includes(key)) {
            const total = snmp.interfaceStats.reduce((acc, iface) => {
                if (key === 'packetsIn') return acc + (iface.inPackets || 0);
                if (key === 'packetsOut') return acc + (iface.outPackets || 0);
                if (key === 'trafficIn') return acc + (iface.inOctets || 0) * 8; 
                if (key === 'trafficOut') return acc + (iface.outOctets || 0) * 8; 
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

    // Prepare graph data
    const graphData = useMemo(() => {
        return history.map(h => ({
            latency: h.latency,
            packetLoss: h.packetLoss,
            timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
    }, []);

    // Prepare traffic mock data
    const trafficData = useMemo(() => {
        return history.map((h, i) => ({
            i,
            in: Math.max(0, (h.latency || 0) * 100000 + Math.random() * 500000), 
            out: Math.max(0, (h.latency || 0) * 80000 + Math.random() * 300000)
        }));
    }, []);

    const statusColor = '#1e8e3e'; // Fixed healthy color for preview

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
            borderRadius: props.borderRadius,
            width: '100%'
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
                color: theme.primary,
                fontFamily: 'Roboto, monospace'
              }}>
                {Math.round(metrics.latency)}
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
            borderBottom: `1px solid ${theme.border}`,
            width: '100%'
          }}>
            {(props.metrics || []).map(key => {
              let label = key;
              let unit = '';
              let color = theme.text;
              
              const rawValue = getMetricValue(key);
              const value = formatValue(key, rawValue);

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
        const graphStrokeColor = props.color && props.color !== 'transparent' ? props.color : theme.primary;
        const graphFillColor = props.fillOpacity ? graphStrokeColor : 'transparent';
        const graphFillOpacity = props.fillOpacity || 0.1;

        return (
          <div style={{ flex: 1, minHeight: props.height || 60, width: '100%', position: 'relative', padding: props.padding, borderRadius: props.borderRadius, background: theme[props.backgroundColor] || props.backgroundColor || 'transparent' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 5, right: 0, left: props.showAxes ? -20 : 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gradLat-preview-${Math.random()}`} x1="0" y1="0" x2="0" y2="1">
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
                  <Tooltip contentStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke={graphStrokeColor}
                    strokeWidth={2}
                    fill={`url(#gradLat-preview-${Math.random()})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case COMPONENT_TYPES.TRAFFIC_GRAPH:
        return (
            <div style={{ height: props.height || 100, width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trafficData}>
                        <defs>
                            <linearGradient id={`gradIn-preview-${Math.random()}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={props.inColor || '#10b981'} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={props.inColor || '#10b981'} stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id={`gradOut-preview-${Math.random()}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={props.outColor || '#3b82f6'} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={props.outColor || '#3b82f6'} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area 
                            type="monotone" 
                            dataKey="in" 
                            stroke={props.inColor || '#10b981'} 
                            fill={`url(#gradIn-preview-${Math.random()})`} 
                            strokeWidth={2}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="out" 
                            stroke={props.outColor || '#3b82f6'} 
                            fill={`url(#gradOut-preview-${Math.random()})`} 
                            strokeWidth={2} 
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
            borderRadius: props.borderRadius,
            width: '100%'
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
        return <div style={{ height: props.height || 20, width: '100%' }} />;

      case COMPONENT_TYPES.STATUS_BADGE:
        const isHealthy = true;
        return (
          <div style={{
            display: 'flex',
            width: props.fullWidth ? '100%' : 'fit-content',
            padding: '6px 12px',
            borderRadius: '20px', 
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
            <div style={{ height: props.height || 120, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
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
                marginBottom: '8px',
                width: '100%'
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
        const sparkData = history.map((h, i) => ({
            i,
            value: sparkMetric === 'packetLoss' ? (h.packetLoss || 0) : (h.latency || 0)
        }));
        
        const sparkColor = props.color || (sparkMetric === 'packetLoss' ? theme.danger : theme.primary) || '#2f81f7';

        return (
            <div style={{ height: props.height || 40, marginBottom: '8px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData}>
                        <defs>
                            <linearGradient id={`spark-preview-${Math.random()}-${sparkMetric}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={sparkColor} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={sparkColor} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={sparkColor} 
                            fill={props.showArea ? `url(#spark-preview-${Math.random()}-${sparkMetric})` : 'none'} 
                            strokeWidth={2}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );

      case COMPONENT_TYPES.LOG_STREAM:
        const logs = metrics.logs;
        return (
            <div style={{ 
                height: props.height || 150, 
                width: '100%',
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
                width: '100%',
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
                width: '100%',
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
            <div style={{ marginBottom: '8px', width: '100%', height: props.height === 'auto' ? 'auto' : props.height, overflowY: 'auto' }}>
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
        return <div style={{ fontSize: '12px', color: theme.textMuted }}>Unknown Component</div>;
    }
};

