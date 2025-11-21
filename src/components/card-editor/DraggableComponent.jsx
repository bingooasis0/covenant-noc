import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { COMPONENT_TYPES } from './ComponentRegistry';

const ComponentPreview = ({ type, theme }) => {
    const previewStyle = {
        width: '200px',
        padding: '8px',
        background: theme.bgSecondary || '#f5f5f5',
        borderRadius: '6px',
        border: `1px solid ${theme.border || '#e0e0e0'}`,
        fontSize: '10px',
        color: theme.text || '#000'
    };

    switch (type) {
        case COMPONENT_TYPES.HEADER:
            return (
                <div style={previewStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '11px', color: theme.text || '#000' }}>Site Name</div>
                            <div style={{ fontSize: '9px', color: theme.textSecondary || '#666' }}>192.168.1.1</div>
                        </div>
                        <div style={{ fontSize: '14px', color: theme.primary || '#2f81f7' }}>24ms</div>
                    </div>
                </div>
            );
        case COMPONENT_TYPES.METRIC_GRID:
            return (
                <div style={previewStyle}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        {['Latency', 'Loss', 'Jitter'].map(m => (
                            <div key={m}>
                                <div style={{ fontSize: '8px', color: theme.textSecondary || '#666' }}>{m.toUpperCase()}</div>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: theme.text || '#000' }}>--</div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case COMPONENT_TYPES.GRAPH:
            return (
                <div style={{ ...previewStyle, height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bgTertiary || '#e8e8e8' }}>
                    <div style={{ fontSize: '9px', color: theme.textMuted || '#999' }}>📈 Graph Preview</div>
                </div>
            );
        case COMPONENT_TYPES.SINGLE_METRIC:
            return (
                <div style={{ ...previewStyle, textAlign: 'center', background: theme.bgTertiary || '#e8e8e8' }}>
                    <div style={{ fontSize: '9px', color: theme.textSecondary || '#666' }}>Current Latency</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: theme.text || '#000' }}>24ms</div>
                </div>
            );
        case COMPONENT_TYPES.SPACER:
            return (
                <div style={{ ...previewStyle, height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
                    <div style={{ fontSize: '9px', color: theme.textMuted || '#999' }}>Empty Space</div>
                </div>
            );
        default:
            return (
                <div style={previewStyle}>
                    <div style={{ fontSize: '9px', color: theme.textMuted || '#999' }}>Preview</div>
                </div>
            );
    }
};

export const DraggableComponent = ({ type, label, icon: Icon, description, theme }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const componentRef = React.useRef(null);

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `new-${type}`,
        data: {
            type,
            isNew: true
        }
    });

    const handleMouseEnter = () => {
        if (componentRef.current) {
            const rect = componentRef.current.getBoundingClientRect();
            setTooltipPosition({
                top: rect.top,
                left: rect.right + 12
            });
        }
        setShowTooltip(true);
    };

    const style = {
        position: 'relative',
        transform: CSS.Translate.toString(transform),
        padding: '12px',
        background: theme.bgTertiary || '#f5f5f5',
        border: `1px solid ${theme.border || '#e0e0e0'}`,
        borderRadius: '8px',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px',
        color: theme.text || '#000',
        fontSize: '13px',
        fontWeight: 500,
        userSelect: 'none'
    };

    const tooltipStyle = {
        position: 'fixed',
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        padding: '12px',
        background: theme.bg || '#fff',
        border: `1px solid ${theme.border || '#e0e0e0'}`,
        borderRadius: '8px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
        zIndex: 20000,
        minWidth: '250px',
        pointerEvents: 'none'
    };

    return (
        <>
            <div
                ref={(node) => {
                    setNodeRef(node);
                    componentRef.current = node;
                }}
                style={style}
                {...listeners}
                {...attributes}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <Icon size={16} color={theme.textSecondary || '#666'} />
                {label}
            </div>

            {showTooltip && (
                <div style={tooltipStyle}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: theme.text || '#000', marginBottom: '6px' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: theme.textSecondary || '#666', marginBottom: '12px', lineHeight: '1.4' }}>{description || 'No description available'}</div>
                    <div style={{ fontSize: '10px', color: theme.textMuted || '#999', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>Preview</div>
                    <ComponentPreview type={type} theme={theme} />
                </div>
            )}
        </>
    );
};
