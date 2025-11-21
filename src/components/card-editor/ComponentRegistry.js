import {
    Activity, AlertTriangle, TrendingUp, Zap, Database, Clock, Wifi, BarChart2,
    Type, Image, Layout, Shield, Globe, Cpu, Server, List
} from 'lucide-react';

export const COMPONENT_TYPES = {
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

export const AVAILABLE_COMPONENTS = [
    {
        type: COMPONENT_TYPES.HEADER,
        label: 'Header',
        icon: Layout,
        description: 'Displays site name, IP, and current latency',
        defaultProps: {
            showIp: true,
            showDeviceType: true,
            showFailover: true,
            backgroundColor: 'transparent',
            textColor: 'text',
            fontSize: '14px',
            padding: '8px'
        }
    },
    {
        type: COMPONENT_TYPES.METRIC_GRID,
        label: 'Metrics Grid',
        icon: Activity,
        description: 'Grid layout for displaying multiple metrics',
        defaultProps: {
            columns: 3,
            metrics: ['latency', 'packetLoss', 'jitter'],
            backgroundColor: 'transparent',
            labelColor: 'textSecondary',
            valueColor: 'text',
            fontSize: '12px',
            padding: '0px'
        }
    },
    {
        type: COMPONENT_TYPES.GRAPH,
        label: 'Latency Graph',
        icon: TrendingUp,
        description: 'Line graph showing latency over time',
        defaultProps: {
            height: 60,
            showAxes: false,
            showTooltip: true,
            color: '#2f81f7',
            backgroundColor: 'transparent',
            borderRadius: '4px',
            padding: '0px'
        }
    },
    {
        type: COMPONENT_TYPES.SINGLE_METRIC,
        label: 'Single Metric',
        icon: Zap,
        description: 'Large display for a single important metric',
        defaultProps: {
            metric: 'latency',
            label: 'Current Latency',
            showTrend: true,
            height: 80,
            fontSize: '24px',
            backgroundColor: 'bgTertiary',
            textColor: 'text',
            labelColor: 'textSecondary',
            borderRadius: '6px',
            padding: '8px'
        }
    },
    {
        type: COMPONENT_TYPES.SPARKLINE,
        label: 'Sparkline',
        icon: TrendingUp,
        defaultProps: {
            metric: 'latency',
            height: 40,
            color: '#10b981',
            showArea: true
        }
    },
    {
        type: COMPONENT_TYPES.STATUS_BADGE,
        label: 'Status Badge',
        icon: AlertTriangle,
        defaultProps: {
            showLabel: true,
            fullWidth: false,
            height: 40
        }
    },
    {
        type: COMPONENT_TYPES.LOG_STREAM,
        label: 'Log Stream',
        icon: List,
        defaultProps: {
            limit: 5,
            height: 150,
            showTimestamp: true
        }
    },
    {
        type: COMPONENT_TYPES.TEXT,
        label: 'Static Text',
        icon: Type,
        defaultProps: {
            content: 'Label',
            fontSize: '12px',
            color: 'textSecondary',
            align: 'left'
        }
    },
    {
        type: COMPONENT_TYPES.DIVIDER,
        label: 'Divider',
        icon: Layout,
        defaultProps: {
            margin: '8px'
        }
    },
    {
        type: COMPONENT_TYPES.SPACER,
        label: 'Spacer',
        icon: Layout,
        description: 'Empty vertical space for layout control',
        defaultProps: {
            height: 20,
            backgroundColor: 'transparent'
        }
    },
    {
        type: COMPONENT_TYPES.GAUGE,
        label: 'Gauge',
        icon: Activity,
        defaultProps: {
            metric: 'cpu',
            height: 120,
            min: 0,
            max: 100,
            showLabel: true
        }
    },
    {
        type: COMPONENT_TYPES.MARKDOWN,
        label: 'Markdown',
        icon: Type,
        defaultProps: {
            content: '### Title\n*List item*',
            height: 100
        }
    },
    {
        type: COMPONENT_TYPES.IMAGE,
        label: 'Image',
        icon: Image,
        defaultProps: {
            url: 'https://via.placeholder.com/150',
            height: 150,
            fit: 'contain'
        }
    },
    {
        type: COMPONENT_TYPES.KEY_VALUE_LIST,
        label: 'Key-Value List',
        icon: List,
        defaultProps: {
            items: [{ key: 'OS', value: 'Linux' }, { key: 'Version', value: '1.0.0' }],
            height: 'auto'
        }
    }
];

export const AVAILABLE_METRICS = [
    { key: 'latency', label: 'Latency', icon: Activity, category: 'ICMP' },
    { key: 'packetLoss', label: 'Packet Loss', icon: AlertTriangle, category: 'ICMP' },
    { key: 'jitter', label: 'Jitter', icon: TrendingUp, category: 'ICMP' },
    { key: 'uptime', label: 'Uptime', icon: Clock, category: 'SNMP' },
    { key: 'cpu', label: 'CPU', icon: Cpu, category: 'SNMP' },
    { key: 'memory', label: 'Memory', icon: Database, category: 'SNMP' },
    { key: 'interfaces', label: 'Interfaces', icon: Wifi, category: 'SNMP' },
    { key: 'bandwidth', label: 'Bandwidth', icon: BarChart2, category: 'SNMP' }
];
