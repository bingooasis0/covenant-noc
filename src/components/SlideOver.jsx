import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, Terminal, Settings, Clock, Save, Play, Wifi, AlertTriangle, CheckCircle, Network } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Line, BarChart, Bar, Legend
} from 'recharts';
import { authFetch } from '../utils/api';
import { ConfirmModal } from './noc-dashboard/modals';
import { showSuccess, showError } from '../services/toast';
import { 
  formatRelativeTime, 
  formatLatency, 
  ensureArray, 
  withAlpha,
  LATENCY_GOOD_THRESHOLD_MS,
  LATENCY_WARN_THRESHOLD_MS 
} from './noc-dashboard/utils';

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
          {['overview', 'telemetry', 'tools', 'settings'].map(tab => (
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

              {/* Quick Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: `1px solid ${THEME.border}` }}>
                  <div style={{ color: THEME.textDim, fontSize: '12px', marginBottom: '4px' }}>LATENCY</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: THEME.text }}>
                    {localMetrics?.latency ? formatLatency(localMetrics.latency) : '-'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: `1px solid ${THEME.border}` }}>
                  <div style={{ color: THEME.textDim, fontSize: '12px', marginBottom: '4px' }}>PACKET LOSS</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: (localMetrics?.packetLoss || 0) > 0 ? THEME.danger : THEME.success }}>
                    {localMetrics?.packetLoss ? `${localMetrics.packetLoss}%` : '0%'}
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

          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Diagnostic Summary */}
              <div style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                borderLeft: `4px solid ${statusColor}`
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: THEME.text }}>Diagnostic Assessment</h3>
                <div style={{ fontSize: '13px', color: THEME.textDim, lineHeight: '1.5' }}>
                  {(localMetrics?.packetLoss || 0) > 0 ? (
                    <div style={{ marginBottom: '8px', color: THEME.warning }}>
                      <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      <strong>Packet Loss Detected:</strong> {(localMetrics?.packetLoss || 0).toFixed(1)}% loss is occurring. This indicates network congestion, physical layer errors, or ISP issues.
                    </div>
                  ) : (
                    <div style={{ marginBottom: '8px', color: THEME.success }}>
                      <CheckCircle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      <strong>Reachability:</strong> Site is fully reachable with 0% packet loss.
                    </div>
                  )}
                  {(localMetrics?.jitter || 0) > 20 && (
                    <div style={{ marginBottom: '8px', color: THEME.warning }}>
                      <Activity size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      <strong>High Jitter:</strong> {(localMetrics?.jitter || 0).toFixed(1)}ms variation detected. This may cause voice/video quality issues.
                    </div>
                  )}
                  <div>
                    <strong>Analysis:</strong> Monitoring {site?.failoverIp ? 'Primary/Failover' : 'Primary'} path. 
                    Last check was {formatRelativeTime(localMetrics?.timestamp || new Date())}.
                  </div>
                </div>
              </div>

              {/* Latency & Jitter Chart */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: `1px solid ${THEME.border}` }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: THEME.textDim }}>Latency & Jitter (Last 60 Points)</h4>
                <div style={{ height: '250px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={ensureArray(history).slice(-60)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis yAxisId="left" stroke={THEME.textDim} fontSize={10} unit="ms" />
                      <Tooltip
                        contentStyle={{ backgroundColor: THEME.panelBg, border: `1px solid ${THEME.border}`, color: THEME.text }}
                        labelStyle={{ color: THEME.textDim }}
                        labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                      />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="jitter" fill={withAlpha(THEME.warning, 0.2)} stroke={THEME.warning} name="Jitter" />
                      <Line yAxisId="left" type="monotone" dataKey="latency" stroke={THEME.accent} dot={false} strokeWidth={2} name="Latency" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Packet Loss Chart */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: `1px solid ${THEME.border}` }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: THEME.textDim }}>Packet Loss Events</h4>
                <div style={{ height: '150px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ensureArray(history).slice(-60)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} vertical={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis stroke={THEME.textDim} fontSize={10} domain={[0, 100]} unit="%" />
                      <Tooltip
                        contentStyle={{ backgroundColor: THEME.panelBg, border: `1px solid ${THEME.border}`, color: THEME.text }}
                        labelStyle={{ color: THEME.textDim }}
                        labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar dataKey="packetLoss" fill={THEME.danger} name="Loss %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ping Log Table */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: `1px solid ${THEME.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${THEME.border}`, background: 'rgba(255,255,255,0.05)' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: THEME.text }}>Event Log</h4>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: THEME.textDim }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Time</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>Latency</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>Jitter</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ensureArray(history).slice().reverse().map((log, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                          <td style={{ padding: '8px 16px', fontFamily: 'monospace' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '8px 16px' }}>
                            {(log.packetLoss || 0) >= 100 ? (
                              <span style={{ color: THEME.danger, fontWeight: 600 }}>DOWN</span>
                            ) : (log.packetLoss || 0) > 0 ? (
                              <span style={{ color: THEME.warning, fontWeight: 600 }}>UNSTABLE</span>
                            ) : (
                              <span style={{ color: THEME.success }}>UP</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace', color: THEME.text }}>
                            {log.latency !== null ? `${Math.round(log.latency)}ms` : '-'}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {log.jitter !== null ? `${Math.round(log.jitter)}ms` : '-'}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                            <span style={{ 
                              color: (log.packetLoss || 0) > 0 ? THEME.danger : THEME.success,
                              fontWeight: (log.packetLoss || 0) > 0 ? 600 : 400 
                            }}>
                              {log.packetLoss}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

