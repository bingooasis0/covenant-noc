import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { X, Save, RotateCcw } from 'lucide-react';
import { AVAILABLE_COMPONENTS } from './ComponentRegistry';
import { DraggableComponent } from './DraggableComponent';
import { DroppableCard } from './DroppableCard';
import { PropertiesPanel } from './PropertiesPanel';
import { authFetch } from '../../utils/api';

const CardEditorModal = ({ isOpen, onClose, theme, onSave: onSaveCallback }) => {
    const [components, setComponents] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [activeDragItem, setActiveDragItem] = useState(null);
    const [loading, setLoading] = useState(false);
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

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
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
                        <button onClick={loadConfig} style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}>
                            <RotateCcw size={18} />
                        </button>
                        <button onClick={handleSave} style={{
                            background: theme.primary, color: '#fff', border: 'none',
                            padding: '8px 16px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                        }}>
                            <Save size={16} /> Save
                        </button>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}>
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
                            {AVAILABLE_COMPONENTS.map(c => (
                                <DraggableComponent key={c.type} {...c} theme={theme} />
                            ))}
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
