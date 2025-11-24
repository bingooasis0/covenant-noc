import {
    Activity, AlertTriangle, TrendingUp, Zap, Database, Clock, Wifi, BarChart2,
    Type, Image, Layout, Shield, Globe, Cpu, Server, List, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';

export const COMPONENT_TYPES = {
    HEADER: 'header',
    METRIC_GRID: 'metric_grid',
    GRAPH: 'graph',
    TRAFFIC_GRAPH: 'traffic_graph',
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

export const COMPONENT_CATEGORIES = {
    LAYOUT: 'Layout',
    METRICS: 'Metrics',
    GRAPHS: 'Graphs',
    CONTENT: 'Text & Media'
};

export const AVAILABLE_COMPONENTS = [
    // --- LAYOUT ---
    {
        type: COMPONENT_TYPES.HEADER,
        category: COMPONENT_CATEGORIES.LAYOUT,
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
            padding: '8px',
            borderBottom: true
        }
    },
    {
        type: COMPONENT_TYPES.DIVIDER,
        category: COMPONENT_CATEGORIES.LAYOUT,
        label: 'Divider',
        icon: Layout,
        defaultProps: {
            margin: '8px',
            color: 'border',
            thickness: '1px'
        }
    },
    {
        type: COMPONENT_TYPES.SPACER,
        category: COMPONENT_CATEGORIES.LAYOUT,
        label: 'Spacer',
        icon: Layout,
        description: 'Empty vertical space for layout control',
        defaultProps: {
            height: 20,
            backgroundColor: 'transparent'
        }
    },

    // --- METRICS ---
    {
        type: COMPONENT_TYPES.METRIC_GRID,
        category: COMPONENT_CATEGORIES.METRICS,
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
            padding: '0px',
            showIcons: true
        }
    },
    {
        type: COMPONENT_TYPES.SINGLE_METRIC,
        category: COMPONENT_CATEGORIES.METRICS,
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
            padding: '8px',
            alignment: 'center'
        }
    },
    {
        type: COMPONENT_TYPES.STATUS_BADGE,
        category: COMPONENT_CATEGORIES.METRICS,
        label: 'Status Badge',
        icon: AlertTriangle,
        defaultProps: {
            showLabel: true,
            fullWidth: false,
            height: 40,
            fontSize: '12px',
            borderRadius: '20px'
        }
    },
    {
        type: COMPONENT_TYPES.GAUGE,
        category: COMPONENT_CATEGORIES.METRICS,
        label: 'Gauge',
        icon: Activity,
        defaultProps: {
            metric: 'cpu',
            height: 120,
            min: 0,
            max: 100,
            showLabel: true,
            thickness: 10
        }
    },

    // --- GRAPHS ---
    {
        type: COMPONENT_TYPES.GRAPH,
        category: COMPONENT_CATEGORIES.GRAPHS,
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
            padding: '0px',
            fillOpacity: 0.1
        }
    },
    {
        type: COMPONENT_TYPES.TRAFFIC_GRAPH,
        category: COMPONENT_CATEGORIES.GRAPHS,
        label: 'Traffic Graph',
        icon: BarChart2,
        description: 'Area chart showing inbound/outbound traffic',
        defaultProps: {
            height: 100,
            showAxes: true,
            showTooltip: true,
            inColor: '#10b981',
            outColor: '#3b82f6',
            backgroundColor: 'transparent',
            borderRadius: '4px',
            padding: '0px'
        }
    },
    {
        type: COMPONENT_TYPES.SPARKLINE,
        category: COMPONENT_CATEGORIES.GRAPHS,
        label: 'Sparkline',
        icon: TrendingUp,
        defaultProps: {
            metric: 'latency',
            height: 40,
            color: '#10b981',
            showArea: true,
            strokeWidth: 2
        }
    },

    // --- TEXT & MEDIA ---
    {
        type: COMPONENT_TYPES.TEXT,
        category: COMPONENT_CATEGORIES.CONTENT,
        label: 'Static Text',
        icon: Type,
        defaultProps: {
            content: 'Label',
            fontSize: '12px',
            color: 'textSecondary',
            align: 'left',
            fontWeight: 'normal'
        }
    },
    {
        type: COMPONENT_TYPES.MARKDOWN,
        category: COMPONENT_CATEGORIES.CONTENT,
        label: 'Markdown',
        icon: Type,
        defaultProps: {
            content: '### Title\n*List item*',
            height: 100,
            fontSize: '12px'
        }
    },
    {
        type: COMPONENT_TYPES.IMAGE,
        category: COMPONENT_CATEGORIES.CONTENT,
        label: 'Image',
        icon: Image,
        defaultProps: {
            url: '',
            height: 150,
            fit: 'contain',
            borderRadius: '4px'
        }
    },
    {
        type: COMPONENT_TYPES.KEY_VALUE_LIST,
        category: COMPONENT_CATEGORIES.CONTENT,
        label: 'Key-Value List',
        icon: List,
        defaultProps: {
            items: [{ key: 'Metric', value: 'Value' }, { key: 'Status', value: 'Active' }],
            height: 'auto',
            fontSize: '12px',
            divider: true
        }
    },
    {
        type: COMPONENT_TYPES.LOG_STREAM,
        category: COMPONENT_CATEGORIES.CONTENT,
        label: 'Log Stream',
        icon: List,
        defaultProps: {
            limit: 5,
            height: 150,
            showTimestamp: true,
            fontSize: '11px'
        }
    }
];

export const AVAILABLE_METRICS = [
    { key: 'latency', label: 'Latency', icon: Activity, category: 'ICMP', unit: 'ms' },
    { key: 'packetLoss', label: 'Packet Loss', icon: AlertTriangle, category: 'ICMP', unit: '%' },
    { key: 'jitter', label: 'Jitter', icon: TrendingUp, category: 'ICMP', unit: 'ms' },
    { key: 'uptime', label: 'Uptime', icon: Clock, category: 'SNMP', unit: '%' },
    { key: 'cpu', label: 'CPU', icon: Cpu, category: 'SNMP', unit: '%' },
    { key: 'memory', label: 'Memory', icon: Database, category: 'SNMP', unit: '%' },
    { key: 'packetsIn', label: 'Pkts In', icon: ArrowDownCircle, category: 'Traffic', unit: 'pkts' },
    { key: 'packetsOut', label: 'Pkts Out', icon: ArrowUpCircle, category: 'Traffic', unit: 'pkts' },
    { key: 'trafficIn', label: 'Traffic In', icon: ArrowDownCircle, category: 'Traffic', unit: 'bps' },
    { key: 'trafficOut', label: 'Traffic Out', icon: ArrowUpCircle, category: 'Traffic', unit: 'bps' },
    { key: 'interfaces', label: 'Interfaces', icon: Wifi, category: 'SNMP', unit: '#' }
];
