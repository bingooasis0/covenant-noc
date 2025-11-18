import React, { useState, useEffect, useRef } from 'react';
import { Server, Activity, AlertCircle, Search, Plus, X, Moon, Sun, Trash2, Save, Layers, Settings, Upload, Clock, TrendingDown, TrendingUp, Wifi } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer } from 'recharts';

const NOCTURNAL = () => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('nocturnal-theme') === 'dark');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [metricsData, setMetricsData] = useState({});
  const [showAddSite, setShowAddSite] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [importText, setImportText] = useState('');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [presets, setPresets] = useState(() => JSON.parse(localStorage.getItem('nocturnal-presets') || '[]'));
  const [auditLog, setAuditLog] = useState(() => JSON.parse(localStorage.getItem('nocturnal-audit') || '[]'));
  const [editingPreset, setEditingPreset] = useState(null);
  const [newPreset, setNewPreset] = useState({ name: '', description: '' });

  const ISP_PROVIDERS = [
    { id: 'spectrum', name: 'Spectrum', color: '#2563eb', icon: '◈' },
    { id: 'att', name: 'AT&T', color: '#3b82f6', icon: '◉' },
    { id: 'comcast', name: 'Comcast', color: '#9333ea', icon: '◆' },
    { id: 'verizon', name: 'Verizon', color: '#dc2626', icon: '◈' },
    { id: 'centurylink', name: 'CenturyLink', color: '#16a34a', icon: '◉' },
    { id: 'cox', name: 'Cox', color: '#ea580c', icon: '◆' },
    { id: 'frontier', name: 'Frontier', color: '#0d9488', icon: '◈' }
  ];

  const DEVICE_TYPES = [
    { id: 'meraki-mx', name: 'Meraki MX', icon: '🛡️' },
    { id: 'unifi-gateway', name: 'UniFi Gateway', icon: '📡' },
    { id: 'unifi-cloudkey', name: 'UniFi Cloud Key', icon: '☁️' },
    { id: 'pfsense', name: 'pfSense', icon: '🔥' },
    { id: 'fortigate', name: 'FortiGate', icon: '🏰' },
    { id: 'cisco-router', name: 'Cisco Router', icon: '🔷' }
  ];

  const [sites, setSites] = useState(() => {
    const saved = localStorage.getItem('nocturnal-sites');
    return saved ? JSON.parse(saved) : [
      { id: '1', customer: 'Acme Corp', name: 'New York HQ', status: 'operational', devices: 245, ip: '10.1.1.1', isp: 'spectrum', device: 'meraki-mx' },
      { id: '2', customer: 'Acme Corp', name: 'Los Angeles', status: 'degraded', devices: 128, ip: '10.1.2.1', isp: 'att', device: 'unifi-gateway' },
      { id: '3', customer: 'Acme Corp', name: 'Data Center VA', status: 'operational', devices: 367, ip: '10.1.3.1', isp: 'centurylink', device: 'fortigate' },
      { id: '4', customer: 'TechInnovations', name: 'Corporate Campus', status: 'operational', devices: 512, ip: '10.2.1.1', isp: 'comcast', device: 'meraki-mx' },
      { id: '5', customer: 'TechInnovations', name: 'Regional Branch', status: 'critical', devices: 134, ip: '10.2.2.1', isp: 'verizon', device: 'unifi-cloudkey' },
      { id: '6', customer: 'Global Finance', name: 'Trading Floor NYC', status: 'operational', devices: 289, ip: '10.3.1.1', isp: 'spectrum', device: 'cisco-router' },
      { id: '7', customer: 'Global Finance', name: 'Operations Center', status: 'operational', devices: 156, ip: '10.3.2.1', isp: 'att', device: 'meraki-mx' },
      { id: '8', customer: 'Global Finance', name: 'Disaster Recovery', status: 'degraded', devices: 145, ip: '10.3.3.1', isp: 'cox', device: 'pfsense' },
      { id: '9', customer: 'Healthcare Systems', name: 'Central Hospital', status: 'degraded', devices: 434, ip: '10.4.1.1', isp: 'frontier', device: 'fortigate' },
      { id: '10', customer: 'Healthcare Systems', name: 'Outpatient Clinic', status: 'operational', devices: 89, ip: '10.4.2.1', isp: 'spectrum', device: 'unifi-gateway' },
      { id: '11', customer: 'Advanced Manufacturing', name: 'Production Facility A', status: 'operational', devices: 178, ip: '10.5.1.1', isp: 'comcast', device: 'meraki-mx' },
      { id: '12', customer: 'Advanced Manufacturing', name: 'Production Facility B', status: 'operational', devices: 156, ip: '10.5.2.1', isp: 'verizon', device: 'unifi-cloudkey' }
    ];
  });

  const [newSite, setNewSite] = useState({
    customer: '', name: '', ip: '', devices: 100, status: 'operational', isp: 'spectrum', device: 'meraki-mx'
  });

  const gridRef = useRef(null);
  const [gridConfig, setGridConfig] = useState({ columns: 4, compact: false });

  const logEvent = (type, site, message, severity = 'info') => {
    const event = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type,
      siteId: site.id,
      siteName: site.name,
      customer: site.customer,
      message,
      severity
    };
    setAuditLog(prev => [event, ...prev].slice(0, 500)); // Keep last 500 events
  };

  const styles = {
    bg: { backgroundColor: isDark ? '#0a0a0a' : '#ffffff', color: isDark ? '#f3f4f6' : '#111827', minHeight: '100vh' },
    header: { backgroundColor: isDark ? '#0f0f0f' : '#f3f4f6', borderBottom: `1px solid ${isDark ? '#1f2937' : '#d1d5db'}` },
    card: { backgroundColor: isDark ? '#111111' : '#ffffff', boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.1)' },
    input: { backgroundColor: isDark ? '#0a0a0a' : '#ffffff', border: `1px solid ${isDark ? '#1f2937' : '#d1d5db'}`, color: isDark ? '#d1d5db' : '#111827' },
    border: { borderColor: isDark ? '#1f2937' : '#d1d5db' },
    secondaryText: { color: isDark ? '#6b7280' : '#4b5563' },
    tertiaryText: { color: isDark ? '#4b5563' : '#6b7280' },
    modal: { backgroundColor: isDark ? '#111111' : '#ffffff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }
  };

  useEffect(() => {
    localStorage.setItem('nocturnal-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('nocturnal-sites', JSON.stringify(sites));
    localStorage.setItem('nocturnal-presets', JSON.stringify(presets));
    localStorage.setItem('nocturnal-audit', JSON.stringify(auditLog));
  }, [isDark, sites, presets, auditLog]);

  useEffect(() => {
    const calculateGrid = () => {
      if (!gridRef.current) return;
      const viewportHeight = window.innerHeight;
      const filteredCount = filteredSites.length;
      if (filteredCount === 0) return;
      let optimalColumns = 4;
      if (filteredCount <= 4) optimalColumns = filteredCount;
      else if (filteredCount <= 20) optimalColumns = 4;
      else optimalColumns = 5;
      const rows = Math.ceil(filteredCount / optimalColumns);
      const needsCompact = rows * 280 > viewportHeight - 112;
      setGridConfig({ columns: optimalColumns, compact: needsCompact });
    };
    calculateGrid();
    window.addEventListener('resize', calculateGrid);
    return () => window.removeEventListener('resize', calculateGrid);
  }, [sites.length, searchTerm, customerFilter, statusFilter]);

  useEffect(() => {
    const generateMetrics = () => {
      const newMetrics = {};
      sites.forEach(site => {
        const prevData = metricsData[site.id] || [];
        const lastMetric = prevData[prevData.length - 1];
        const data = [];
        for (let i = 30; i >= 0; i--) {
          data.push({
            latency: site.status === 'critical' ? Math.floor(Math.random() * 150 + 150) :
                    site.status === 'degraded' ? Math.floor(Math.random() * 50 + 60) :
                    Math.floor(Math.random() * 20 + 5),
            bandwidth: site.status === 'critical' ? Math.floor(Math.random() * 200 + 800) :
                      site.status === 'degraded' ? Math.floor(Math.random() * 150 + 650) :
                      Math.floor(Math.random() * 300 + 400),
            uptime: site.status === 'critical' ? Math.floor(Math.random() * 20 + 60) :
                   site.status === 'degraded' ? Math.floor(Math.random() * 10 + 85) :
                   Math.floor(Math.random() * 3 + 97)
          });
        }
        
        // Generate alerts based on status changes
        const currentMetric = data[data.length - 1];
        if (lastMetric && site.status === 'critical' && Math.random() > 0.7) {
          logEvent('alert', site, 'Critical alert: High latency detected', 'critical');
        } else if (lastMetric && site.status === 'degraded' && Math.random() > 0.85) {
          logEvent('alert', site, 'Warning: Network performance degraded', 'warning');
        }
        
        newMetrics[site.id] = data;
      });
      setMetricsData(newMetrics);
    };
    generateMetrics();
    const interval = setInterval(generateMetrics, 1000);
    return () => clearInterval(interval);
  }, [sites]);

  const toggleTheme = () => setIsDark(!isDark);
  const addSite = () => {
    if (!newSite.customer || !newSite.name || !newSite.ip) return;
    const site = { ...newSite, id: Date.now().toString(), devices: parseInt(newSite.devices) };
    setSites([...sites, site]);
    logEvent('created', site, `Site added: ${site.name}`, 'info');
    setNewSite({ customer: '', name: '', ip: '', devices: 100, status: 'operational', isp: 'spectrum', device: 'meraki-mx' });
    setShowAddSite(false);
  };
  const importIPs = () => {
    if (!importText.trim()) return;
    const newSites = importText.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.trim().split(/[,\t]+/);
      const ip = parts[0]?.trim();
      if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        return {
          id: `${Date.now()}-${Math.random()}`,
          customer: parts[2]?.trim() || 'Imported',
          name: parts[1]?.trim() || `Site ${ip}`,
          ip, devices: 100, status: 'operational',
          isp: ISP_PROVIDERS[Math.floor(Math.random() * ISP_PROVIDERS.length)].id,
          device: DEVICE_TYPES[Math.floor(Math.random() * DEVICE_TYPES.length)].id
        };
      }
      return null;
    }).filter(Boolean);
    if (newSites.length > 0) {
      setSites([...sites, ...newSites]);
      logEvent('bulk_import', { id: 'system', name: 'System', customer: 'System' }, `Bulk imported ${newSites.length} sites`, 'info');
      setImportText('');
      setShowSettings(false);
    }
  };
  const removeSite = (id) => {
    const site = sites.find(s => s.id === id);
    if (site) {
      logEvent('deleted', site, `Site removed: ${site.name}`, 'warning');
      setSites(sites.filter(s => s.id !== id));
    }
  };
  const clearAllSites = () => {
    if (window.confirm('Delete ALL?')) {
      logEvent('bulk_delete', { id: 'system', name: 'System', customer: 'System' }, `All sites cleared (${sites.length} sites)`, 'critical');
      setSites([]);
    }
  };
  const savePreset = () => {
    if (!newPreset.name) return;
    const preset = {
      id: editingPreset?.id || Date.now().toString(),
      name: newPreset.name,
      description: newPreset.description,
      sites: JSON.parse(JSON.stringify(sites)),
      createdAt: editingPreset?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setPresets(editingPreset ? presets.map(p => p.id === preset.id ? preset : p) : [...presets, preset]);
    setNewPreset({ name: '', description: '' });
    setEditingPreset(null);
  };
  const loadPreset = (preset) => {
    if (window.confirm(`Load "${preset.name}"?`)) {
      setSites(JSON.parse(JSON.stringify(preset.sites)));
      logEvent('preset_loaded', { id: 'system', name: 'System', customer: 'System' }, `Preset loaded: ${preset.name}`, 'info');
      setShowPresets(false);
    }
  };
  const deletePreset = (id) => { if (window.confirm('Delete?')) setPresets(presets.filter(p => p.id !== id)); };
  const startEditPreset = (p) => { setEditingPreset(p); setNewPreset({ name: p.name, description: p.description }); };
  const getMetrics = (id) => { const d = metricsData[id]; return d ? d[d.length - 1] : null; };
  const getDeviceBreakdown = (t) => ({ switches: Math.floor(t * 0.08), routers: Math.floor(t * 0.05), servers: Math.floor(t * 0.12), endpoints: Math.floor(t * 0.75) });
  const getHealthScore = (s) => s === 'operational' ? Math.floor(Math.random() * 8 + 92) : s === 'degraded' ? Math.floor(Math.random() * 15 + 70) : Math.floor(Math.random() * 20 + 40);
  const getAlertCount = (s) => s === 'critical' ? Math.floor(Math.random() * 8 + 5) : s === 'degraded' ? Math.floor(Math.random() * 3 + 1) : 0;
  const getDeviceInfo = (id) => DEVICE_TYPES.find(d => d.id === id) || DEVICE_TYPES[0];
  const getISPInfo = (id) => ISP_PROVIDERS.find(i => i.id === id) || ISP_PROVIDERS[0];

  const customers = [...new Set(sites.map(s => s.customer))];
  const filteredSites = sites.filter(site => {
    const ms = !searchTerm || site.name.toLowerCase().includes(searchTerm.toLowerCase()) || site.customer.toLowerCase().includes(searchTerm.toLowerCase()) || site.ip.includes(searchTerm);
    const mc = customerFilter === 'all' || site.customer === customerFilter;
    const mst = statusFilter === 'all' || site.status === statusFilter;
    return ms && mc && mst;
  });
  const stats = {
    total: sites.length,
    operational: sites.filter(s => s.status === 'operational').length,
    degraded: sites.filter(s => s.status === 'degraded').length,
    critical: sites.filter(s => s.status === 'critical').length
  };

  return (
    <div style={styles.bg}>
      <div style={styles.header}>
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #2563eb, #9333ea)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} color="white" />
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>NOCTURNAL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                <span style={styles.secondaryText}>{stats.operational}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                <span style={styles.secondaryText}>{stats.degraded}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                <span style={styles.secondaryText}>{stats.critical}</span>
              </div>
            </div>
          </div>

          {/* MINI NAV BAR */}
          <div style={{ display: 'flex', gap: 2, padding: '2px 4px', background: isDark ? '#1f2937' : '#e5e7eb', borderRadius: 6 }}>
            <button onClick={() => setShowHistory(true)} style={{ padding: '4px 12px', fontSize: 11, borderRadius: 4, border: 'none', background: isDark ? '#374151' : '#d1d5db', color: isDark ? '#d1d5db' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
              <Clock size={12} />History
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={toggleTheme} style={{ padding: 6, borderRadius: 4, border: 'none', background: isDark ? '#1f2937' : '#e5e7eb', color: isDark ? '#9ca3af' : '#4b5563', cursor: 'pointer' }}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setShowSettings(true)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 4, border: 'none', background: isDark ? '#1f2937' : '#e5e7eb', color: isDark ? '#d1d5db' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings size={14} />Settings
            </button>
            <button onClick={() => setShowPresets(true)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 4, border: 'none', background: isDark ? '#1f2937' : '#e5e7eb', color: isDark ? '#d1d5db' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} />Presets
            </button>
            <button onClick={clearAllSites} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 4, border: 'none', background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} />Clear
            </button>
            <button onClick={() => setShowAddSite(true)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 4, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} />Add
            </button>
          </div>
        </div>
        <div style={{ ...styles.border, borderTop: '1px solid', padding: '6px 16px', display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', ...styles.tertiaryText }} />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." style={{ ...styles.input, width: '100%', paddingLeft: 28, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 12, borderRadius: 4, outline: 'none' }} />
          </div>
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={{ ...styles.input, padding: '4px 8px', fontSize: 12, borderRadius: 4, outline: 'none' }}>
            <option value="all">All Customers</option>
            {customers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...styles.input, padding: '4px 8px', fontSize: 12, borderRadius: 4, outline: 'none' }}>
            <option value="all">All Status</option>
            <option value="operational">Operational</option>
            <option value="degraded">Degraded</option>
            <option value="critical">Critical</option>
          </select>
          <div style={{ ...styles.tertiaryText, fontSize: 12, fontFamily: 'monospace', paddingTop: 4 }}>{filteredSites.length}/{stats.total}</div>
        </div>
      </div>

      <div ref={gridRef} style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`, gap: 12 }}>
          {filteredSites.map(site => {
            const metrics = getMetrics(site.id);
            const deviceBreakdown = getDeviceBreakdown(site.devices);
            const healthScore = getHealthScore(site.status);
            const alertCount = getAlertCount(site.status);
            const chartData = metricsData[site.id] || [];
            const deviceInfo = getDeviceInfo(site.device);
            const ispInfo = getISPInfo(site.isp);
            const healthColor = healthScore >= 90 ? '#10b981' : healthScore >= 70 ? '#f59e0b' : '#ef4444';
            const statusBorder = site.status === 'critical' ? (isDark ? '#7f1d1d' : '#fca5a5') : site.status === 'degraded' ? (isDark ? '#78350f' : '#fcd34d') : (isDark ? '#1f2937' : '#d1d5db');
            const isHovered = hoveredCard === site.id;

            return (
              <div key={site.id} style={{ 
                ...styles.card, 
                border: `1px solid ${statusBorder}`, 
                borderRadius: 8, 
                padding: gridConfig.compact ? 10 : 12, 
                position: 'relative',
                filter: isHovered ? 'blur(2px)' : 'none',
                transition: 'filter 0.2s ease'
              }}>
                <button 
                  onMouseEnter={() => setHoveredCard(site.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => removeSite(site.id)} 
                  style={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8, 
                    padding: 6, 
                    borderRadius: 4, 
                    border: '2px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.15)', 
                    color: '#ef4444', 
                    cursor: 'pointer',
                    filter: 'none',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                    zIndex: 10
                  }}>
                  <Trash2 size={12} />
                </button>

                <div style={{ marginBottom: gridConfig.compact ? 6 : 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 40, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: gridConfig.compact ? 2 : 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: site.status === 'critical' ? '#ef4444' : site.status === 'degraded' ? '#f59e0b' : '#10b981', flexShrink: 0 }}></div>
                        <h3 style={{ fontSize: gridConfig.compact ? 12 : 14, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.name}</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, ...styles.secondaryText }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.customer}</span>
                        <span>•</span>
                        <span style={{ fontFamily: 'monospace' }}>{site.ip}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <div style={{ fontSize: gridConfig.compact ? 16 : 18, fontWeight: 'bold', fontFamily: 'monospace', color: healthColor }}>{healthScore}</div>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', ...styles.tertiaryText }}>{gridConfig.compact ? 'H' : 'Health'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: gridConfig.compact ? 24 : 28, marginBottom: gridConfig.compact ? 6 : 8 }}>
                  {alertCount > 0 && (
                    <div style={{ padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: site.status === 'critical' ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2') : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'), color: site.status === 'critical' ? '#ef4444' : '#f59e0b', border: `1px solid ${site.status === 'critical' ? '#7f1d1d' : '#78350f'}` }}>
                      <AlertCircle size={12} />
                      {alertCount} Alert{alertCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {!gridConfig.compact && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
                    {[{ label: 'SW', value: deviceBreakdown.switches }, { label: 'RT', value: deviceBreakdown.routers }, { label: 'SV', value: deviceBreakdown.servers }, { label: 'EP', value: deviceBreakdown.endpoints }].map((item, i) => (
                      <div key={i} style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderRadius: 4, padding: 4, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, marginBottom: 2, ...styles.tertiaryText }}>{item.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {metrics && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: gridConfig.compact ? 6 : 8 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: gridConfig.compact ? 2 : 4 }}>
                        <span style={{ fontSize: 10, ...styles.tertiaryText }}>Latency</span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: metrics.latency > 100 ? '#ef4444' : metrics.latency > 50 ? '#f59e0b' : '#10b981' }}>{metrics.latency}ms</span>
                      </div>
                      <div style={{ height: gridConfig.compact ? 24 : 32, marginLeft: -4, marginRight: -4 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <Line type="monotone" dataKey="latency" stroke="#8b5cf6" strokeWidth={1} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: gridConfig.compact ? 2 : 4 }}>
                        <span style={{ fontSize: 10, ...styles.tertiaryText }}>Bandwidth</span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: metrics.bandwidth > 800 ? '#ef4444' : metrics.bandwidth > 650 ? '#f59e0b' : '#10b981' }}>{metrics.bandwidth}M</span>
                      </div>
                      <div style={{ height: gridConfig.compact ? 24 : 32, marginLeft: -4, marginRight: -4 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id={`grad-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="bandwidth" stroke="#3b82f6" strokeWidth={1} fill={`url(#grad-${site.id})`} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 8, borderTop: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}` }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, marginBottom: 2, ...styles.tertiaryText }}>ISP</div>
                    <div style={{ background: ispInfo.color, color: 'white', fontSize: 10, fontWeight: 'bold', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>{ispInfo.icon}</span>
                      <span>{ispInfo.name}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, marginBottom: 2, ...styles.tertiaryText }}>Device</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isDark ? '#a78bfa' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span>{deviceInfo.icon}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deviceInfo.name.split(' ')[0]}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, marginBottom: 2, ...styles.tertiaryText }}>Uptime</div>
                    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: metrics && metrics.uptime > 95 ? '#10b981' : metrics && metrics.uptime > 85 ? '#f59e0b' : '#ef4444' }}>{metrics ? metrics.uptime : '-'}%</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HISTORY/AUDIT LOG MODAL */}
      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ ...styles.modal, borderRadius: 8, maxWidth: 900, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock size={20} style={{ color: '#3b82f6' }} />
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Audit Log & History</h2>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ padding: 4, borderRadius: 4, border: 'none', background: isDark ? '#1f2937' : '#f3f4f6', color: isDark ? '#9ca3af' : '#6b7280', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {auditLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, ...styles.secondaryText }}>
                  <Clock size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No audit events yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {auditLog.map(event => (
                    <div key={event.id} style={{ 
                      display: 'flex', 
                      gap: 16, 
                      padding: 12, 
                      borderRadius: 6, 
                      border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
                      background: event.severity === 'critical' ? (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') :
                                 event.severity === 'warning' ? (isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb') :
                                 (isDark ? '#0a0a0a' : '#f9fafb')
                    }}>
                      <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                        {event.type === 'alert' && <AlertCircle size={20} style={{ color: event.severity === 'critical' ? '#ef4444' : '#f59e0b' }} />}
                        {event.type === 'created' && <TrendingUp size={20} style={{ color: '#10b981' }} />}
                        {event.type === 'deleted' && <TrendingDown size={20} style={{ color: '#ef4444' }} />}
                        {(event.type === 'bulk_import' || event.type === 'bulk_delete' || event.type === 'preset_loaded') && <Layers size={20} style={{ color: '#3b82f6' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{event.siteName}</span>
                            <span style={{ fontSize: 11, ...styles.tertiaryText }}>{event.customer}</span>
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', ...styles.tertiaryText }}>
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, margin: 0, ...styles.secondaryText }}>{event.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NOCTURNAL;