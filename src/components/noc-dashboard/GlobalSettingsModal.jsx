import React, { useState, useRef, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Palette,
  Bell,
  Database,
  Users,
  Bug,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Check,
  X,
  LogOut,
  Shield,
  Activity,
  FileText,
  Webhook,
  AlertTriangle,
  Speaker,
  Clock,
  Timer,
  Save
} from 'lucide-react';
import { authFetch } from '../../utils/api';
import { notificationSounds } from '../../utils/sound';
import {
  showSuccess,
  showError,
  showLoading,
  dismissToast,
  notifyDataExported,
  notifyDataImported,
  notifyCacheCleared,
  notifyConnectionSuccess,
  notifyConnectionFailed
} from '../../services/toast';
import { ConfirmModal } from './modals';

const GlobalSettingsModal = ({ 
  isOpen, 
  onClose, 
  theme, 
  isDark, 
  setIsDark, 
  sites, 
  metricsData, 
  user, 
  onDeleteAllSites, 
  onSitesImported, 
  refreshInterval, 
  onRefreshIntervalChange 
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const saved = localStorage.getItem('noc-sounds-enabled');
    return saved === null ? true : saved === 'true';
  });
  const [soundVolume, setSoundVolumeState] = useState(() => {
    const saved = localStorage.getItem('noc-sound-volume');
    return saved ? parseFloat(saved) : 0.3;
  });

  // Data Management State
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const fileInputRef = useRef(null);

  // Users State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', email: '', role: 'viewer', password: '' });
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(null);

  // Notification State
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('noc-notification-settings');
    return saved ? JSON.parse(saved) : {
      emailNotifications: false,
      emailAddress: '',
      desktopNotifications: true,
      alertThresholds: {
        latency: 200,
        packetLoss: 5,
        cpu: 90,
        memory: 90
      }
    };
  });
  const [webhooks, setWebhooks] = useState(() => {
    const saved = localStorage.getItem('noc-webhooks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  // Debug State
  const [debugLogs, setDebugLogs] = useState([]);

  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    sessionTimeoutMinutes: 0,
    dataRetentionDays: 30,
    maxSitesPerUser: 100,
    enableRegistration: false,
    maintenanceMode: false
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // --- Effects ---

  useEffect(() => {
    if (isOpen && activeTab === 'users') {
      fetchUsers();
    }
    if (isOpen && activeTab === 'session') {
      fetchSystemSettings();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    localStorage.setItem('noc-notification-settings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  useEffect(() => {
    localStorage.setItem('noc-webhooks', JSON.stringify(webhooks));
  }, [webhooks]);

  // --- Handlers ---

  const handleSoundEnabledChange = (enabled) => {
    setSoundEnabledState(enabled);
    localStorage.setItem('noc-sounds-enabled', enabled);
    if (enabled) notificationSounds.playInfo();
  };

  const handleSoundVolumeChange = (volume) => {
    const newVolume = parseFloat(volume);
    setSoundVolumeState(newVolume);
    localStorage.setItem('noc-sound-volume', newVolume);
    if (soundEnabled) notificationSounds.playInfo(); // Feedback
  };

  // Data Handlers
  const handleExportSites = async () => {
    setIsExporting(true);
    const loadingToastId = showLoading('Exporting sites...');
    try {
      const res = await authFetch('/api/sites/export');
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const payload = await res.json();
      const exportPayload = Array.isArray(payload) ? { sites: payload } : (payload || { sites: [] });
      
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nocturnal-sites-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      dismissToast(loadingToastId);
      notifyDataExported(exportPayload.sites?.length || 0);
    } catch (err) {
      console.error('Export sites failed:', err);
      dismissToast(loadingToastId);
      showError(err.message || 'Failed to export sites');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const loadingToastId = showLoading('Importing sites...');
    
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON file');
      }

      const sitesToImport = Array.isArray(data) ? data : (data.sites || []);
      if (!Array.isArray(sitesToImport)) throw new Error('Invalid file format: missing sites array');

      const res = await authFetch('/api/sites/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites: sitesToImport })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Import failed');
      }

      const result = await res.json();
      dismissToast(loadingToastId);
      notifyDataImported(result.count || sitesToImport.length);
      if (onSitesImported) onSitesImported();
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
      dismissToast(loadingToastId);
      showError(err.message || 'Failed to import sites');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    notifyCacheCleared();
    setTimeout(() => location.reload(), 500);
  };

  // User Handlers
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await authFetch('/api/users');
      if (res.ok) setUsers(await res.json());
      else showError('Failed to load users');
    } catch (err) {
      console.error(err);
      showError('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData)
      });
      if (res.ok) {
        showSuccess('User created successfully');
        setNewUserData({ username: '', email: '', role: 'viewer', password: '' });
        fetchUsers();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to create user');
      }
    } catch (err) {
      showError('Failed to create user');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const res = await authFetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('User deleted');
        fetchUsers();
        setShowDeleteUserConfirm(null);
      } else {
        showError('Failed to delete user');
      }
    } catch (err) {
      showError('Failed to delete user');
    }
  };

  // Notification Handlers
  const handleAddWebhook = () => {
    if (!newWebhookUrl) return;
    setWebhooks([...webhooks, { id: Date.now(), url: newWebhookUrl, events: ['alert'] }]);
    setNewWebhookUrl('');
    showSuccess('Webhook added');
  };

  const handleRemoveWebhook = (id) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
  };

  // System Settings Handlers
  const fetchSystemSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await authFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings)
      });
      if (res.ok) {
        showSuccess('Session settings saved');
        // Store locally for immediate use
        localStorage.setItem('noc-session-timeout', systemSettings.sessionTimeoutMinutes);
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to save settings');
      }
    } catch (err) {
      showError('Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Debug Handlers
  const testBackendConnection = async () => {
    const toastId = showLoading('Testing connection...');
    try {
      const res = await authFetch('/api/auth/me');
      if (res.ok) {
        dismissToast(toastId);
        notifyConnectionSuccess();
        setDebugLogs(prev => [{ time: new Date().toISOString(), type: 'SUCCESS', msg: 'Connection OK' }, ...prev]);
      } else {
        throw new Error('Auth check failed');
      }
    } catch (err) {
      dismissToast(toastId);
      notifyConnectionFailed();
      setDebugLogs(prev => [{ time: new Date().toISOString(), type: 'ERROR', msg: err.message }, ...prev]);
    }
  };

  if (!isOpen) return null;

  // --- Render Helpers ---
  
  const renderTabButton = (id, icon, label) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', padding: '12px 16px',
          border: 'none', background: isActive ? theme.bgSecondary : 'transparent',
          color: isActive ? theme.primary : theme.textSecondary,
          borderLeft: isActive ? `3px solid ${theme.primary}` : '3px solid transparent',
          cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  const SectionHeader = ({ title, description }) => (
    <div style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: `1px solid ${theme.border}` }}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: theme.text }}>{title}</h2>
      {description && <p style={{ margin: 0, color: theme.textSecondary, fontSize: '14px' }}>{description}</p>}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        width: '900px', height: '700px',
        background: theme.bg, borderRadius: '12px',
        display: 'flex', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: `1px solid ${theme.border}`
      }}>
        {/* Sidebar */}
        <div style={{
          width: '240px', background: theme.card,
          borderRight: `1px solid ${theme.border}`,
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '24px', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.text, fontWeight: 'bold', fontSize: '18px' }}>
              <SettingsIcon size={24} color={theme.primary} />
              <span>Settings</span>
            </div>
          </div>
          <div style={{ flex: 1, paddingTop: '12px' }}>
            {renderTabButton('general', <Monitor size={18} />, 'General')}
            {renderTabButton('session', <Timer size={18} />, 'Session & Timeout')}
            {renderTabButton('notifications', <Bell size={18} />, 'Notifications')}
            {renderTabButton('data', <Database size={18} />, 'Data & Storage')}
            {renderTabButton('users', <Users size={18} />, 'Users & Access')}
            {renderTabButton('debug', <Bug size={18} />, 'System & Debug')}
          </div>
          <div style={{ padding: '16px', borderTop: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', background: theme.bgSecondary }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: theme.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : 'User'}
                </div>
                <div style={{ fontSize: '11px', color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: theme.bg }}>
          <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
            
            {activeTab === 'general' && (
              <>
                <SectionHeader title="General Settings" description="Customize your dashboard experience" />
                
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', color: theme.text, marginBottom: '12px' }}>Appearance</h3>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                      onClick={() => setIsDark(false)}
                      style={{
                        flex: 1, padding: '16px', borderRadius: '8px',
                        border: `2px solid ${!isDark ? theme.primary : theme.border}`,
                        background: theme.card, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                      }}
                    >
                      <Sun size={24} color={!isDark ? theme.primary : theme.textSecondary} />
                      <span style={{ color: theme.text }}>Light Mode</span>
                    </button>
                    <button
                      onClick={() => setIsDark(true)}
                      style={{
                        flex: 1, padding: '16px', borderRadius: '8px',
                        border: `2px solid ${isDark ? theme.primary : theme.border}`,
                        background: theme.card, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
                      }}
                    >
                      <Moon size={24} color={isDark ? theme.primary : theme.textSecondary} />
                      <span style={{ color: theme.text }}>Dark Mode</span>
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', color: theme.text, marginBottom: '12px' }}>Dashboard</h3>
                  <div style={{ background: theme.card, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: theme.text, fontSize: '14px' }}>
                        Data Refresh Interval
                      </label>
                      <select
                        value={refreshInterval}
                        onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
                        style={{
                          width: '100%', padding: '10px', borderRadius: '6px',
                          border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text
                        }}
                      >
                        <option value="5000">5 Seconds (Real-time)</option>
                        <option value="15000">15 Seconds</option>
                        <option value="30000">30 Seconds</option>
                        <option value="60000">1 Minute</option>
                        <option value="300000">5 Minutes</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '16px', color: theme.text, marginBottom: '12px' }}>Sound</h3>
                  <div style={{ background: theme.card, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {soundEnabled ? <Volume2 size={20} color={theme.primary} /> : <VolumeX size={20} color={theme.textSecondary} />}
                        <span style={{ color: theme.text }}>Enable Sound Effects</span>
                      </div>
                      <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                        <input 
                          type="checkbox" 
                          checked={soundEnabled}
                          onChange={(e) => handleSoundEnabledChange(e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: soundEnabled ? theme.primary : theme.border, transition: '.4s', borderRadius: '34px'
                        }}>
                          <span style={{
                            position: 'absolute', content: "", height: '16px', width: '16px',
                            left: soundEnabled ? '20px' : '4px', bottom: '4px',
                            backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                          }} />
                        </span>
                      </label>
                    </div>
                    {soundEnabled && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: theme.text, fontSize: '13px' }}>Volume</label>
                        <input
                          type="range" min="0" max="1" step="0.1"
                          value={soundVolume}
                          onChange={(e) => handleSoundVolumeChange(e.target.value)}
                          style={{ width: '100%', cursor: 'pointer' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'session' && (
              <>
                <SectionHeader title="Session & Timeout Settings" description="Configure session duration for NOC displays" />
                
                {settingsLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: theme.textSecondary }}>
                    <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
                    <p>Loading settings...</p>
                  </div>
                ) : (
                  <>
                    <div style={{ background: theme.card, padding: '24px', borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <Timer size={24} color={theme.primary} />
                        <div>
                          <h4 style={{ margin: 0, color: theme.text }}>Session Timeout</h4>
                          <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary }}>How long until users are automatically logged out</p>
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: theme.text, fontSize: '14px', fontWeight: 500 }}>
                          Timeout Duration
                        </label>
                        <select
                          value={systemSettings.sessionTimeoutMinutes}
                          onChange={(e) => setSystemSettings({...systemSettings, sessionTimeoutMinutes: parseInt(e.target.value)})}
                          style={{
                            width: '100%', padding: '12px', borderRadius: '6px',
                            border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text,
                            fontSize: '14px'
                          }}
                        >
                          <option value="0">Never (Infinite Session) - Recommended for NOC</option>
                          <option value="60">1 Hour</option>
                          <option value="240">4 Hours</option>
                          <option value="480">8 Hours</option>
                          <option value="720">12 Hours</option>
                          <option value="1440">24 Hours</option>
                          <option value="10080">7 Days</option>
                          <option value="43200">30 Days</option>
                        </select>
                      </div>

                      <div style={{ 
                        padding: '16px', 
                        borderRadius: '8px', 
                        background: `${theme.success}15`, 
                        border: `1px solid ${theme.success}30`,
                        marginBottom: '20px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <Check size={20} color={theme.success} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <h5 style={{ margin: '0 0 4px 0', color: theme.success, fontSize: '14px' }}>NOC Display Mode</h5>
                            <p style={{ margin: 0, color: theme.text, fontSize: '13px' }}>
                              With "Never" timeout, this dashboard can run continuously for weeks or months on NOC displays. 
                              The system automatically refreshes authentication tokens in the background.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: theme.card, padding: '24px', borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <Database size={24} color={theme.primary} />
                        <div>
                          <h4 style={{ margin: 0, color: theme.text }}>Data Retention</h4>
                          <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary }}>How long to keep monitoring history</p>
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: theme.text, fontSize: '14px', fontWeight: 500 }}>
                          Keep Data For
                        </label>
                        <select
                          value={systemSettings.dataRetentionDays}
                          onChange={(e) => setSystemSettings({...systemSettings, dataRetentionDays: parseInt(e.target.value)})}
                          style={{
                            width: '100%', padding: '12px', borderRadius: '6px',
                            border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text,
                            fontSize: '14px'
                          }}
                        >
                          <option value="7">7 Days</option>
                          <option value="14">14 Days</option>
                          <option value="30">30 Days</option>
                          <option value="60">60 Days</option>
                          <option value="90">90 Days</option>
                          <option value="180">180 Days</option>
                          <option value="365">1 Year</option>
                          <option value="0">Forever (No Cleanup)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleSaveSystemSettings}
                        disabled={settingsSaving}
                        style={{
                          padding: '12px 24px',
                          background: theme.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: settingsSaving ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          opacity: settingsSaving ? 0.7 : 1
                        }}
                      >
                        {settingsSaving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                        Save Settings
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === 'notifications' && (
              <>
                <SectionHeader title="Notification Settings" description="Manage how you receive alerts" />
                <div style={{ background: theme.card, padding: '24px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Webhook size={24} color={theme.primary} />
                    <div>
                      <h4 style={{ margin: 0, color: theme.text }}>Webhooks</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary }}>Send alerts to external services (Slack, Discord, etc)</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input 
                      type="text" 
                      placeholder="https://hooks.slack.com/services/..." 
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      style={{ flex: 1, padding: '10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                    />
                    <button onClick={handleAddWebhook} style={{ background: theme.primary, color: '#fff', border: 'none', borderRadius: '6px', padding: '0 16px', cursor: 'pointer' }}>
                      Add
                    </button>
                  </div>
                  {webhooks.map(webhook => (
                    <div key={webhook.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: theme.bg, borderRadius: '6px', marginBottom: '8px' }}>
                      <span style={{ color: theme.text, fontSize: '13px', fontFamily: 'monospace' }}>{webhook.url}</span>
                      <button onClick={() => handleRemoveWebhook(webhook.id)} style={{ background: 'transparent', border: 'none', color: theme.danger, cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'data' && (
              <>
                <SectionHeader title="Data Management" description="Import, export, and manage your data" />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <div style={{ background: theme.card, padding: '24px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <Download size={32} color={theme.primary} style={{ marginBottom: '16px' }} />
                    <h3 style={{ margin: '0 0 8px 0', color: theme.text }}>Export Data</h3>
                    <p style={{ margin: '0 0 16px 0', color: theme.textSecondary, fontSize: '13px' }}>Download all site configurations and history.</p>
                    <button 
                      onClick={handleExportSites} 
                      disabled={isExporting}
                      style={{ width: '100%', padding: '10px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.text, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      {isExporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />} Export JSON
                    </button>
                  </div>

                  <div style={{ background: theme.card, padding: '24px', borderRadius: '8px', border: `1px solid ${theme.border}` }}>
                    <Upload size={32} color={theme.primary} style={{ marginBottom: '16px' }} />
                    <h3 style={{ margin: '0 0 8px 0', color: theme.text }}>Import Data</h3>
                    <p style={{ margin: '0 0 16px 0', color: theme.textSecondary, fontSize: '13px' }}>Restore sites from a JSON backup file.</p>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept=".json"
                      onChange={handleImportFileChange}
                    />
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      disabled={isImporting}
                      style={{ width: '100%', padding: '10px', background: theme.bgSecondary, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.text, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                      {isImporting ? <RefreshCw size={16} className="spin" /> : <Upload size={16} />} Select File
                    </button>
                  </div>
                </div>

                <div style={{ padding: '20px', borderRadius: '8px', border: `1px solid ${theme.danger}40`, background: `${theme.danger}10` }}>
                  <h3 style={{ margin: '0 0 12px 0', color: theme.danger }}>Danger Zone</h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => setShowDeleteAllConfirm(true)}
                      style={{ padding: '10px 16px', background: theme.danger, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Trash2 size={16} /> Delete All Sites
                    </button>
                    <button 
                      onClick={handleClearCache}
                      style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${theme.danger}`, color: theme.danger, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <RefreshCw size={16} /> Clear Local Cache
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'users' && (
              <>
                <SectionHeader title="User Management" description="Manage access to the dashboard" />
                
                {/* Create User */}
                <div style={{ background: theme.card, padding: '20px', borderRadius: '8px', border: `1px solid ${theme.border}`, marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: theme.text }}>Create New User</h3>
                  <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: theme.textSecondary }}>Email</label>
                      <input 
                        type="email" required value={newUserData.email}
                        onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: theme.textSecondary }}>Password</label>
                      <input 
                        type="password" required value={newUserData.password}
                        onChange={e => setNewUserData({...newUserData, password: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: theme.textSecondary }}>Role</label>
                      <select 
                        value={newUserData.role}
                        onChange={e => setNewUserData({...newUserData, role: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <button type="submit" style={{ padding: '8px 16px', background: theme.primary, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', height: '35px' }}>
                      Create User
                    </button>
                  </form>
                </div>

                {/* User List */}
                <div style={{ background: theme.card, borderRadius: '8px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: theme.bgSecondary }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', color: theme.textSecondary, fontSize: '12px', fontWeight: 600 }}>USER</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: theme.textSecondary, fontSize: '12px', fontWeight: 600 }}>ROLE</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: theme.textSecondary, fontSize: '12px', fontWeight: 600 }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '12px', color: theme.text }}>
                            <div style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</div>
                            <div style={{ fontSize: '12px', color: theme.textSecondary }}>{u.email}</div>
                          </td>
                          <td style={{ padding: '12px', color: theme.text }}>
                            <span style={{ 
                              padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                              background: u.role === 'admin' ? `${theme.primary}20` : theme.bgSecondary,
                              color: u.role === 'admin' ? theme.primary : theme.textSecondary
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            {u.email !== user?.email && (
                              <button 
                                onClick={() => setShowDeleteUserConfirm(u)}
                                style={{ background: 'transparent', border: 'none', color: theme.danger, cursor: 'pointer' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {usersLoading && <div style={{ padding: '20px', textAlign: 'center', color: theme.textSecondary }}>Loading users...</div>}
                </div>
              </>
            )}

            {activeTab === 'debug' && (
              <>
                <SectionHeader title="System Debug" description="Diagnostics and testing tools" />
                
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <button 
                    onClick={testBackendConnection}
                    style={{ padding: '10px 16px', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.text, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
                  >
                    <Activity size={16} /> Test Connectivity
                  </button>
                  <button 
                    onClick={() => showSuccess('Test toast notification')}
                    style={{ padding: '10px 16px', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.text, cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
                  >
                    <Bell size={16} /> Test Notification
                  </button>
                </div>

                <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '16px', height: '300px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
                  {debugLogs.length === 0 ? (
                    <div style={{ color: '#666', textAlign: 'center', marginTop: '100px' }}>No debug logs available</div>
                  ) : (
                    debugLogs.map((log, i) => (
                      <div key={i} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                        <span style={{ color: '#888' }}>[{log.time.split('T')[1].split('.')[0]}]</span>{' '}
                        <span style={{ color: log.type === 'ERROR' ? '#ff4444' : '#44ff44', fontWeight: 'bold' }}>{log.type}</span>:{' '}
                        <span style={{ color: '#ddd' }}>{log.msg}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

          </div>

          {/* Footer */}
          <div style={{ padding: '16px 32px', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={onClose}
              style={{ padding: '10px 24px', background: theme.primary, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
      
      {/* Confirms */}
      {showDeleteAllConfirm && (
        <ConfirmModal 
          title="Delete ALL Sites?"
          message="This action cannot be undone. All sites and their history will be permanently erased."
          onConfirm={() => {
            onDeleteAllSites();
            setShowDeleteAllConfirm(false);
          }}
          onCancel={() => setShowDeleteAllConfirm(false)}
          theme={theme}
        />
      )}

      {showDeleteUserConfirm && (
        <ConfirmModal 
          title="Delete User?"
          message={`Are you sure you want to delete ${showDeleteUserConfirm.email}?`}
          onConfirm={() => handleDeleteUser(showDeleteUserConfirm.id)}
          onCancel={() => setShowDeleteUserConfirm(null)}
          theme={theme}
        />
      )}
    </div>
  );
};

export default GlobalSettingsModal;

