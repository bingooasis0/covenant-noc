import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { COMPONENT_TYPES } from './ComponentRegistry';

// Placeholder renderers for the preview
const ComponentRenderer = ({ component, theme }) => {
    const { type, props } = component;

    switch (type) {
        case COMPONENT_TYPES.HEADER:
            return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: theme.text }}>Site Name</div>
                        {props.showIp && <div style={{ fontSize: '11px', color: theme.textSecondary }}>192.168.1.1</div>}
                    </div>
                    <div style={{ fontSize: '18px', color: theme.primary }}>24ms</div>
                </div>
            );
        case COMPONENT_TYPES.METRIC_GRID:
            return (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${props.columns || 3}, 1fr)`,
                    gap: '8px',
                    width: '100%'
                }}>
                    {(props.metrics || []).map(m => (
                        <div key={m} style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '9px', color: theme.textSecondary, textTransform: 'uppercase' }}>{m}</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: theme.text }}>--</span>
                        </div>
                    ))}
                </div>
            );
        case COMPONENT_TYPES.GRAPH:
            return (
                <div style={{
                    height: props.height || 60,
                    background: theme.bgTertiary,
                    borderRadius: '4px',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: theme.textMuted
                }}>
                    Latency Graph Preview
                </div>
            );
        case COMPONENT_TYPES.TEXT:
            return (
                <div style={{
                    fontSize: props.fontSize,
                    color: theme[props.color] || theme.text,
                    textAlign: props.align,
                    width: '100%'
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
        case COMPONENT_TYPES.SINGLE_METRIC:
            return (
                <div style={{
                    height: props.height || 80,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: theme.bgTertiary,
                    borderRadius: '6px',
                    width: '100%'
                }}>
                    <div style={{ fontSize: '12px', color: theme.textSecondary }}>{props.label || 'Metric'}</div>
                    <div style={{ fontSize: props.fontSize || '24px', fontWeight: 700, color: theme.text }}>24ms</div>
                    {props.showTrend && <div style={{ fontSize: '11px', color: theme.success }}>+2% vs last hour</div>}
                </div>
            );
        case COMPONENT_TYPES.SPARKLINE:
            return (
                <div style={{
                    height: props.height || 40,
                    width: '100%',
                    background: theme.bgTertiary,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: props.color || theme.primary,
                    fontSize: '10px'
                }}>
                    Sparkline ({props.metric})
                </div>
            );
        case COMPONENT_TYPES.STATUS_BADGE:
            return (
                <div style={{
                    height: props.height || 40,
                    width: props.fullWidth ? '100%' : 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '20px',
                    color: '#10b981'
                }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    {props.showLabel && <span style={{ fontSize: '13px', fontWeight: 500 }}>Operational</span>}
                </div>
            );
        case COMPONENT_TYPES.LOG_STREAM:
            return (
                <div style={{
                    height: props.height || 150,
                    width: '100%',
                    background: theme.bgTertiary,
                    borderRadius: '6px',
                    padding: '8px',
                    overflow: 'hidden'
                }}>
                    <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px' }}>Recent Logs</div>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ fontSize: '11px', color: theme.textSecondary, padding: '2px 0', borderBottom: `1px solid ${theme.border}` }}>
                            {props.showTimestamp && <span style={{ color: theme.textMuted, marginRight: '6px' }}>10:0{i} AM</span>}
                            Interface GigabitEthernet1/0/{i} up
                        </div>
                    ))}
                </div>
            );
        case COMPONENT_TYPES.SPACER:
            return <div style={{ height: props.height || 20 }} />;

        case COMPONENT_TYPES.GAUGE:
            return (
                <div style={{ height: props.height || 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `4px solid ${theme.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', color: theme.text }}>
                        50%
                    </div>
                    {props.showLabel && <span style={{ marginTop: '8px', color: theme.textSecondary, fontSize: '12px' }}>{props.metric || 'CPU'}</span>}
                </div>
            );

        case COMPONENT_TYPES.MARKDOWN:
            return (
                <div style={{ height: props.height || 100, padding: '8px', color: theme.text, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 'bold' }}>Markdown Content</div>
                    <div style={{ fontSize: '12px', color: theme.textSecondary }}>{props.content || 'Preview'}</div>
                </div>
            );

        case COMPONENT_TYPES.IMAGE:
            return (
                <div style={{ height: props.height || 150, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={props.url} alt="Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: props.fit || 'contain' }} />
                </div>
            );

        case COMPONENT_TYPES.KEY_VALUE_LIST:
            return (
                <div style={{ padding: '8px' }}>
                    {(props.items || []).map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${theme.border}` }}>
                            <span style={{ color: theme.textSecondary }}>{item.key}</span>
                            <span style={{ color: theme.text, fontWeight: '500' }}>{item.value}</span>
                        </div>
                    ))}
                </div>
            );

        default:
            return <div style={{ fontSize: '12px', color: theme.textMuted }}>Unknown Component</div>;
    }
};

export const SortableItem = ({ id, component, theme, isSelected, onSelect }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        border: isSelected ? `2px solid ${theme.primary}` : '1px solid transparent',
        borderRadius: '6px',
        padding: '8px',
        background: isSelected ? theme.bgSecondary : 'transparent',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px'
    };

    return (
        <div ref={setNodeRef} style={style} onClick={onSelect}>
            <div
                {...attributes}
                {...listeners}
                style={{ cursor: 'grab', marginTop: '4px', color: theme.textMuted }}
            >
                <GripVertical size={14} />
            </div>
            <div style={{ flex: 1 }}>
                <ComponentRenderer component={component} theme={theme} />
            </div>
        </div>
    );
};
