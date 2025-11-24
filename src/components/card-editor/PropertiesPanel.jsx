import React from 'react';
import { COMPONENT_TYPES, AVAILABLE_METRICS } from './ComponentRegistry';
import { Trash2 } from 'lucide-react';

export const PropertiesPanel = ({ component, onChange, onDelete, theme, cardConfig, onCardConfigChange }) => {
    if (!component) {
        // Show card settings when no component is selected (Grafana-style)
        return (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: theme.text, borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px' }}>Card Settings</h4>
                
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height</label>
                    <select
                        value={cardConfig?.height || 'auto'}
                        onChange={(e) => onCardConfigChange({ ...cardConfig, height: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value) || 'auto' })}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                    >
                        <option value="auto">Auto (Fit Content)</option>
                        <option value="200">200px</option>
                        <option value="300">300px</option>
                        <option value="400">400px</option>
                        <option value="500">500px</option>
                        <option value="600">600px</option>
                    </select>
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Min Height (px)</label>
                    <input
                        type="number"
                        value={cardConfig?.minHeight || 200}
                        onChange={(e) => onCardConfigChange({ ...cardConfig, minHeight: parseInt(e.target.value) || 200 })}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        min="100"
                        step="10"
                    />
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Max Height (px) - Optional</label>
                    <input
                        type="number"
                        value={cardConfig?.maxHeight || ''}
                        onChange={(e) => onCardConfigChange({ ...cardConfig, maxHeight: e.target.value ? parseInt(e.target.value) : null })}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        placeholder="No limit"
                        min="100"
                        step="10"
                    />
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Overflow</label>
                    <select
                        value={cardConfig?.overflow || 'visible'}
                        onChange={(e) => onCardConfigChange({ ...cardConfig, overflow: e.target.value })}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                    >
                        <option value="visible">Visible (Auto-size)</option>
                        <option value="hidden">Hidden (Clip)</option>
                        <option value="auto">Auto (Scroll if needed)</option>
                    </select>
                </div>

                <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '8px', padding: '8px', background: theme.bgSecondary, borderRadius: '4px' }}>
                    <strong>Tip:</strong> Set height to "Auto" and adjust min/max height to let cards automatically adjust based on content.
                </div>
            </div>
        );
    }

    const handleChange = (key, value) => {
        onChange(component.id, {
            ...component.props,
            [key]: value
        });
    };

    const renderCommonStyling = () => (
        <>
            <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: '16px', paddingTop: '16px' }}>
                <h5 style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase' }}>Appearance</h5>

                {component.props.hasOwnProperty('backgroundColor') && (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Background</label>
                        <select
                            value={component.props.backgroundColor}
                            onChange={(e) => handleChange('backgroundColor', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        >
                            <option value="transparent">Transparent</option>
                            <option value="bg">Background</option>
                            <option value="bgSecondary">Secondary</option>
                            <option value="bgTertiary">Tertiary</option>
                            <option value="#ffffff">White</option>
                            <option value="#000000">Black</option>
                            <option value="#f6f8fa">Light Gray</option>
                        </select>
                    </div>
                )}

                {component.props.hasOwnProperty('textColor') && (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Text Color</label>
                        <select
                            value={component.props.textColor}
                            onChange={(e) => handleChange('textColor', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        >
                            <option value="text">Primary Text</option>
                            <option value="textSecondary">Secondary Text</option>
                            <option value="textMuted">Muted Text</option>
                            <option value="primary">Primary Color</option>
                        </select>
                    </div>
                )}

                {component.props.hasOwnProperty('borderRadius') && (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Border Radius</label>
                        <input
                            type="text"
                            value={component.props.borderRadius}
                            onChange={(e) => handleChange('borderRadius', e.target.value)}
                            placeholder="e.g., 4px, 8px"
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        />
                    </div>
                )}

                {component.props.hasOwnProperty('padding') && (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Padding</label>
                        <input
                            type="text"
                            value={component.props.padding}
                            onChange={(e) => handleChange('padding', e.target.value)}
                            placeholder="e.g., 8px, 12px 16px"
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        />
                    </div>
                )}

                {/* Color Overrides */}
                <div style={{ marginTop: '12px', borderTop: `1px solid ${theme.border}`, paddingTop: '12px' }}>
                    <h6 style={{ margin: '0 0 8px 0', fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase' }}>Colors</h6>
                    
                    {component.props.hasOwnProperty('color') && (
                        <div style={{ marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Primary Color</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="color"
                                    value={component.props.color}
                                    onChange={(e) => handleChange('color', e.target.value)}
                                    style={{ width: '32px', height: '32px', padding: '0', border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer' }}
                                />
                                <input
                                    type="text"
                                    value={component.props.color}
                                    onChange={(e) => handleChange('color', e.target.value)}
                                    style={{ flex: 1, padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                                />
                            </div>
                        </div>
                    )}

                    {component.props.hasOwnProperty('backgroundColor') && component.props.backgroundColor !== 'transparent' && component.props.backgroundColor !== 'bg' && component.props.backgroundColor !== 'bgSecondary' && component.props.backgroundColor !== 'bgTertiary' && (
                         <div style={{ marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Background Color</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="color"
                                    value={component.props.backgroundColor}
                                    onChange={(e) => handleChange('backgroundColor', e.target.value)}
                                    style={{ width: '32px', height: '32px', padding: '0', border: `1px solid ${theme.border}`, borderRadius: '4px', cursor: 'pointer' }}
                                />
                                <input
                                    type="text"
                                    value={component.props.backgroundColor}
                                    onChange={(e) => handleChange('backgroundColor', e.target.value)}
                                    style={{ flex: 1, padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {component.props.hasOwnProperty('fontSize') && (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Font Size</label>
                        <select
                            value={component.props.fontSize}
                            onChange={(e) => handleChange('fontSize', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        >
                            <option value="10px">Small (10px)</option>
                            <option value="12px">Medium (12px)</option>
                            <option value="14px">Large (14px)</option>
                            <option value="16px">Extra Large (16px)</option>
                            <option value="20px">20px</option>
                            <option value="24px">24px</option>
                            <option value="32px">32px</option>
                            <option value="48px">48px</option>
                        </select>
                    </div>
                )}

                {component.props.hasOwnProperty('fontWeight') && (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Font Weight</label>
                        <select
                            value={component.props.fontWeight || 'normal'}
                            onChange={(e) => handleChange('fontWeight', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        >
                            <option value="normal">Normal</option>
                            <option value="500">Medium</option>
                            <option value="600">Semi Bold</option>
                            <option value="bold">Bold</option>
                        </select>
                    </div>
                )}

                {component.props.hasOwnProperty('align') && (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Alignment</label>
                        <select
                            value={component.props.align}
                            onChange={(e) => handleChange('align', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                        >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                )}
            </div>
        </>
    );

    const renderFields = () => {
        switch (component.type) {
            case COMPONENT_TYPES.HEADER:
                return (
                    <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showIp}
                                onChange={(e) => handleChange('showIp', e.target.checked)}
                            />
                            Show IP Address
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showDeviceType}
                                onChange={(e) => handleChange('showDeviceType', e.target.checked)}
                            />
                            Show Device Type
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showFailover}
                                onChange={(e) => handleChange('showFailover', e.target.checked)}
                            />
                            Show Failover IP
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.borderBottom}
                                onChange={(e) => handleChange('borderBottom', e.target.checked)}
                            />
                            Show Border Bottom
                        </label>
                        {renderCommonStyling()}
                    </>
                );
            case COMPONENT_TYPES.METRIC_GRID:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Columns</label>
                            <select
                                value={component.props.columns}
                                onChange={(e) => handleChange('columns', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            >
                                <option value={2}>2 Columns</option>
                                <option value={3}>3 Columns</option>
                                <option value={4}>4 Columns</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Metrics</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                                {AVAILABLE_METRICS.map(m => (
                                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                                        <input
                                            type="checkbox"
                                            checked={component.props.metrics.includes(m.key)}
                                            onChange={(e) => {
                                                const current = component.props.metrics;
                                                const next = e.target.checked
                                                    ? [...current, m.key]
                                                    : current.filter(k => k !== m.key);
                                                handleChange('metrics', next);
                                            }}
                                        />
                                        {m.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                        {renderCommonStyling()}
                    </>
                );
            case COMPONENT_TYPES.GRAPH:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showAxes}
                                onChange={(e) => handleChange('showAxes', e.target.checked)}
                            />
                            Show Axes
                        </label>
                        {renderCommonStyling()}
                    </>
                );
            case COMPONENT_TYPES.TRAFFIC_GRAPH:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Inbound Color</label>
                            <input
                                type="color"
                                value={component.props.inColor}
                                onChange={(e) => handleChange('inColor', e.target.value)}
                                style={{ width: '100%', height: '32px', padding: '2px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Outbound Color</label>
                            <input
                                type="color"
                                value={component.props.outColor}
                                onChange={(e) => handleChange('outColor', e.target.value)}
                                style={{ width: '100%', height: '32px', padding: '2px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showAxes}
                                onChange={(e) => handleChange('showAxes', e.target.checked)}
                            />
                            Show Axes
                        </label>
                        {renderCommonStyling()}
                    </>
                );
            case COMPONENT_TYPES.SINGLE_METRIC:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Label</label>
                            <input
                                type="text"
                                value={component.props.label}
                                onChange={(e) => handleChange('label', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Metric</label>
                            <select
                                value={component.props.metric}
                                onChange={(e) => handleChange('metric', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            >
                                {AVAILABLE_METRICS.map(m => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Alignment</label>
                            <select
                                value={component.props.alignment}
                                onChange={(e) => handleChange('alignment', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            >
                                <option value="flex-start">Left</option>
                                <option value="center">Center</option>
                                <option value="flex-end">Right</option>
                            </select>
                        </div>
                        {renderCommonStyling()}
                    </>
                );
            case COMPONENT_TYPES.SPARKLINE:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Metric</label>
                            <select
                                value={component.props.metric}
                                onChange={(e) => handleChange('metric', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            >
                                {AVAILABLE_METRICS.map(m => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showArea}
                                onChange={(e) => handleChange('showArea', e.target.checked)}
                            />
                            Show Area
                        </label>
                    </>
                );
            case COMPONENT_TYPES.STATUS_BADGE:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showLabel}
                                onChange={(e) => handleChange('showLabel', e.target.checked)}
                            />
                            Show Label
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text, marginTop: '8px' }}>
                            <input
                                type="checkbox"
                                checked={component.props.fullWidth}
                                onChange={(e) => handleChange('fullWidth', e.target.checked)}
                            />
                            Full Width
                        </label>
                    </>
                );
            case COMPONENT_TYPES.LOG_STREAM:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Limit</label>
                            <input
                                type="number"
                                value={component.props.limit}
                                onChange={(e) => handleChange('limit', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showTimestamp}
                                onChange={(e) => handleChange('showTimestamp', e.target.checked)}
                            />
                            Show Timestamp
                        </label>
                    </>
                );
            case COMPONENT_TYPES.SPACER:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        {renderCommonStyling()}
                    </>
                );
            case COMPONENT_TYPES.GAUGE:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Metric</label>
                            <select
                                value={component.props.metric}
                                onChange={(e) => handleChange('metric', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            >
                                {AVAILABLE_METRICS.map(m => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: theme.text }}>
                            <input
                                type="checkbox"
                                checked={component.props.showLabel}
                                onChange={(e) => handleChange('showLabel', e.target.checked)}
                            />
                            Show Label
                        </label>
                    </>
                );
            case COMPONENT_TYPES.MARKDOWN:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Content</label>
                            <textarea
                                value={component.props.content}
                                onChange={(e) => handleChange('content', e.target.value)}
                                style={{ width: '100%', height: '100px', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontFamily: 'monospace' }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                    </>
                );
            case COMPONENT_TYPES.IMAGE:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Image URL</label>
                            <input
                                type="text"
                                value={component.props.url}
                                onChange={(e) => handleChange('url', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Height (px)</label>
                            <input
                                type="number"
                                value={component.props.height}
                                onChange={(e) => handleChange('height', parseInt(e.target.value))}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Fit</label>
                            <select
                                value={component.props.fit}
                                onChange={(e) => handleChange('fit', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            >
                                <option value="contain">Contain</option>
                                <option value="cover">Cover</option>
                                <option value="fill">Fill</option>
                            </select>
                        </div>
                    </>
                );
            case COMPONENT_TYPES.KEY_VALUE_LIST:
                return (
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Items (JSON)</label>
                        <textarea
                            value={JSON.stringify(component.props.items, null, 2)}
                            onChange={(e) => {
                                try {
                                    handleChange('items', JSON.parse(e.target.value));
                                } catch (err) {
                                    // Ignore parse errors while typing
                                }
                            }}
                            style={{ width: '100%', height: '150px', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontFamily: 'monospace' }}
                        />
                    </div>
                );
            case COMPONENT_TYPES.TEXT:
                return (
                    <>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Content</label>
                            <input
                                type="text"
                                value={component.props.content}
                                onChange={(e) => handleChange('content', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>Font Size</label>
                            <select
                                value={component.props.fontSize}
                                onChange={(e) => handleChange('fontSize', e.target.value)}
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                            >
                                <option value="10px">Small (10px)</option>
                                <option value="12px">Medium (12px)</option>
                                <option value="14px">Large (14px)</option>
                                <option value="16px">Extra Large (16px)</option>
                            </select>
                        </div>
                    </>
                );
            default:
                return <div style={{ fontSize: '13px', color: theme.textMuted }}>No properties available</div>;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.border}`, paddingBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: theme.text }}>Properties</h4>
                <button
                    onClick={() => onDelete(component.id)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: theme.danger,
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                    title="Delete Component"
                >
                    <Trash2 size={14} />
                </button>
            </div>
            {renderFields()}
        </div>
    );
};
