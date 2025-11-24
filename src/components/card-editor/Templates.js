import { COMPONENT_TYPES } from './ComponentRegistry';

export const TEMPLATES = [
    {
        id: 'standard',
        label: 'Standard Overview',
        description: 'Balanced view with metrics and a large graph.',
        layout: [
            { id: 'header', type: COMPONENT_TYPES.HEADER, props: { showIp: true, showDeviceType: true, showFailover: true } },
            { id: 'metrics', type: COMPONENT_TYPES.METRIC_GRID, props: { columns: 4, metrics: ['latency', 'packetLoss', 'jitter', 'uptime'] } },
            { id: 'graph', type: COMPONENT_TYPES.GRAPH, props: { height: 100, showAxes: true, showTooltip: true } }
        ],
        cardConfig: { height: 'auto', minHeight: 200 }
    },
    {
        id: 'detailed',
        label: 'Detailed Card',
        description: 'Mimics the detailed system default card with sparklines.',
        layout: [
            { id: 'header', type: COMPONENT_TYPES.HEADER, props: { showIp: true, showDeviceType: false, showFailover: false, borderBottom: false } },
            { id: 'location', type: COMPONENT_TYPES.TEXT, props: { content: 'Location & Device Info', fontSize: '11px', color: 'textSecondary' } },
            { id: 'metrics', type: COMPONENT_TYPES.METRIC_GRID, props: { columns: 4, metrics: ['latency', 'packetLoss', 'uptime', 'cpu'] } },
            { id: 'spark', type: COMPONENT_TYPES.SPARKLINE, props: { metric: 'latency', height: 60, showArea: true, color: '#10b981' } }
        ],
        cardConfig: { height: 'auto', minHeight: 220 }
    },
    {
        id: 'traffic',
        label: 'Traffic Monitor',
        description: 'Focused on bandwidth and packet flow.',
        layout: [
            { id: 'header', type: COMPONENT_TYPES.HEADER, props: { showIp: true } },
            { id: 'traffic-graph', type: COMPONENT_TYPES.TRAFFIC_GRAPH, props: { height: 120, showAxes: true, inColor: '#10b981', outColor: '#3b82f6' } },
            { id: 'metrics-in', type: COMPONENT_TYPES.SINGLE_METRIC, props: { metric: 'trafficIn', label: 'Inbound', fontSize: '18px', height: 60, backgroundColor: 'bgSecondary' } },
            { id: 'metrics-out', type: COMPONENT_TYPES.SINGLE_METRIC, props: { metric: 'trafficOut', label: 'Outbound', fontSize: '18px', height: 60, backgroundColor: 'bgSecondary' } }
        ],
        cardConfig: { height: 'auto', minHeight: 300 }
    },
    {
        id: 'minimal',
        label: 'Minimal Status',
        description: 'Compact view for high-density grids.',
        layout: [
            { id: 'header', type: COMPONENT_TYPES.HEADER, props: { showIp: false, showDeviceType: false, showFailover: false, fontSize: '14px' } },
            { id: 'status', type: COMPONENT_TYPES.STATUS_BADGE, props: { showLabel: true, fullWidth: true } }
        ],
        cardConfig: { height: 'auto', minHeight: 100 }
    },
    {
        id: 'gauge',
        label: 'Performance Gauge',
        description: 'Visual gauge for key metrics.',
        layout: [
            { id: 'header', type: COMPONENT_TYPES.HEADER, props: { showIp: true } },
            { id: 'gauge', type: COMPONENT_TYPES.GAUGE, props: { metric: 'latency', max: 200, height: 140, showLabel: true } },
            { id: 'metrics', type: COMPONENT_TYPES.METRIC_GRID, props: { columns: 3, metrics: ['packetLoss', 'jitter', 'uptime'] } }
        ],
        cardConfig: { height: 'auto', minHeight: 250 }
    }
];

