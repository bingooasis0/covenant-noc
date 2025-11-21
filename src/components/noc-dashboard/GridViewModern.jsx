import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import ModernGridCard from '../ModernGridCard';
import SlideOver from '../SlideOver';

const GridViewModern = ({
  groupedSites,
  expandedGroups,
  toggleGroup,
  selectedSites,
  toggleSiteSelection,
  metricsData,
  metricsHistory,
  snmpData,
  apiData,
  alerts,
  acknowledgedAlerts,
  getSiteStatus,
  setSelectedSite,
  setEditingSite,
  deleteSite,
  cardMenuOpen,
  setCardMenuOpen,
  cardActiveTabs,
  setCardActiveTabs,
  theme,
  loadingState
}) => {
  const [activeDrillDown, setActiveDrillDown] = useState(null);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
        {Object.entries(groupedSites).map(([groupName, groupSites]) => {
          const isExpanded = groupName === 'All Sites' || expandedGroups.has(groupName);

          if (!isExpanded && groupName !== 'All Sites') {
            return (
              <div
                key={groupName}
                onClick={() => toggleGroup(groupName)}
                style={{
                  padding: '8px 12px',
                  background: theme.bgSecondary,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.text
                }}
              >
                <ChevronRight size={16} />
                {groupName}
                <span style={{ color: theme.textMuted, fontWeight: 400 }}>({groupSites.length})</span>
              </div>
            );
          }

          return (
            <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {groupName !== 'All Sites' && (
                <div
                  onClick={() => toggleGroup(groupName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.text,
                    paddingLeft: '4px'
                  }}
                >
                  <ChevronDown size={16} />
                  {groupName}
                  <span style={{ color: theme.textMuted, fontSize: '12px', fontWeight: 400 }}>({groupSites.length})</span>
                </div>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}>
                {groupSites.map(site => (
                  <div key={site.id} style={{ height: '180px' }}>
                    <ModernGridCard
                      site={site}
                      metrics={metricsData[site.id]}
                      history={metricsHistory[site.id]}
                      isSelected={selectedSites.has(site.id)}
                      onClick={(s) => setActiveDrillDown(s)}
                      theme={theme}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <SlideOver
        isOpen={!!activeDrillDown}
        site={activeDrillDown}
        onClose={() => setActiveDrillDown(null)}
        onUpdateSite={() => {
          // Trigger a refresh if needed
          setActiveDrillDown(null);
        }}
      />
    </>
  );
};

export default GridViewModern;

