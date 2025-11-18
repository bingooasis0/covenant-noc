import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, Settings, LogOut, Sun, Moon, Plus, Search,
  Wifi, Shield, Router, Server, RefreshCw, Terminal,
  CheckCircle, AlertCircle, Zap, Network, Eye, ChevronDown,
  TrendingUp, BarChart2, ArrowLeft
} from 'lucide-react';
import { authFetch } from '../utils/api';
import { showSuccess, showError, showInfo, showLoading, dismissToast } from '../services/toast';

const MerakiDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [commandMode, setCommandMode] = useState('config'); // 'config' | 'network' | 'security' | 'monitoring'
  const [searchQuery, setSearchQuery] = useState('');

  const theme = {
    bg: isDark ? '#0a0a0a' : '#f9fafb',
    bgSecondary: isDark ? '#111' : '#fff',
    bgTertiary: isDark ? '#1a1a1a' : '#f3f4f6',
    text: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#1f2937' : '#e5e7eb',
    borderLight: isDark ? '#374151' : '#d1d5db',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    shadow: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'
  };

  const buttonStyle = {
    padding: '6px 10px',
    background: 'transparent',
    color: theme.textSecondary,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    fontSize: '13px'
  };

  // Load Meraki devices
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/meraki/devices');
      const data = await res.json();
      setDevices(data || []);
    } catch (error) {
      showError('Failed to load Meraki devices');
      console.error('Load devices error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = devices.filter(device =>
    device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.serial?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'wireless': return Wifi;
      case 'switch': return Network;
      case 'appliance': return Shield;
      case 'camera': return Eye;
      default: return Router;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return theme.success;
      case 'offline': return theme.danger;
      case 'alerting': return theme.warning;
      default: return theme.textMuted;
    }
  };

  return (
    <div style={{
      height: '100vh',
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: theme.bgSecondary,
        borderBottom: `1px solid ${theme.border}`,
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: `0 2px 8px ${theme.shadow}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/dashboard/grid')}
            style={{
              ...buttonStyle,
              background: theme.bgTertiary,
              padding: '6px 10px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img 
              src="/icons/meraki/logo.jpg"
              alt="Meraki"
              style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
            />
            Meraki Management
          </h1>
          <div style={{ fontSize: '12px', color: theme.textSecondary }}>
            {devices.length} devices
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>{user.email}</span>
          <button style={buttonStyle} onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button style={buttonStyle} onClick={onLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        background: theme.bgSecondary,
        borderBottom: `1px solid ${theme.border}`,
        padding: '8px 20px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '400px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }} />
          <input
            type="text"
            placeholder="Search devices by name, serial, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              background: theme.bgTertiary,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              color: theme.text,
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          {[
            { key: 'config', label: 'Configuration', icon: Settings },
            { key: 'network', label: 'Network', icon: Network },
            { key: 'security', label: 'Security', icon: Shield },
            { key: 'monitoring', label: 'Monitoring', icon: Activity }
          ].map(mode => {
            const Icon = mode.icon;
            const isActive = commandMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => setCommandMode(mode.key)}
                style={{
                  padding: '5px 12px',
                  background: isActive ? theme.primary : 'transparent',
                  color: isActive ? '#fff' : theme.text,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                <Icon size={14} />
                {mode.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={loadDevices}
          style={{
            ...buttonStyle,
            background: theme.primary,
            color: '#fff'
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: theme.textSecondary }}>
            Loading devices...
          </div>
        ) : devices.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            background: theme.bgSecondary,
            borderRadius: '8px',
            border: `1px solid ${theme.border}`
          }}>
            <img 
              src="/icons/meraki/logo.jpg"
              alt="Meraki"
              style={{ width: '64px', height: '64px', borderRadius: '8px', marginBottom: '16px', opacity: 0.6, objectFit: 'cover' }}
            />
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>No Meraki Devices Found</h3>
            <p style={{ margin: 0, fontSize: '14px', color: theme.textSecondary }}>
              Configure your Meraki API key in Settings to get started
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}>
            {filteredDevices.map(device => {
              const DeviceIcon = getDeviceIcon(device.type);
              const statusColor = getStatusColor(device.status);

              return (
                <div
                  key={device.serial}
                  onClick={() => setSelectedDevice(device)}
                  style={{
                    background: theme.bgSecondary,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    ':hover': { borderColor: theme.primary }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.primary}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = theme.border}
                >
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <DeviceIcon size={20} color={theme.primary} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{device.name || 'Unnamed Device'}</div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>{device.model}</div>
                      </div>
                    </div>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: statusColor,
                      boxShadow: `0 0 8px ${statusColor}`
                    }} />
                  </div>

                  <div style={{ fontSize: '12px', color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Serial: {device.serial}</div>
                    {device.mac && <div>MAC: {device.mac}</div>}
                    {device.lanIp && <div>IP: {device.lanIp}</div>}
                    {device.networkId && <div>Network: {device.networkId}</div>}
                  </div>

                  {device.tags && device.tags.length > 0 && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {device.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            padding: '2px 8px',
                            background: theme.bgTertiary,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: theme.textSecondary
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Command Panel (when device selected) */}
      {selectedDevice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}
        onClick={() => setSelectedDevice(null)}
        >
          <div 
            style={{
              background: theme.bgSecondary,
              borderRadius: '12px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src="/icons/meraki/logo.jpg"
                  alt="Meraki"
                  style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                />
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                    {selectedDevice.name || 'Unnamed Device'}
                  </h2>
                  <div style={{ fontSize: '13px', color: theme.textSecondary }}>
                    {selectedDevice.model} • {selectedDevice.serial}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                style={{
                  ...buttonStyle,
                  background: theme.bgTertiary,
                  padding: '8px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Command Modes */}
            <div style={{ padding: '20px' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '12px',
                marginBottom: '20px'
              }}>
                {[
                  { key: 'config', label: 'Configuration', icon: Settings, desc: 'Device settings and configuration' },
                  { key: 'network', label: 'Network', icon: Network, desc: 'Network settings and VLANs' },
                  { key: 'security', label: 'Security', icon: Shield, desc: 'Firewall rules and policies' },
                  { key: 'monitoring', label: 'Monitoring', icon: Activity, desc: 'Device health and metrics' }
                ].map(mode => {
                  const Icon = mode.icon;
                  const isActive = commandMode === mode.key;
                  return (
                    <button
                      key={mode.key}
                      onClick={() => setCommandMode(mode.key)}
                      style={{
                        padding: '16px',
                        background: isActive ? theme.primary : theme.bgTertiary,
                        color: isActive ? '#fff' : theme.text,
                        border: `1px solid ${isActive ? theme.primary : theme.border}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'start',
                        gap: '8px',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Icon size={20} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{mode.label}</div>
                        <div style={{ fontSize: '12px', opacity: 0.8 }}>{mode.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Command Content */}
              <div style={{
                background: theme.bgTertiary,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                padding: '20px',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
                  {commandMode === 'config' && 'Device Configuration'}
                  {commandMode === 'network' && 'Network Settings'}
                  {commandMode === 'security' && 'Security & Firewall'}
                  {commandMode === 'monitoring' && 'Device Monitoring'}
                </h3>

                {commandMode === 'config' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Zap size={14} />
                        Reboot Device
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <RefreshCw size={14} />
                        Update Firmware
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Settings size={14} />
                        Change Name
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Terminal size={14} />
                        Set Tags
                      </button>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: theme.textSecondary }}>
                      <div style={{ marginBottom: '8px', fontWeight: 600 }}>Quick Actions:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px' }}>
                        <div>• Enable/disable device</div>
                        <div>• Update device name and location</div>
                        <div>• Manage device tags and notes</div>
                        <div>• LED indicator control</div>
                        <div>• Factory reset (admin only)</div>
                      </div>
                    </div>
                  </div>
                )}

                {commandMode === 'network' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Network size={14} />
                        Configure VLANs
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Router size={14} />
                        Port Settings
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Server size={14} />
                        DHCP Settings
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Wifi size={14} />
                        Wireless Config
                      </button>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: theme.textSecondary }}>
                      <div style={{ marginBottom: '8px', fontWeight: 600 }}>Network Management:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px' }}>
                        <div>• Create/modify VLANs and subnets</div>
                        <div>• Configure static routes and routing protocols</div>
                        <div>• Port forwarding and NAT rules</div>
                        <div>• Wireless SSID configuration</div>
                        <div>• Client isolation and bandwidth limits</div>
                      </div>
                    </div>
                  </div>
                )}

                {commandMode === 'security' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Shield size={14} />
                        Firewall Rules
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <AlertCircle size={14} />
                        Content Filtering
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Eye size={14} />
                        Intrusion Detection
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <CheckCircle size={14} />
                        Threat Protection
                      </button>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: theme.textSecondary }}>
                      <div style={{ marginBottom: '8px', fontWeight: 600 }}>Security Features:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px' }}>
                        <div>• Layer 3 and Layer 7 firewall rules</div>
                        <div>• Intrusion detection and prevention (IDS/IPS)</div>
                        <div>• Content filtering and URL blocking</div>
                        <div>• Advanced malware protection (AMP)</div>
                        <div>• VPN configuration (site-to-site, client VPN)</div>
                      </div>
                    </div>
                  </div>
                )}

                {commandMode === 'monitoring' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Activity size={14} />
                        Device Health
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <TrendingUp size={14} />
                        Bandwidth Usage
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <Wifi size={14} />
                        Client Connections
                      </button>
                      <button style={{ ...buttonStyle, background: theme.bgSecondary, justifyContent: 'center', padding: '12px' }}>
                        <BarChart2 size={14} />
                        Performance Metrics
                      </button>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: theme.textSecondary }}>
                      <div style={{ marginBottom: '8px', fontWeight: 600 }}>Monitoring Capabilities:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px' }}>
                        <div>• Real-time bandwidth and latency monitoring</div>
                        <div>• Connected client tracking and statistics</div>
                        <div>• Port utilization and throughput graphs</div>
                        <div>• Uptime monitoring and historical data</div>
                        <div>• Event logs and alert notifications</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerakiDashboard;

