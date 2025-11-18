import React, { useState, useEffect } from 'react';
import {
  X, Check, Plus, Trash2, Move, Eye, EyeOff, Settings,
  Activity, Wifi, Database, TrendingUp, BarChart2, 
  Clock, Zap, AlertTriangle, Package
} from 'lucide-react';

/**
 * Grafana-style Card Editor
 * Allows customization of card layout, visible metrics, and display options
 */
const CardEditorModal = ({ isOpen, onClose, theme, sites, cardConfigs, onSave }) => {
  const [selectedSite, setSelectedSite] = useState(null);
  const [config, setConfig] = useState({
    metrics: {
      latency: { visible: true, order: 0, label: 'Latency' },
      packetLoss: { visible: true, order: 1, label: 'Packet Loss' },
      jitter: { visible: true, order: 2, label: 'Jitter' },
      cpu: { visible: true, order: 3, label: 'CPU Usage' },
      memory: { visible: true, order: 4, label: 'Memory' },
      uptime: { visible: true, order: 5, label: 'Uptime' },
      interfaces: { visible: true, order: 6, label: 'Interfaces' },
      bandwidth: { visible: false, order: 7, label: 'Bandwidth' }
    },
    display: {
      showGraph: true,
      showHistory: true,
      showLossOverview: true,
      compactMode: false,
      cardHeight: 'auto'
    },
    global: true // Apply to all cards or just this one
  });

  useEffect(() => {
    if (selectedSite && cardConfigs?.[selectedSite.id]) {
      setConfig(cardConfigs[selectedSite.id]);
    }
  }, [selectedSite, cardConfigs]);

  if (!isOpen) return null;

  const availableMetrics = [
    { key: 'latency', icon: Activity, category: 'ICMP' },
    { key: 'packetLoss', icon: AlertTriangle, category: 'ICMP' },
    { key: 'jitter', icon: TrendingUp, category: 'ICMP' },
    { key: 'cpu', icon: Zap, category: 'SNMP' },
    { key: 'memory', icon: Database, category: 'SNMP' },
    { key: 'uptime', icon: Clock, category: 'SNMP' },
    { key: 'interfaces', icon: Wifi, category: 'SNMP' },
    { key: 'bandwidth', icon: BarChart2, category: 'SNMP' }
  ];

  const toggleMetric = (key) => {
    setConfig(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [key]: {
          ...prev.metrics[key],
          visible: !prev.metrics[key].visible
        }
      }
    }));
  };

  const toggleDisplay = (key) => {
    setConfig(prev => ({
      ...prev,
      display: {
        ...prev.display,
        [key]: !prev.display[key]
      }
    }));
  };

  const handleSave = () => {
    onSave(config, selectedSite?.id || null);
    onClose();
  };

  const buttonStyle = {
    padding: '6px 12px',
    background: 'transparent',
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s'
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.bgSecondary,
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          border: `1px solid ${theme.border}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} color={theme.primary} />
              Card Customization
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: theme.textSecondary }}>
              Customize what metrics appear on your monitoring cards
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              ...buttonStyle,
              padding: '8px',
              border: 'none'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', height: '100%' }}>
            {/* Left Panel - Site Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: theme.text }}>
                  Apply To
                </h3>
                <button
                  onClick={() => {
                    setSelectedSite(null);
                    setConfig(prev => ({ ...prev, global: true }));
                  }}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    background: config.global ? theme.primary : theme.bgTertiary,
                    color: config.global ? '#fff' : theme.text,
                    border: config.global ? `1px solid ${theme.primary}` : `1px solid ${theme.border}`,
                    justifyContent: 'start'
                  }}
                >
                  <Package size={16} />
                  All Cards (Global)
                </button>
              </div>

              <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '12px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: theme.text }}>
                  Or Select Site
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflow: 'auto' }}>
                  {sites.slice(0, 10).map(site => (
                    <button
                      key={site.id}
                      onClick={() => {
                        setSelectedSite(site);
                        setConfig(prev => ({ ...prev, global: false }));
                      }}
                      style={{
                        ...buttonStyle,
                        width: '100%',
                        background: selectedSite?.id === site.id ? theme.primary : 'transparent',
                        color: selectedSite?.id === site.id ? '#fff' : theme.text,
                        border: selectedSite?.id === site.id ? `1px solid ${theme.primary}` : `1px solid ${theme.border}`,
                        justifyContent: 'start',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: site.status === 'operational' ? theme.success : theme.danger,
                        flexShrink: 0
                      }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {site.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel - Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Visible Metrics */}
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: theme.text }}>
                  Visible Metrics
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: theme.textSecondary }}>
                  Select which metrics to display on the card
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                  {availableMetrics.map(metric => {
                    const Icon = metric.icon;
                    const metricConfig = config.metrics[metric.key];
                    const isVisible = metricConfig?.visible;

                    return (
                      <button
                        key={metric.key}
                        onClick={() => toggleMetric(metric.key)}
                        style={{
                          ...buttonStyle,
                          background: isVisible ? theme.successBg || 'rgba(16, 185, 129, 0.1)' : theme.bgTertiary,
                          borderColor: isVisible ? theme.success : theme.border,
                          color: isVisible ? theme.success : theme.textSecondary,
                          justifyContent: 'space-between',
                          padding: '10px 12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Icon size={16} />
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{metricConfig?.label || metric.key}</span>
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>{metric.category}</span>
                          </div>
                        </div>
                        {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display Options */}
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: theme.text }}>
                  Display Options
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {[
                    { key: 'showGraph', label: 'Show Latency Graph', desc: 'Display trend chart' },
                    { key: 'showHistory', label: 'Show Loss Overview', desc: '12h/24h/48h windows' },
                    { key: 'showLossOverview', label: 'Show Statistics', desc: 'Min/avg/max values' },
                    { key: 'compactMode', label: 'Compact Mode', desc: 'Reduce padding and spacing' }
                  ].map(option => (
                    <button
                      key={option.key}
                      onClick={() => toggleDisplay(option.key)}
                      style={{
                        ...buttonStyle,
                        background: config.display[option.key] ? theme.primary : theme.bgTertiary,
                        color: config.display[option.key] ? '#fff' : theme.text,
                        borderColor: config.display[option.key] ? theme.primary : theme.border,
                        flexDirection: 'column',
                        alignItems: 'start',
                        gap: '4px',
                        padding: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{option.label}</span>
                        {config.display[option.key] ? <Check size={14} /> : null}
                      </div>
                      <span style={{ fontSize: '11px', opacity: 0.8 }}>{option.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, color: theme.text }}>
                  Preview
                </h3>
                <div
                  style={{
                    background: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '10px',
                    padding: config.display.compactMode ? '6px' : '10px',
                    minHeight: '200px'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                    {selectedSite ? selectedSite.name : 'Example Site'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '11px' }}>
                    {Object.entries(config.metrics)
                      .filter(([_, m]) => m.visible)
                      .sort((a, b) => a[1].order - b[1].order)
                      .slice(0, 6)
                      .map(([key, metric]) => (
                        <div key={key} style={{ padding: '4px', background: theme.bgTertiary, borderRadius: '4px' }}>
                          <div style={{ fontSize: '9px', color: theme.textMuted, textTransform: 'uppercase' }}>{metric.label}</div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: theme.text }}>--</div>
                        </div>
                      ))}
                  </div>
                  {config.display.showGraph && (
                    <div style={{ marginTop: '8px', height: '60px', background: theme.bgTertiary, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: theme.textMuted }}>
                      Latency Graph
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: theme.bgTertiary
          }}
        >
          <div style={{ fontSize: '13px', color: theme.textSecondary }}>
            {config.global ? (
              <span>Changes will apply to <strong>all cards</strong></span>
            ) : selectedSite ? (
              <span>Changes will apply to <strong>{selectedSite.name}</strong> only</span>
            ) : (
              <span>Select a site or apply globally</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                ...buttonStyle,
                padding: '8px 16px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                ...buttonStyle,
                background: theme.primary,
                color: '#fff',
                border: `1px solid ${theme.primary}`,
                padding: '8px 16px'
              }}
            >
              <Check size={14} />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardEditorModal;

