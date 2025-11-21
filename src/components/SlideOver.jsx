import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, Terminal, Settings, Clock, Save, Play, Wifi, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { authFetch } from '../utils/api';

const THEME = {
  bg: '#050505',
  panelBg: '#0a0e14',
  border: 'rgba(255, 255, 255, 0.1)',
  accent: '#2f81f7',
  text: '#e6edf3',
  textDim: '#8b949e',
  codeBg: '#0d1117'
};

const SlideOver = ({ site, onClose, isOpen, onUpdateSite }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [commandOutput, setCommandOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [customInterval, setCustomInterval] = useState(site?.monitoringInterval || 60);
  const [localMetrics, setLocalMetrics] = useState(null);
  const [history, setHistory] = useState([]);

  // Animation classes
  const translateClass = isOpen ? 'translate-x-0' : 'translate-x-full';

  // Load specific site data on open
  useEffect(() => {
    if (isOpen && site) {
      loadHistory();
      setCustomInterval(site.monitoringInterval || 60);
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

  const saveSettings = async () => {
    try {
      await authFetch(`/api/sites/${site.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...site,
          monitoringInterval: parseInt(customInterval)
        })
      });
      if (onUpdateSite) onUpdateSite();
      alert('Settings saved');
    } catch (err) {
      console.error('Failed to save settings', err);
    }
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
                <Activity size={32} color={THEME.accent} />
                <div>
                  <div style={{ color: THEME.textDim, fontSize: '12px' }}>CURRENT STATUS</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: THEME.success }}>OPERATIONAL</div>
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
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: THEME.textDim, marginBottom: '8px', fontSize: '13px' }}>
                  Polling Interval (Seconds)
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
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
                      width: '100px'
                    }}
                  />
                  <button
                    onClick={saveSettings}
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
                    <Save size={16} /> Save
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: THEME.textDim, marginTop: '8px' }}>
                  Default is 60 seconds. Lower intervals increase load on the monitoring server.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default SlideOver;

