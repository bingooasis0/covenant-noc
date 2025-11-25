import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { X, Save, RotateCcw, Undo2, LayoutTemplate } from 'lucide-react';
import { AVAILABLE_COMPONENTS, COMPONENT_CATEGORIES } from './ComponentRegistry';
import { DraggableComponent } from './DraggableComponent';
import { DroppableCard } from './DroppableCard';
import { PropertiesPanel } from './PropertiesPanel';
import { authFetch } from '../../utils/api';
import { ConfirmModal } from '../noc-dashboard/modals';
import { TEMPLATES } from './Templates';
import { CardRenderer } from './CardRenderer';

const CardEditorModal = ({ isOpen, onClose, theme, onSave: onSaveCallback }) => {
    const [components, setComponents] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [activeDragItem, setActiveDragItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
    const [templateToApply, setTemplateToApply] = useState(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const [hoveredTemplate, setHoveredTemplate] = useState(null);
    const [cardConfig, setCardConfig] = useState({
        height: 'auto',
        minHeight: 200,
        maxHeight: null,
        overflow: 'visible'
    });

    // Granular Control State
    const [viewType, setViewType] = useState('noc');
    const [scope, setScope] = useState('global');
    const [siteId, setSiteId] = useState('');
    const [sites, setSites] = useState([]);

    const selectedComponent = components.find(c => c.id === selectedId);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Fetch sites on mount
    useEffect(() => {
        const fetchSites = async () => {
            try {
                const res = await authFetch('/api/sites');
                if (res.ok) {
                    const data = await res.json();
                    setSites(data);
                }
            } catch (err) {
                console.error('Failed to fetch sites:', err);
            }
        };
        fetchSites();
    }, []);

    // Load config when open or selectors change
    useEffect(() => {
        if (isOpen) {
            try {
                if (typeof loadConfig === 'function') {
                    loadConfig();
                } else {
                    console.error('loadConfig is not a function');
                }
            } catch (err) {
                console.error('Error in useEffect:', err);
            }
        }
    }, [isOpen, viewType, scope, siteId]);

    const loadConfig = async () => {
        setLoading(true);
        console.log('Loading config...', { viewType, scope, siteId });
        try {
            let url = `/api/card-config?viewType=${viewType}&scope=${scope}`;
            if (scope === 'site' && siteId) {
                url += `&targetId=${siteId}`;
            }

            const res = await authFetch(url);
            console.log('Load config response status:', res.status);

            if (!res.ok) {
                // Fallback to default if not found
                setComponents(getDefaultLayout());
                setLoading(false);
                return;
            }

            const data = await res.json();
            if (data && data.layout) {
                // Support both old format (just layout array) and new format (object with layout and cardConfig)
                if (Array.isArray(data.layout)) {
                    setComponents(data.layout);
                    if (data.cardConfig) {
                        setCardConfig({ ...cardConfig, ...data.cardConfig });
                    }
                } else if (data.layout.layout) {
                    setComponents(data.layout.layout);
                    if (data.layout.cardConfig) {
                        setCardConfig({ ...cardConfig, ...data.layout.cardConfig });
                    }
                } else {
                    setComponents(getDefaultLayout());
                }
            } else {
                setComponents(getDefaultLayout());
            }
        } catch (err) {
            console.error('Failed to load config:', err);
            setComponents(getDefaultLayout());
        } finally {
            setLoading(false);
        }
    };

    const getDefaultLayout = () => [
        { id: 'header-1', type: 'header', props: { showIp: true, showDeviceType: true, showFailover: true } },
        { id: 'metrics-1', type: 'metric_grid', props: { columns: 4, metrics: ['latency', 'packetLoss', 'jitter', 'uptime'] } },
        { id: 'graph-1', type: 'graph', props: { height: 100, showAxes: true, showTooltip: true } }
    ];

    const handleDragStart = (event) => {
        const { active } = event;
        const isNew = active.data.current?.isNew;

        if (isNew) {
            const type = active.data.current.type;
            const template = AVAILABLE_COMPONENTS.find(c => c.type === type);
            setActiveDragItem({ ...template, id: 'temp' });
        } else {
            const item = components.find(c => c.id === active.id);
            setActiveDragItem(item);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

        // Dropping a new item from sidebar
        if (active.data.current?.isNew) {
            const type = active.data.current.type;
            const template = AVAILABLE_COMPONENTS.find(c => c.type === type);
            const newItem = {
                id: `${type}-${Date.now()}`,
                type,
                props: { ...template.defaultProps }
            };

            setComponents((items) => {
                // If dropped over an existing item, insert after it
                if (over.id !== 'card-preview') {
                    const overIndex = items.findIndex((item) => item.id === over.id);
                    const newItems = [...items];
                    newItems.splice(overIndex + 1, 0, newItem);
                    return newItems;
                }
                // Otherwise add to end
                return [...items, newItem];
            });
            setSelectedId(newItem.id);
            return;
        }

        // Reordering existing items
        if (active.id !== over.id) {
            setComponents((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleUpdateComponent = (id, newProps) => {
        setComponents(items =>
            items.map(item => item.id === id ? { ...item, props: newProps } : item)
        );
    };

    const handleDeleteComponent = (id) => {
        setComponents(items => items.filter(item => item.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const handleSave = async () => {
        if (scope === 'site' && !siteId) {
            // alert('Please select a site to save this configuration for.');
            // Use existing showError from props or context if available, or console.error
            // Since showSuccess/showError are not imported, let's import them or use console for now and rely on UI feedback
            console.error('Please select a site to save this configuration for.');
            return;
        }

        try {
            console.log('Saving config...', { components, cardConfig });
            const res = await authFetch('/api/card-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope,
                    viewType,
                    targetId: scope === 'site' ? siteId : undefined,
                    layout: components,
                    cardConfig: cardConfig
                })
            });

            console.log('Save response status:', res.status);

            if (res.ok) {
                const data = await res.json();
                console.log('Save success:', data);
                if (onSaveCallback) onSaveCallback();
                onClose();
            } else {
                const err = await res.text();
                console.error('Save failed:', err);
            }
        } catch (err) {
            console.error('Failed to save config:', err);
        }
    };

    const handleResetToDefault = () => {
        setShowResetConfirm(true);
    };

    const confirmReset = () => {
        setComponents(getDefaultLayout());
        setCardConfig({
            height: 'auto',
            minHeight: 200,
            maxHeight: null,
            overflow: 'visible'
        });
        setShowResetConfirm(false);
    };

    const applyTemplate = (template) => {
        // Replace window.confirm with ConfirmModal logic
        // We reuse the reset confirmation state or add a new one
        // For simplicity, let's reuse a new state variable for template confirmation
        setTemplateToApply(template);
        setShowTemplateConfirm(true);
    };

    const confirmApplyTemplate = () => {
        if (!templateToApply) return;
        
        const template = templateToApply;
        // Generate new unique IDs for components
        const newLayout = template.layout.map(c => ({
            ...c,
            id: `${c.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
        setComponents(newLayout);
        setCardConfig(template.cardConfig || { height: 'auto', minHeight: 200 });
        setShowTemplates(false);
        setShowTemplateConfirm(false);
        setTemplateToApply(null);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            {showResetConfirm && (
                <ConfirmModal 
                    title="Reset Layout"
                    message="Are you sure you want to reset the layout to the default template? This will discard all current changes."
                    onConfirm={confirmReset}
                    onCancel={() => setShowResetConfirm(false)}
                    theme={theme}
                />
            )}

            {showTemplateConfirm && (
                <ConfirmModal
                    title="Apply Template"
                    message={`Apply "${templateToApply?.label}" template? This will replace your current layout.`}
                    onConfirm={confirmApplyTemplate}
                    onCancel={() => {
                        setShowTemplateConfirm(false);
                        setTemplateToApply(null);
                    }}
                    theme={theme}
                />
            )}

            {/* Templates Modal */}
            {showTemplates && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '500px', background: theme.bgSecondary, border: `1px solid ${theme.border}`,
                    borderRadius: '12px', zIndex: 10001, padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                    {/* Preview Tooltip */}
                    {hoveredTemplate && (
                        <div style={{
                            position: 'absolute', top: '-20px', left: '105%', transform: 'translateY(-50%)',
                            width: '320px', background: theme.bg, border: `1px solid ${theme.border}`,
                            borderRadius: '8px', zIndex: 10002, padding: '16px', boxShadow: '0 5px 20px rgba(0,0,0,0.3)',
                            pointerEvents: 'none' // Allow clicking through if it overlaps
                        }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: theme.text }}>Preview</h4>
                            <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left', width: '142%' }}>
                                <div style={{ 
                                    background: theme.card || '#fff', 
                                    border: `1px solid ${theme.border}`, 
                                    borderRadius: '8px', 
                                    padding: '16px', 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    height: 'auto',
                                    minHeight: hoveredTemplate.cardConfig?.minHeight || 200,
                                    ...hoveredTemplate.cardConfig 
                                }}>
                                    {hoveredTemplate.layout.map(c => (
                                        <CardRenderer key={c.id} component={c} theme={theme} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: theme.text }}>Select Template</h3>
                        <button onClick={() => setShowTemplates(false)} style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {TEMPLATES && Array.isArray(TEMPLATES) && TEMPLATES.length > 0 ? (
                            TEMPLATES.map(template => (
                                <div 
                                    key={template.id || template.label}
                                    onClick={() => applyTemplate(template)}
                                    style={{
                                        padding: '12px',
                                        border: `1px solid ${theme.border}`,
                                        borderRadius: '8px',
                                        background: theme.card,
                                        cursor: 'pointer',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = theme.primary;
                                        setHoveredTemplate(template);
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = theme.border;
                                        setHoveredTemplate(null);
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: theme.text, marginBottom: '4px' }}>{template.label}</div>
                                    <div style={{ fontSize: '12px', color: theme.textSecondary }}>{template.description}</div>
                                </div>
                            ))
                        ) : (
                            <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: theme.textSecondary }}>
                                {console.error('Templates not loaded:', { TEMPLATES, type: typeof TEMPLATES, isArray: Array.isArray(TEMPLATES) })}
                                No templates available. TEMPLATES: {TEMPLATES ? 'exists' : 'undefined'}, Length: {TEMPLATES?.length || 0}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div style={{
                width: '90vw', height: '90vh', background: theme.bgSecondary,
                borderRadius: '12px', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', border: `1px solid ${theme.border}`
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px', borderBottom: `1px solid ${theme.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: theme.bg
                }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: theme.text }}>Card Layout Editor</h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <select
                            value={viewType}
                            onChange={(e) => setViewType(e.target.value)}
                            style={{ padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bgSecondary, color: theme.text }}
                        >
                            <option value="noc">NOC View</option>
                            <option value="grid">Grid View</option>
                        </select>
                        <select
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                            style={{ padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bgSecondary, color: theme.text }}
                        >
                            <option value="global">Global</option>
                            <option value="site">Specific Site</option>
                        </select>
                        {scope === 'site' && (
                            <select
                                value={siteId}
                                onChange={(e) => setSiteId(e.target.value)}
                                style={{ padding: '6px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: theme.bgSecondary, color: theme.text, maxWidth: '200px' }}
                            >
                                <option value="">Select Site...</option>
                                {sites.map(site => (
                                    <option key={site.id} value={site.id}>{site.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            onClick={() => setShowTemplates(true)} 
                            title="Apply Template"
                            style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <LayoutTemplate size={18} />
                            <span style={{ fontSize: '13px' }}>Templates</span>
                        </button>
                        
                        {scope === 'site' && (
                            <button 
                                onClick={handleResetToDefault} 
                                title="Reset to Default Template"
                                style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}
                            >
                                <Undo2 size={18} />
                            </button>
                        )}
                        <button onClick={loadConfig} title="Reload Saved Config" style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}>
                            <RotateCcw size={18} />
                        </button>
                        <button onClick={handleSave} title="Save Configuration" style={{
                            background: theme.primary, color: '#fff', border: 'none',
                            padding: '8px 16px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                        }}>
                            <Save size={16} /> Save
                        </button>
                        <button onClick={onClose} title="Close Editor" style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        {/* Sidebar - Components */}
                        <div style={{ width: '250px', padding: '20px', borderRight: `1px solid ${theme.border}`, overflowY: 'auto', background: theme.bg, position: 'relative', zIndex: 1 }}>
                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: theme.textMuted, marginBottom: '16px' }}>Components</h3>
                            
                            {Object.values(COMPONENT_CATEGORIES).map(category => {
                                const categoryComponents = AVAILABLE_COMPONENTS.filter(c => c.category === category);
                                if (categoryComponents.length === 0) return null;
                                
                                return (
                                    <div key={category} style={{ marginBottom: '20px' }}>
                                        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: theme.textMuted, marginBottom: '8px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '4px' }}>
                                            {category}
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {categoryComponents.map(c => (
                                                <DraggableComponent key={c.type} {...c} theme={theme} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Main - Preview */}
                        <div style={{ flex: 1, padding: '40px', background: theme.bgTertiary, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto' }}>
                            <DroppableCard
                                components={components}
                                theme={theme}
                                onSelectComponent={(c) => setSelectedId(c.id)}
                                selectedId={selectedId}
                                cardConfig={cardConfig}
                            />
                        </div>

                        {/* Sidebar - Properties */}
                        <div style={{ width: '300px', padding: '20px', borderLeft: `1px solid ${theme.border}`, overflowY: 'auto', background: theme.bg }}>
                            <PropertiesPanel
                                component={selectedComponent}
                                onChange={handleUpdateComponent}
                                onDelete={handleDeleteComponent}
                                theme={theme}
                                cardConfig={cardConfig}
                                onCardConfigChange={setCardConfig}
                            />
                        </div>
                    </div>

                    <DragOverlay>
                        {activeDragItem ? (
                            <div style={{
                                padding: '12px', background: theme.bgSecondary,
                                border: `1px solid ${theme.primary}`, borderRadius: '8px',
                                color: theme.text, boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
                            }}>
                                {activeDragItem.label || 'Component'}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
};

export default CardEditorModal;
