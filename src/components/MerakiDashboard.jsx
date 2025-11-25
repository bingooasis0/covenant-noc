import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Filter,
  Info,
  Power,
  Wifi,
  Shield,
  Server,
  Eye,
  Activity,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Network,
  Router,
  Globe,
  MapPin,
  Cpu,
  Zap
} from 'lucide-react';
import { authFetch } from '../utils/api';
import { showSuccess, showError, showLoading, dismissToast } from '../services/toast';
import { ConfirmModal } from './noc-dashboard/modals';

// -- Theme Constants --
const THEME = {
  bg: '#050505',
  bgHeader: 'rgba(10, 14, 20, 0.9)',
  bgCard: 'rgba(20, 20, 25, 0.6)',
  bgCardHover: 'rgba(30, 30, 35, 0.8)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(47, 129, 247, 0.5)',
  text: '#e6edf3',
  textDim: '#8b949e',
  accent: '#2f81f7',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
};

// -- Components --

const Card = ({ children, onClick, className = '', style = {} }) => (
  <div
    onClick={onClick}
    style={{
      background: THEME.bgCard,
      border: `1px solid ${THEME.border}`,
      borderRadius: '12px',
      padding: '20px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      overflow: 'hidden',
      ...style
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        e.currentTarget.style.borderColor = THEME.borderHover;
        e.currentTarget.style.background = THEME.bgCardHover;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 0 20px ${THEME.accent}20`;
      }
    }}
    onMouseLeave={(e) => {
      if (onClick) {
        e.currentTarget.style.borderColor = THEME.border;
        e.currentTarget.style.background = THEME.bgCard;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }
    }}
    className={className}
  >
    {children}
  </div>
);

const StatusDot = ({ status, size = 10 }) => {
  let color = THEME.textDim;
  if (status === 'online') color = THEME.success;
  else if (status === 'alerting') color = THEME.warning;
  else if (status === 'offline') color = THEME.danger;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 ${size * 1.5}px ${color}`,
      transition: 'all 0.3s ease'
    }} />
  );
};

const Breadcrumbs = ({ items, onNavigate }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: THEME.textDim }}>
    {items.map((item, index) => (
      <React.Fragment key={index}>
        <span
          onClick={() => item.action && onNavigate(item.action)}
          style={{
            cursor: item.action ? 'pointer' : 'default',
            color: item.active ? THEME.accent : 'inherit',
            fontWeight: item.active ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => item.action && (e.target.style.color = THEME.text)}
          onMouseLeave={(e) => item.action && (e.target.style.color = item.active ? THEME.accent : 'inherit')}
        >
          {item.icon && <item.icon size={14} />}
          {item.label}
        </span>
        {index < items.length - 1 && <ChevronRight size={14} />}
      </React.Fragment>
    ))}
  </div>
);

// -- Main Dashboard Component --

const MerakiDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // -- State --
  const [view, setView] = useState('organizations'); // organizations | networks | devices
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null); // For drill-down panel
  const [deviceDetails, setDeviceDetails] = useState(null); // Detailed device info
  const [loadingDeviceDetails, setLoadingDeviceDetails] = useState(false);
  
  // Confirm Modal State
  const [showRebootConfirm, setShowRebootConfirm] = useState(false);
  const [deviceToReboot, setDeviceToReboot] = useState(null);

  const [data, setData] = useState({
    organizations: [],
    networks: [],
    devices: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // -- Data Fetching --

  const fetchData = async (endpoint) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/meraki/${endpoint}`);
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const json = await res.json();
      return json;
    } catch (err) {
      console.error(err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Load Organizations (Root View)
  useEffect(() => {
    if (view === 'organizations') {
      fetchData('organizations').then(orgs => {
        setData(prev => ({ ...prev, organizations: Array.isArray(orgs) ? orgs : [] }));
      });
    }
  }, [view]);

  // Load Networks (When Org Selected)
  useEffect(() => {
    if (view === 'networks' && selectedOrg) {
      fetchData(`organizations/${selectedOrg.id}/networks`).then(nets => {
        setData(prev => ({ ...prev, networks: Array.isArray(nets) ? nets : [] }));
      });
    }
  }, [view, selectedOrg]);

  // Load Devices (When Network Selected)
  useEffect(() => {
    if (view === 'devices' && selectedNetwork) {
      fetchData(`networks/${selectedNetwork.id}/devices`).then(devs => {
        setData(prev => ({ ...prev, devices: Array.isArray(devs) ? devs : [] }));
      });
    }
  }, [view, selectedNetwork]);

  // Load Device Details (When Device Selected)
  useEffect(() => {
    if (selectedDevice && selectedDevice.serial) {
      setLoadingDeviceDetails(true);
      setDeviceDetails(null);
      fetchData(`device/${selectedDevice.serial}`)
        .then(details => {
          setDeviceDetails(details);
        })
        .catch(err => {
          console.error('Failed to load device details:', err);
          setError('Failed to load device details');
        })
        .finally(() => {
          setLoadingDeviceDetails(false);
        });
    }
  }, [selectedDevice]);

  // -- Navigation Handlers --

  const goHome = () => {
    setView('organizations');
    setSelectedOrg(null);
    setSelectedNetwork(null);
    setSearchQuery('');
  };

  const selectOrg = (org) => {
    setSelectedOrg(org);
    setView('networks');
    setSearchQuery('');
  };

  const selectNetwork = (net) => {
    setSelectedNetwork(net);
    setView('devices');
    setSearchQuery('');
  };

  // -- Actions --

  const confirmReboot = async () => {
    if (!deviceToReboot) return;
    
    const device = deviceToReboot;
    const toastId = showLoading('Rebooting device...');
    
    try {
      const res = await authFetch(`/api/meraki/device/${device.serial}/reboot`, { method: 'POST' });
      const json = await res.json();
      dismissToast(toastId);
      if (json.success) showSuccess('Reboot command sent');
      else showError(json.error || 'Reboot failed');
    } catch (err) {
      dismissToast(toastId);
      showError(err.message);
    } finally {
        setShowRebootConfirm(false);
        setDeviceToReboot(null);
    }
  };

  const handleReboot = (device, e) => {
    if (e) e.stopPropagation();
    setDeviceToReboot(device);
    setShowRebootConfirm(true);
  };

  // -- Render Helpers --

  const getDeviceIcon = (model = '') => {
    if (model.startsWith('MX')) return Shield;
    if (model.startsWith('MS')) return Server; // Switch icon better represented by Server/Network usually
    if (model.startsWith('MR')) return Wifi;
    if (model.startsWith('MV')) return Eye;
    if (model.startsWith('MG')) return Activity;
    return Router;
  };

  const getBreadcrumbs = () => {
    const crumbs = [{ label: 'Organizations', icon: Globe, action: goHome, active: view === 'organizations' }];
    if (selectedOrg) {
      crumbs.push({ 
        label: selectedOrg.name, 
        icon: MapPin, 
        action: () => setView('networks'), 
        active: view === 'networks' 
      });
    }
    if (selectedNetwork) {
      crumbs.push({ 
        label: selectedNetwork.name, 
        icon: Network, 
        active: view === 'devices' 
      });
    }
    return crumbs;
  };

  const filteredItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    if (!searchQuery) return items;
    const lower = searchQuery.toLowerCase();
    return items.filter(item => 
      (item.name && item.name.toLowerCase().includes(lower)) ||
      (item.id && item.id.toLowerCase().includes(lower)) ||
      (item.serial && item.serial.toLowerCase().includes(lower)) ||
      (item.model && item.model.toLowerCase().includes(lower))
    );
  };

  // -- Views --

  const OrganizationsView = () => {
    const items = filteredItems(data.organizations);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', padding: '24px' }}>
        {items.map(org => (
          <Card key={org.id} onClick={() => selectOrg(org)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(47, 129, 247, 0.1)', padding: '12px', borderRadius: '8px' }}>
                <Globe size={24} color={THEME.accent} />
              </div>
              <ChevronRight size={20} color={THEME.textDim} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>{org.name}</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: THEME.textDim }}>
              <span>ID: {org.id}</span>
              <span>{org.region || 'Global'}</span>
            </div>
          </Card>
        ))}
        {items.length === 0 && !loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: THEME.textDim }}>
            No organizations found.
          </div>
        )}
      </div>
    );
  };

  const NetworksView = () => {
    const items = filteredItems(data.networks);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', padding: '24px' }}>
        {items.map(net => (
          <Card key={net.id} onClick={() => selectNetwork(net)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(63, 185, 80, 0.1)', padding: '10px', borderRadius: '8px' }}>
                <Network size={20} color={THEME.success} />
              </div>
              {/* Placeholder for status if we fetch it at org level */}
            </div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>{net.name}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: THEME.textDim }}>{net.timeZone}</p>
            
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(net.tags || []).slice(0, 3).map(tag => (
                <span key={tag} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        ))}
        {items.length === 0 && !loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: THEME.textDim }}>
            No networks found in this organization.
          </div>
        )}
      </div>
    );
  };

  const DevicesView = () => {
    const items = filteredItems(data.devices);
    
    // Group by type
    const grouped = useMemo(() => {
      const groups = {};
      items.forEach(dev => {
        const type = dev.model?.substring(0, 2) || 'Other';
        let label = 'Other Devices';
        if (type === 'MX') label = 'Security Appliances';
        if (type === 'MS') label = 'Switches';
        if (type === 'MR') label = 'Access Points';
        if (type === 'MV') label = 'Cameras';
        if (!groups[label]) groups[label] = [];
        groups[label].push(dev);
      });
      return groups;
    }, [items]);

    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {Object.entries(grouped).map(([label, groupItems]) => (
          <div key={label}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: THEME.textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {label} ({groupItems.length})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {groupItems.map(dev => {
                const Icon = getDeviceIcon(dev.model);
                return (
                  <Card key={dev.serial} onClick={() => setSelectedDevice(dev)}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                          <Icon size={20} color={THEME.text} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '15px' }}>{dev.name || dev.serial}</div>
                          <div style={{ fontSize: '12px', color: THEME.textDim }}>{dev.model}</div>
                        </div>
                      </div>
                      <StatusDot status={dev.status} />
                    </div>

                    {/* Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: THEME.textDim, background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>IP ADDRESS</span>
                        <span style={{ color: THEME.text, fontFamily: 'monospace' }}>{dev.lanIp || dev.wan1Ip || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>SERIAL</span>
                        <span style={{ color: THEME.text, fontFamily: 'monospace' }}>{dev.serial}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>MAC</span>
                        <span style={{ color: THEME.text, fontFamily: 'monospace' }}>{dev.mac || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>STATUS</span>
                        <span style={{ color: dev.status === 'online' ? THEME.success : THEME.danger }}>
                          {(dev.status || 'unknown').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button 
                        onClick={(e) => handleReboot(dev, e)}
                        style={{ background: 'none', border: 'none', color: THEME.danger, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Power size={14} /> Reboot
                      </button>
                      <button 
                        style={{ background: 'none', border: 'none', color: THEME.accent, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Info size={14} /> Details
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        {items.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: THEME.textDim }}>
            No devices found in this network.
          </div>
        )}
      </div>
    );
  };

  // -- Render --

  return (
    <div style={{
      height: '100vh',
      background: THEME.bg,
      color: THEME.text,
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      
      {/* Header Bar */}
      <div style={{
        height: '64px',
        background: THEME.bgHeader,
        borderBottom: `1px solid ${THEME.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        backdropFilter: 'blur(12px)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div 
            onClick={() => navigate('/dashboard/grid')} 
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            <div style={{ background: THEME.accent, borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wifi size={20} color="#fff" />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.5px' }}>MERAKI<span style={{ color: THEME.textDim }}>NOC</span></span>
          </div>
          <div style={{ height: '24px', width: '1px', background: THEME.border }}></div>
          <Breadcrumbs items={getBreadcrumbs()} onNavigate={setView} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Global Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: THEME.textDim }} />
            <input 
              type="text" 
              placeholder="Search infrastructure..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${THEME.border}`,
                borderRadius: '8px',
                padding: '8px 12px 8px 36px',
                color: THEME.text,
                fontSize: '13px',
                width: '240px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = THEME.accent}
              onBlur={(e) => e.target.style.borderColor = THEME.border}
            />
          </div>
          
          <button onClick={onLogout} title="Logout" style={{ background: 'none', border: 'none', color: THEME.textDim, cursor: 'pointer' }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'rgba(47, 129, 247, 0.2)', overflow: 'hidden' }}>
            <div style={{ width: '50%', height: '100%', background: THEME.accent, animation: 'indeterminate 1.5s infinite linear' }} />
            <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ margin: '24px', padding: '16px', background: 'rgba(248, 81, 73, 0.1)', border: `1px solid ${THEME.danger}`, borderRadius: '8px', color: THEME.danger, display: 'flex', gap: '12px' }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Error loading data</strong>
              <div>{error}</div>
            </div>
          </div>
        )}

        {view === 'organizations' && <OrganizationsView />}
        {view === 'networks' && <NetworksView />}
        {view === 'devices' && <DevicesView />}
      </div>

      {/* Device Detail Slide-Over (Using the existing component style) */}
      {selectedDevice && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: '500px',
          background: '#0a0e14',
          borderLeft: `1px solid ${THEME.border}`,
          zIndex: 100,
          boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '24px', borderBottom: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedDevice.name || selectedDevice.serial}</h2>
            <button onClick={() => setSelectedDevice(null)} style={{ background: 'none', border: 'none', color: THEME.textDim, cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            {loadingDeviceDetails ? (
              <div style={{ textAlign: 'center', padding: '40px', color: THEME.textDim }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                <div style={{ marginTop: '12px' }}>Loading device details...</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '24px' }}>
                {/* Status */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '14px', color: THEME.textDim, textTransform: 'uppercase' }}>Status</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                    <StatusDot status={deviceDetails?.status || selectedDevice.status} size={12} />
                    <span style={{ fontSize: '16px', fontWeight: 600, textTransform: 'capitalize' }}>
                      {(deviceDetails?.status || selectedDevice.status || 'Unknown').toLowerCase()}
                    </span>
                  </div>
                  {deviceDetails?.lastReportedAt && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: THEME.textDim }}>
                      Last reported: {new Date(deviceDetails.lastReportedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Hardware */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '14px', color: THEME.textDim, textTransform: 'uppercase' }}>Hardware</h3>
                  <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: THEME.textDim }}>Model</span>
                      <span>{deviceDetails?.model || selectedDevice.model}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: THEME.textDim }}>Serial</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{selectedDevice.serial}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: THEME.textDim }}>MAC</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{deviceDetails?.mac || selectedDevice.mac || 'N/A'}</span>
                    </div>
                    {deviceDetails?.firmware && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: THEME.textDim }}>Firmware</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{deviceDetails.firmware}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Network */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '14px', color: THEME.textDim, textTransform: 'uppercase' }}>Network</h3>
                  <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: THEME.textDim }}>Public IP</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{deviceDetails?.publicIp || selectedDevice.publicIp || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: THEME.textDim }}>LAN IP</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{deviceDetails?.lanIp || selectedDevice.lanIp || selectedDevice.wan1Ip || 'N/A'}</span>
                    </div>
                    {deviceDetails?.wan1Ip && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: THEME.textDim }}>WAN1 IP</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{deviceDetails.wan1Ip}</span>
                      </div>
                    )}
                    {deviceDetails?.wan2Ip && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: THEME.textDim }}>WAN2 IP</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{deviceDetails.wan2Ip}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Uplinks */}
                {deviceDetails?.uplinks && deviceDetails.uplinks.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '14px', color: THEME.textDim, textTransform: 'uppercase' }}>Uplinks</h3>
                    <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
                      {deviceDetails.uplinks.map((uplink, idx) => (
                        <div key={idx} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{uplink.interface || `Uplink ${idx + 1}`}</span>
                            <StatusDot status={uplink.status === 'active' ? 'online' : 'offline'} size={8} />
                          </div>
                          {uplink.ip && <div style={{ fontSize: '12px', color: THEME.textDim, fontFamily: 'monospace' }}>{uplink.ip}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Switch Ports (if applicable) */}
                {deviceDetails?.switchPorts && deviceDetails.switchPorts.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '14px', color: THEME.textDim, textTransform: 'uppercase' }}>Switch Ports</h3>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                      {deviceDetails.switchPorts.slice(0, 10).map((port, idx) => (
                        <div key={idx} style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Port {port.portId || idx + 1}</span>
                            <StatusDot status={port.enabled ? 'online' : 'offline'} size={6} />
                          </div>
                          {port.name && <div style={{ color: THEME.textDim, marginTop: '2px' }}>{port.name}</div>}
                        </div>
                      ))}
                      {deviceDetails.switchPorts.length > 10 && (
                        <div style={{ textAlign: 'center', color: THEME.textDim, fontSize: '11px', marginTop: '4px' }}>
                          +{deviceDetails.switchPorts.length - 10} more ports
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'grid', gap: '12px' }}>
                  <button 
                    onClick={() => handleReboot(selectedDevice)}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: 'rgba(248, 81, 73, 0.1)',
                      border: `1px solid ${THEME.danger}`,
                      color: THEME.danger,
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Power size={18} /> Reboot Device
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showRebootConfirm && (
        <ConfirmModal
            title="Reboot Device?"
            message={`Are you sure you want to reboot ${deviceToReboot?.name || deviceToReboot?.serial}? This will cause temporary downtime.`}
            onConfirm={confirmReboot}
            onCancel={() => {
                setShowRebootConfirm(false);
                setDeviceToReboot(null);
            }}
            theme={{
                bg: THEME.bgCard,
                text: THEME.text,
                textSecondary: THEME.textDim,
                border: THEME.border,
                primary: THEME.accent,
                danger: THEME.danger
            }}
        />
      )}

    </div>
  );
};

export default MerakiDashboard;
