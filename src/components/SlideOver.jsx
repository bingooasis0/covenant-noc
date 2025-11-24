import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, Terminal, Settings, Clock, Save, Play, Wifi, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { authFetch } from '../utils/api';
import { ConfirmModal } from './noc-dashboard/modals';
import { showSuccess, showError } from '../services/toast';

const THEME = {
  bg: '#050505',
  panelBg: '#0a0e14',
  border: 'rgba(255, 255, 255, 0.1)',
  accent: '#2f81f7',
  text: '#e6edf3',
  textDim: '#8b949e',
  codeBg: '#0d1117',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149'
};

const SlideOver = ({ site, onClose, isOpen, onUpdateSite }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [commandOutput, setCommandOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [customInterval, setCustomInterval] = useState(site?.monitoringInterval || 60);
  const [localMetrics, setLocalMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({});

  // Animation classes
  const translateClass = isOpen ? 'translate-x-0' : 'translate-x-full';

  // Load specific site data on open
  useEffect(() => {
    if (isOpen && site) {
      loadHistory();
      loadLatestMetrics();
      setCustomInterval(site.monitoringInterval || 60);
      setFormData({
        failoverIp: site.failoverIp || '',
        monitoringSnmp: site.monitoringSnmp || false,
        snmpCommunity: site.snmpCommunity || 'public',
        monitoringMeraki: site.monitoringMeraki || false,
        apiKey: site.apiKey || ''
      });
    }
  }, [isOpen, site]);

  const loadHistory = async () => {
    try {
      const res = await authFetch(`/api/monitoring/${site.id}/history?hours=24`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  const loadLatestMetrics = async () => {
    try {
      const res = await authFetch(`/api/monitoring/${site.id}`);
      const data = await res.json();
      setLocalMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics', err);
    }
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'operational' || s === 'online') return THEME.success;
    if (s === 'degraded') return THEME.warning;
    if (s === 'critical' || s === 'offline') return THEME.danger;
    return THEME.textDim;
  };

  const status = localMetrics?.status || site?.status || 'UNKNOWN';
  const statusColor = getStatusColor(status);

  const runCommand = async (cmd) => {
    setIsRunning(true);
    setCommandOutput(prev => prev + `\n> Running ${cmd} on ${site.ip}...\n`);
    
    try {
      const endpoint = cmd === 'ping' ? '/api/tools/ping' : '/api/tools/traceroute';
      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: site.ip })
      });
      const data = await res.json();
      
      if (cmd === 'ping') {
        setCommandOutput(prev => prev + JSON.stringify(data, null, 2) + '\n');
      } else {
        setCommandOutput(prev => prev + (data.output || data.error) + '\n');
      }
    } catch (err) {
      setCommandOutput(prev => prev + `Error: ${err.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveClick = () => {
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    try {
      await authFetch(`/api/sites/${site.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...site,
          monitoringInterval: parseInt(customInterval),
          ...formData
        })
      });
      if (onUpdateSite) onUpdateSite();
      showSuccess('Settings saved successfully');
      setShowConfirm(false);
    } catch (err) {
      console.error('Failed to save settings', err);
      showError('Failed to save settings');
      setShowConfirm(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen || !site) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      />
      
      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '600px',
        maxWidth: '90vw',
        background: THEME.panelBg,
        borderLeft: `1px solid ${THEME.border}`,
        zIndex: 9999,
        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px', 
          borderBottom: `1px solid ${THEME.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div>
            <h2 style={{ margin: 0, color: THEME.text, fontSize: '20px' }}>{site.name}</h2>
            <div style={{ color: THEME.accent, fontSize: '13px', marginTop: '4px', fontFamily: 'monospace' }}>
              {site.ip}
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: THEME.textDim, cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${THEME.border}` }}>
          {['overview', 'tools', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '12px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${THEME.accent}` : '2px solid transparent',
                color: activeTab === tab ? THEME.text : THEME.textDim,
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: 500
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Big Status Card */}
              <div style={{ 
                padding: '20px', 
                borderRadius: '8px', 
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${THEME.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '20px'
              }}>
                <Activity size={32} color={statusColor} />
                <div>
                  <div style={{ color: THEME.textDim, fontSize: '12px' }}>CURRENT STATUS</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: statusColor }}>
                    {status.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Detailed Graph */}
              <div style={{ height: '300px' }}>
                 <h3 style={{ color: THEME.text, fontSize: '14px', marginBottom: '12px' }}>24h Latency Performance</h3>
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={history}>
                     <defs>
                       <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor={THEME.accent} stopOpacity={0.3}/>
                         <stop offset="95%" stopColor={THEME.accent} stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
                     <XAxis 
                        dataKey="timestamp" 
                        tick={{fill: THEME.textDim, fontSize: 10}} 
                        tickFormatter={(tick) => new Date(tick).getHours() + ':00'}
                        interval={Math.floor(history.length / 6)}
                      />
                     <YAxis tick={{fill: THEME.textDim, fontSize: 10}} />
                     <Tooltip 
                        contentStyle={{ backgroundColor: THEME.panelBg, borderColor: THEME.border, color: THEME.text }}
                        labelStyle={{ color: THEME.textDim }}
                      />
                     <Area type="monotone" dataKey="latency" stroke={THEME.accent} fillOpacity={1} fill="url(#colorLat)" />
                   </AreaChart>
                 </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
               <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                 <button 
                   onClick={() => runCommand('ping')}
                   disabled={isRunning}
                   style={{
                     padding: '10px 20px',
                     background: THEME.accent,
                     color: 'white',
                     border: 'none',
                     borderRadius: '6px',
                     cursor: isRunning ? 'not-allowed' : 'pointer',
                     display: 'flex',
                     alignItems: 'center',
                     gap: '8px',
                     opacity: isRunning ? 0.7 : 1
                   }}
                 >
                   <Wifi size={16} /> Ping
                 </button>
                 <button 
                   onClick={() => runCommand('traceroute')}
                   disabled={isRunning}
                   style={{
                     padding: '10px 20px',
                     background: 'rgba(255,255,255,0.05)',
                     color: THEME.text,
                     border: `1px solid ${THEME.border}`,
                     borderRadius: '6px',
                     cursor: isRunning ? 'not-allowed' : 'pointer',
                     display: 'flex',
                     alignItems: 'center',
                     gap: '8px'
                   }}
                 >
                   <Activity size={16} /> Traceroute
                 </button>
               </div>

               <div style={{
                 flex: 1,
                 background: THEME.codeBg,
                 borderRadius: '8px',
                 padding: '16px',
                 fontFamily: 'monospace',
                 fontSize: '13px',
                 color: '#3fb950',
                 overflowY: 'auto',
                 whiteSpace: 'pre-wrap',
                 border: `1px solid ${THEME.border}`
               }}>
                 {commandOutput || '// Ready for commands...'}
                 {isRunning && <div style={{ marginTop: '8px' }}>_</div>}
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: THEME.textDim, marginBottom: '8px', fontSize: '13px' }}>
                    Polling Interval (Seconds)
                  </label>
                  <input 
                    type="number" 
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                      padding: '10px',
                      borderRadius: '6px',
                      width: '100%'
                    }}
                  />
                  <p style={{ fontSize: '12px', color: THEME.textDim, marginTop: '4px' }}>
                    Default is 60 seconds. Lower intervals increase load on the monitoring server.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', color: THEME.textDim, marginBottom: '8px', fontSize: '13px' }}>
                    Failover IP
                  </label>
                  <input 
                    type="text" 
                    value={formData.failoverIp}
                    onChange={(e) => handleInputChange('failoverIp', e.target.value)}
                    placeholder="e.g. 8.8.8.8"
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                      padding: '10px',
                      borderRadius: '6px',
                      width: '100%'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox"
                    id="monitoringSnmp"
                    checked={formData.monitoringSnmp}
                    onChange={(e) => handleInputChange('monitoringSnmp', e.target.checked)}
                  />
                  <label htmlFor="monitoringSnmp" style={{ color: THEME.text, fontSize: '14px' }}>
                    Enable SNMP Monitoring
                  </label>
                </div>

                {formData.monitoringSnmp && (
                  <div>
                    <label style={{ display: 'block', color: THEME.textDim, marginBottom: '8px', fontSize: '13px' }}>
                      SNMP Community
                    </label>
                    <input 
                      type="text" 
                      value={formData.snmpCommunity}
                      onChange={(e) => handleInputChange('snmpCommunity', e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: `1px solid ${THEME.border}`,
                        color: THEME.text,
                        padding: '10px',
                        borderRadius: '6px',
                        width: '100%'
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox"
                    id="monitoringMeraki"
                    checked={formData.monitoringMeraki}
                    onChange={(e) => handleInputChange('monitoringMeraki', e.target.checked)}
                  />
                  <label htmlFor="monitoringMeraki" style={{ color: THEME.text, fontSize: '14px' }}>
                    Enable Meraki API Monitoring
                  </label>
                </div>

                {formData.monitoringMeraki && (
                  <div>
                    <label style={{ display: 'block', color: THEME.textDim, marginBottom: '8px', fontSize: '13px' }}>
                      Meraki API Key
                    </label>
                    <input 
                      type="password" 
                      value={formData.apiKey}
                      onChange={(e) => handleInputChange('apiKey', e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: `1px solid ${THEME.border}`,
                        color: THEME.text,
                        padding: '10px',
                        borderRadius: '6px',
                        width: '100%'
                      }}
                    />
                  </div>
                )}

                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={handleSaveClick}
                    style={{
                      padding: '10px 20px',
                      background: THEME.accent,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Save size={16} /> Save Settings
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <ConfirmModal
          title="Save Changes"
          message="Are you sure you want to save these changes? Monitoring behavior may change immediately."
          onConfirm={confirmSave}
          onCancel={() => setShowConfirm(false)}
          theme={{
            card: THEME.panelBg,
            text: THEME.text,
            textSecondary: THEME.textDim,
            border: THEME.border,
            bgSecondary: '#161b22',
            danger: '#f85149',
            primary: THEME.accent
          }}
        />
      )}
    </>
  );
};

export default SlideOver;

