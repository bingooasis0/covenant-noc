import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';

export const DroppableCard = ({ components, theme, onSelectComponent, selectedId, cardConfig = {} }) => {
    const { setNodeRef } = useDroppable({
        id: 'card-preview'
    });

    // Card height configuration - Grafana-style
    const cardHeight = cardConfig.height || 'auto';
    const minHeight = cardConfig.minHeight || 200;
    const maxHeight = cardConfig.maxHeight || null;

    const heightStyle = cardHeight === 'auto' || cardHeight === 'fit-content'
        ? { minHeight: `${minHeight}px`, height: 'auto' }
        : { height: typeof cardHeight === 'number' ? `${cardHeight}px` : cardHeight, minHeight: `${minHeight}px` };

    if (maxHeight) {
        heightStyle.maxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;
    }

    return (
        <div
            ref={setNodeRef}
            style={{
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '16px',
                ...heightStyle,
                width: '100%',
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
                overflow: cardConfig.overflow || 'visible'
            }}
        >
            <SortableContext
                items={components.map(c => c.id)}
                strategy={verticalListSortingStrategy}
            >
                {components.length === 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: theme.textMuted,
                        fontSize: '13px',
                        textAlign: 'center'
                    }}>
                        Drag components here
                    </div>
                )}

                {components.map((component) => (
                    <SortableItem
                        key={component.id}
                        id={component.id}
                        component={component}
                        theme={theme}
                        isSelected={selectedId === component.id}
                        onSelect={() => onSelectComponent(component)}
                    />
                ))}
            </SortableContext>
        </div>
    );
};
