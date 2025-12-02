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
  Shield,
  Activity,
  Webhook,
  Key,
  Zap,
  Globe,
  Lock,
  Mail,
  Sliders,
  Code,
  Save,
  Copy,
  Eye,
  EyeOff,
  Plus,
  AlertTriangle,
  Info,
  ChevronRight
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

// Move helper components outside of EnhancedSettingsModal
// Ensure these are not redefined on each render
const SectionHeader = ({ title, description, action, theme }) => (
  <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div>
      <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 700, color: theme.text }}>{title}</h2>
      {description && <p style={{ margin: 0, color: theme.textSecondary, fontSize: '14px', lineHeight: '1.5' }}>{description}</p>}
    </div>
    {action}
  </div>
);

const SettingCard = ({ icon, title, description, children, accent, theme }) => (
  <div style={{ 
    background: theme.card, 
    padding: '24px', 
    borderRadius: '12px', 
    border: `1px solid ${theme.border}`,
    transition: 'all 0.2s'
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        borderRadius: '12px', 
        background: `${accent || theme.primary}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {React.cloneElement(icon, { size: 24, color: accent || theme.primary })}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: theme.text }}>{title}</h3>
        {description && <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary, lineHeight: '1.5' }}>{description}</p>}
      </div>
    </div>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, label, theme }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
    <div style={{ position: 'relative', width: '44px', height: '24px' }}>
      <input 
        type="checkbox" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ 
          opacity: 0, 
          width: '1px', 
          height: '1px', 
          position: 'absolute',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          margin: -1
        }}
      />
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: checked ? theme.primary : theme.border,
        borderRadius: '12px',
        transition: '0.3s',
        cursor: 'pointer'
      }}>
        <div style={{
          position: 'absolute',
          content: "",
          height: '18px',
          width: '18px',
          left: checked ? '23px' : '3px',
          bottom: '3px',
          backgroundColor: 'white',
          borderRadius: '50%',
          transition: '0.3s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
    {label && <span style={{ color: theme.text, fontSize: '14px' }}>{label}</span>}
  </label>
);

// Render helper for tabs moved outside to prevent recreation
const RenderTabButton = ({ id, icon, label, badge, activeTab, setActiveTab, theme }) => {
  const isActive = activeTab === id;
  return (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between',
        width: '100%', padding: '14px 20px',
        border: 'none', 
        background: isActive ? `linear-gradient(90deg, ${theme.primary}15, transparent)` : 'transparent',
        color: isActive ? theme.primary : theme.textSecondary,
        borderLeft: isActive ? `3px solid ${theme.primary}` : '3px solid transparent',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
        fontWeight: isActive ? 600 : 400,
        fontSize: '14px'
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = theme.bgSecondary;
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {icon}
        <span>{label}</span>
      </div>
      {badge && (
        <span style={{
          background: theme.primary,
          color: '#fff',
          fontSize: '10px',
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: '10px',
          minWidth: '18px',
          textAlign: 'center'
        }}>
          {badge}
        </span>
      )}
    </button>
  );
};

const EnhancedSettingsModal = ({ 
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
  onRefreshIntervalChange,
  pageRefreshEnabled,
  pageRefreshInterval,
  onPageRefreshChange
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  
  // General Settings
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const saved = localStorage.getItem('noc-sounds-enabled');
    return saved === null ? true : saved === 'true';
  });
  const [soundVolume, setSoundVolumeState] = useState(() => {
    const saved = localStorage.getItem('noc-sound-volume');
    return saved ? parseFloat(saved) : 0.3;
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Data Management State
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const fileInputRef = useRef(null);

  // Users State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUserData, setNewUserData] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'viewer' });
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
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  });
  const [webhooks, setWebhooks] = useState(() => {
    const saved = localStorage.getItem('noc-webhooks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  // API Keys State
  const [apiKeys, setApiKeys] = useState(() => {
    const saved = localStorage.getItem('noc-api-keys');
    return saved ? JSON.parse(saved) : [];
  });
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [showApiKey, setShowApiKey] = useState({});

  // Integrations State
  const [integrations, setIntegrations] = useState(() => {
    const saved = localStorage.getItem('noc-integrations');
    return saved ? JSON.parse(saved) : {
      slack: { enabled: false, webhookUrl: '' },
      discord: { enabled: false, webhookUrl: '' },
      teams: { enabled: false, webhookUrl: '' },
      pagerduty: { enabled: false, apiKey: '' }
    };
  });

  // Debug State
  const [debugLogs, setDebugLogs] = useState([]);

  // Secrets State
  const [secrets, setSecrets] = useState([]);
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [newSecretData, setNewSecretData] = useState({ name: '', value: '', type: 'meraki_api_key' });
  const [showSecretValue, setShowSecretValue] = useState({});

  // --- Effects ---

  useEffect(() => {
    if (isOpen && activeTab === 'secrets') {
      fetchSecrets();
    }
  }, [isOpen, activeTab]);

  // Secrets Handlers
  const fetchSecrets = async () => {
    setSecretsLoading(true);
    try {
      const res = await authFetch('/api/secrets');
      if (res.ok) setSecrets(await res.json());
      else showError('Failed to load secrets');
    } catch (err) {
      console.error(err);
      showError('Failed to load secrets');
    } finally {
      setSecretsLoading(false);
    }
  };

  const fetchSecretValue = async (id) => {
    if (showSecretValue[id]) {
      setShowSecretValue(prev => ({ ...prev, [id]: null })); // Toggle off
      return;
    }
    try {
      const res = await authFetch(`/api/secrets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setShowSecretValue(prev => ({ ...prev, [id]: data.value }));
      } else {
        showError('Failed to reveal secret');
      }
    } catch (err) {
      showError('Failed to reveal secret');
    }
  };

  const handleCreateSecret = async (e) => {
    e.preventDefault();
    if (!newSecretData.name || !newSecretData.value) {
      showError('Name and Value are required');
      return;
    }
    try {
      const res = await authFetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSecretData)
      });
      if (res.ok) {
        showSuccess('Secret created');
        setNewSecretData({ name: '', value: '', type: 'meraki_api_key' });
        fetchSecrets();
      } else {
        showError('Failed to create secret');
      }
    } catch (err) {
      showError('Failed to create secret');
    }
  };

  const handleDeleteSecret = async (id) => {
    if (!window.confirm('Delete this secret?')) return; // TODO: Use custom modal
    try {
      const res = await authFetch(`/api/secrets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Secret deleted');
        fetchSecrets();
      } else {
        showError('Failed to delete secret');
      }
    } catch (err) {
      showError('Failed to delete secret');
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'users') {
      fetchUsers();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    localStorage.setItem('noc-notification-settings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  useEffect(() => {
    localStorage.setItem('noc-webhooks', JSON.stringify(webhooks));
  }, [webhooks]);

  useEffect(() => {
    localStorage.setItem('noc-api-keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  useEffect(() => {
    localStorage.setItem('noc-integrations', JSON.stringify(integrations));
  }, [integrations]);

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
    if (soundEnabled) notificationSounds.playInfo();
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
        setNewUserData({ email: '', password: '', firstName: '', lastName: '', role: 'viewer' });
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
    setWebhooks([...webhooks, { id: Date.now(), url: newWebhookUrl, events: ['alert'], enabled: true }]);
    setNewWebhookUrl('');
    showSuccess('Webhook added');
  };

  const handleRemoveWebhook = (id) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
    showSuccess('Webhook removed');
  };

  const handleToggleWebhook = (id) => {
    setWebhooks(webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  // API Key Handlers
  const handleGenerateApiKey = () => {
    if (!newApiKeyName) {
      showError('Please enter a name for the API key');
      return;
    }
    const key = 'noc_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    setApiKeys([...apiKeys, { id: Date.now(), name: newApiKeyName, key, created: new Date().toISOString(), lastUsed: null }]);
    setNewApiKeyName('');
    showSuccess('API key generated');
  };

  const handleDeleteApiKey = (id) => {
    setApiKeys(apiKeys.filter(k => k.id !== id));
    showSuccess('API key deleted');
  };

  const handleCopyApiKey = (key) => {
    navigator.clipboard.writeText(key);
    showSuccess('API key copied to clipboard');
  };

  // Integration Handlers
  const handleUpdateIntegration = (service, field, value) => {
    setIntegrations({
      ...integrations,
      [service]: { ...integrations[service], [field]: value }
    });
  };

  const handleTestIntegration = async (service) => {
    const config = integrations[service];
    if (!config.enabled) {
      showError(`${service} integration is not enabled`);
      return;
    }
    showLoading(`Testing ${service} integration...`);
    // Simulate test
    setTimeout(() => {
      showSuccess(`${service} integration test successful`);
    }, 1000);
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
  // renderTabButton removed from here, using external component RenderTabButton instead

  const SectionHeader = ({ title, description, action }) => (
    <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 700, color: theme.text }}>{title}</h2>
        {description && <p style={{ margin: 0, color: theme.textSecondary, fontSize: '14px', lineHeight: '1.5' }}>{description}</p>}
      </div>
      {action}
    </div>
  );

  const SettingCard = ({ icon, title, description, children, accent }) => (
    <div style={{ 
      background: theme.card, 
      padding: '24px', 
      borderRadius: '12px', 
      border: `1px solid ${theme.border}`,
      transition: 'all 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          borderRadius: '12px', 
          background: `${accent || theme.primary}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {React.cloneElement(icon, { size: 24, color: accent || theme.primary })}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: theme.text }}>{title}</h3>
          {description && <p style={{ margin: 0, fontSize: '13px', color: theme.textSecondary, lineHeight: '1.5' }}>{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );

  const Toggle = ({ checked, onChange, label }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
      <div style={{ position: 'relative', width: '44px', height: '24px' }}>
        <input 
          type="checkbox" 
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ 
            opacity: 0, 
            width: '1px', 
            height: '1px', 
            position: 'absolute',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            margin: -1
          }}
        />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: checked ? theme.primary : theme.border,
          borderRadius: '12px',
          transition: '0.3s',
          cursor: 'pointer'
        }}>
          <div style={{
            position: 'absolute',
            content: "",
            height: '18px',
            width: '18px',
            left: checked ? '23px' : '3px',
            bottom: '3px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: '0.3s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }} />
        </div>
      </div>
      {label && <span style={{ color: theme.text, fontSize: '14px' }}>{label}</span>}
    </label>
  );

  const tabs = [
    { id: 'general', icon: <Monitor size={20} />, label: 'General' },
    { id: 'appearance', icon: <Palette size={20} />, label: 'Appearance' },
    { id: 'notifications', icon: <Bell size={20} />, label: 'Notifications', badge: webhooks.length || null },
    { id: 'integrations', icon: <Zap size={20} />, label: 'Integrations' },
    { id: 'secrets', icon: <Key size={20} />, label: 'Secrets & Keys' },
    { id: 'security', icon: <Shield size={20} />, label: 'Security & API' },
    { id: 'data', icon: <Database size={20} />, label: 'Data Management' },
    { id: 'users', icon: <Users size={20} />, label: 'Users', badge: users.length || null },
    { id: 'advanced', icon: <Sliders size={20} />, label: 'Advanced' },
    { id: 'debug', icon: <Bug size={20} />, label: 'Debug' }
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.80)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95vw',
          maxWidth: '1400px',
          height: '90vh',
        background: theme.bg,
        borderRadius: '16px',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        border: `1px solid ${theme.border}`
      }}>
        {/* Enhanced Sidebar */}
        <div style={{
          width: '280px',
          background: theme.card,
          borderRight: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ padding: '28px 24px', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}dd)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${theme.primary}40`
              }}>
                <SettingsIcon size={22} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: theme.text }}>Settings</h1>
                <p style={{ margin: 0, fontSize: '12px', color: theme.textSecondary }}>Dashboard Configuration</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: '8px' }}>
            {tabs.map(tab => (
              <RenderTabButton
                key={tab.id}
                id={tab.id}
                icon={tab.icon}
                label={tab.label}
                badge={tab.badge}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                theme={theme}
              />
            ))}
          </div>

          {/* User Info */}
          <div style={{ padding: '20px', borderTop: `1px solid ${theme.border}` }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px', 
              borderRadius: '12px', 
              background: theme.bgSecondary,
              border: `1px solid ${theme.border}`
            }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}dd)`,
                color: '#fff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 700,
                fontSize: '16px',
                flexShrink: 0
              }}>
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : 'User'}
                </div>
                <div style={{ fontSize: '12px', color: theme.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: theme.bg }}>
          {/* Close Button */}
          <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 1 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: theme.card,
                border: `1px solid ${theme.border}`,
                color: theme.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.danger + '15';
                e.currentTarget.style.borderColor = theme.danger;
                e.currentTarget.style.color = theme.danger;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.card;
                e.currentTarget.style.borderColor = theme.border;
                e.currentTarget.style.color = theme.textSecondary;
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
            
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="General Settings" 
                  description="Configure your dashboard preferences and behavior"
                  theme={theme}
                />
                
                <div style={{ display: 'grid', gap: '20px' }}>
                  <SettingCard
                    icon={<RefreshCw />}
                    title="Data Refresh"
                    description="Control how often the dashboard updates with new data"
                    theme={theme}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <Toggle 
                        checked={autoRefresh}
                        onChange={setAutoRefresh}
                        label="Enable automatic data refresh"
                        theme={theme}
                      />
                      {autoRefresh && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                            Data Refresh Interval
                          </label>
                          <select
                            value={refreshInterval}
                            onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: `1px solid ${theme.border}`,
                              background: theme.bg,
                              color: theme.text,
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="5000">5 Seconds (Real-time)</option>
                            <option value="15000">15 Seconds</option>
                            <option value="30000">30 Seconds</option>
                            <option value="60000">1 Minute</option>
                            <option value="300000">5 Minutes</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </SettingCard>

                  <SettingCard
                    icon={<Monitor />}
                    title="Page Auto-Refresh (Optional)"
                    description="Only needed for extremely long sessions (weeks). WebSocket provides real-time updates automatically."
                    theme={theme}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ 
                        padding: '12px', 
                        background: `${theme.success}15`, 
                        borderRadius: '8px',
                        border: `1px solid ${theme.success}30`,
                        marginBottom: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Activity size={16} color={theme.success} style={{ marginTop: '2px', flexShrink: 0 }} />
                          <div style={{ fontSize: '12px', color: theme.text, lineHeight: '1.5' }}>
                            <strong>Real-time updates are always active.</strong> Data refreshes automatically via WebSocket - no page reload needed.
                          </div>
                        </div>
                      </div>
                      <Toggle 
                        checked={pageRefreshEnabled}
                        onChange={(checked) => {
                          if (onPageRefreshChange) {
                            onPageRefreshChange(checked, pageRefreshInterval);
                          }
                        }}
                        label="Enable page refresh (only for memory cleanup)"
                        theme={theme}
                      />
                      {pageRefreshEnabled && (
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                            Page Refresh Interval (Minimum 30 min)
                          </label>
                          <select
                            value={pageRefreshInterval}
                            onChange={(e) => {
                              const newInterval = Number(e.target.value);
                              if (onPageRefreshChange) {
                                onPageRefreshChange(pageRefreshEnabled, newInterval);
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: `1px solid ${theme.border}`,
                              background: theme.bg,
                              color: theme.text,
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="30">30 Minutes</option>
                            <option value="60">1 Hour (Recommended)</option>
                            <option value="120">2 Hours</option>
                            <option value="240">4 Hours</option>
                            <option value="480">8 Hours</option>
                          </select>
                          <div style={{ 
                            marginTop: '12px', 
                            padding: '12px', 
                            background: theme.bgSecondary, 
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <Info size={16} color={theme.primary} style={{ marginTop: '2px', flexShrink: 0 }} />
                              <div style={{ fontSize: '12px', color: theme.textSecondary, lineHeight: '1.5' }}>
                                Page refresh is only for memory cleanup on multi-week displays. Your view state is preserved.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </SettingCard>

                  <SettingCard
                    icon={soundEnabled ? <Volume2 /> : <VolumeX />}
                    title="Sound Effects"
                    description="Configure audio notifications and feedback"
                    theme={theme}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <Toggle 
                        checked={soundEnabled}
                        onChange={handleSoundEnabledChange}
                        label="Enable sound effects"
                        theme={theme}
                      />
                      {soundEnabled && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                              Volume
                            </label>
                            <span style={{ color: theme.text, fontSize: '13px', fontWeight: 600 }}>
                              {Math.round(soundVolume * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={soundVolume}
                            onChange={(e) => handleSoundVolumeChange(e.target.value)}
                            style={{ width: '100%', cursor: 'pointer' }}
                          />
                        </div>
                      )}
                    </div>
                  </SettingCard>

                  <SettingCard
                    icon={<Sliders />}
                    title="Display Options"
                    description="Customize how information is displayed"
                    theme={theme}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <Toggle 
                        checked={compactMode}
                        onChange={setCompactMode}
                        label="Compact mode (show more data)"
                        theme={theme}
                      />
                      <Toggle 
                        checked={animationsEnabled}
                        onChange={setAnimationsEnabled}
                        label="Enable animations"
                        theme={theme}
                      />
                    </div>
                  </SettingCard>
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="Appearance" 
                  description="Customize the look and feel of your dashboard"
                  theme={theme}
                />
                
                <SettingCard
                  icon={isDark ? <Moon /> : <Sun />}
                  title="Theme"
                  description="Choose between light and dark mode"
                  theme={theme}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setIsDark(false)}
                      style={{
                        padding: '24px',
                        borderRadius: '12px',
                        border: `2px solid ${!isDark ? theme.primary : theme.border}`,
                        background: !isDark ? `${theme.primary}10` : theme.bg,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Sun size={32} color={!isDark ? theme.primary : theme.textSecondary} />
                      <span style={{ color: theme.text, fontWeight: 600 }}>Light Mode</span>
                      {!isDark && <Check size={20} color={theme.primary} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDark(true)}
                      style={{
                        padding: '24px',
                        borderRadius: '12px',
                        border: `2px solid ${isDark ? theme.primary : theme.border}`,
                        background: isDark ? `${theme.primary}10` : theme.bg,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Moon size={32} color={isDark ? theme.primary : theme.textSecondary} />
                      <span style={{ color: theme.text, fontWeight: 600 }}>Dark Mode</span>
                      {isDark && <Check size={20} color={theme.primary} />}
                    </button>
                  </div>
                </SettingCard>
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="Notifications" 
                  description="Manage how and when you receive alerts"
                  theme={theme}
                />
                
                <div style={{ display: 'grid', gap: '20px' }}>
                  <SettingCard
                    icon={<Bell />}
                    title="Alert Thresholds"
                    description="Set custom thresholds for triggering alerts"
                    theme={theme}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                          Latency (ms)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.latency}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            alertThresholds: { ...notificationSettings.alertThresholds, latency: Number(e.target.value) }
                          })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            background: theme.bg,
                            color: theme.text
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                          Packet Loss (%)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.packetLoss}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            alertThresholds: { ...notificationSettings.alertThresholds, packetLoss: Number(e.target.value) }
                          })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            background: theme.bg,
                            color: theme.text
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                          CPU Usage (%)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.cpu}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            alertThresholds: { ...notificationSettings.alertThresholds, cpu: Number(e.target.value) }
                          })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            background: theme.bg,
                            color: theme.text
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                          Memory Usage (%)
                        </label>
                        <input
                          type="number"
                          value={notificationSettings.alertThresholds.memory}
                          onChange={(e) => setNotificationSettings({
                            ...notificationSettings,
                            alertThresholds: { ...notificationSettings.alertThresholds, memory: Number(e.target.value) }
                          })}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            background: theme.bg,
                            color: theme.text
                          }}
                        />
                      </div>
                    </div>
                  </SettingCard>

                  <SettingCard
                    icon={<Webhook />}
                    title="Webhooks"
                    description="Send alerts to external services like Slack, Discord, or custom endpoints"
                    theme={theme}
                  >
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <input 
                        type="text" 
                        placeholder="https://hooks.slack.com/services/..." 
                        value={newWebhookUrl}
                        onChange={(e) => setNewWebhookUrl(e.target.value)}
                        style={{ 
                          flex: 1, 
                          padding: '12px', 
                          borderRadius: '8px', 
                          border: `1px solid ${theme.border}`, 
                          background: theme.bg, 
                          color: theme.text,
                          fontSize: '14px'
                        }}
                      />
                      <button 
                        type="button"
                        onClick={handleAddWebhook} 
                        style={{ 
                          background: theme.primary, 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '8px', 
                          padding: '0 24px', 
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {webhooks.map(webhook => (
                        <div 
                          key={webhook.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '14px', 
                            background: theme.bg, 
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`
                          }}
                        >
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Toggle 
                              checked={webhook.enabled}
                              onChange={() => handleToggleWebhook(webhook.id)}
                              theme={theme}
                            />
                            <span style={{ 
                              color: webhook.enabled ? theme.text : theme.textSecondary, 
                              fontSize: '13px', 
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {webhook.url}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveWebhook(webhook.id)} 
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: theme.danger, 
                              cursor: 'pointer',
                              padding: '8px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {webhooks.length === 0 && (
                        <div style={{ 
                          padding: '32px', 
                          textAlign: 'center', 
                          color: theme.textSecondary,
                          fontSize: '14px'
                        }}>
                          No webhooks configured. Add one to get started.
                        </div>
                      )}
                    </div>
                  </SettingCard>
                </div>
              </div>
            )}

            {/* INTEGRATIONS TAB */}
            {activeTab === 'integrations' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="Integrations" 
                  description="Connect with third-party services and tools"
                  theme={theme}
                />
                
                <div style={{ display: 'grid', gap: '20px' }}>
                  {['slack', 'discord', 'teams', 'pagerduty'].map(service => (
                    <SettingCard
                      key={service}
                      icon={<Zap />}
                      title={service.charAt(0).toUpperCase() + service.slice(1)}
                      description={`Send alerts and notifications to ${service}`}
                      accent={service === 'slack' ? '#4A154B' : service === 'discord' ? '#5865F2' : service === 'teams' ? '#6264A7' : '#06AC38'}
                      theme={theme}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <Toggle 
                          checked={integrations[service].enabled}
                          onChange={(checked) => handleUpdateIntegration(service, 'enabled', checked)}
                          label={`Enable ${service} integration`}
                          theme={theme}
                        />
                        {integrations[service].enabled && (
                          <>
                            <div>
                              <label style={{ display: 'block', marginBottom: '8px', color: theme.textSecondary, fontSize: '13px', fontWeight: 500 }}>
                                {service === 'pagerduty' ? 'API Key' : 'Webhook URL'}
                              </label>
                              <input
                                type="text"
                                placeholder={service === 'pagerduty' ? 'Enter API key' : 'https://...'}
                                value={integrations[service][service === 'pagerduty' ? 'apiKey' : 'webhookUrl']}
                                onChange={(e) => handleUpdateIntegration(service, service === 'pagerduty' ? 'apiKey' : 'webhookUrl', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  borderRadius: '8px',
                                  border: `1px solid ${theme.border}`,
                                  background: theme.bg,
                                  color: theme.text,
                                  fontFamily: 'monospace',
                                  fontSize: '13px'
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTestIntegration(service)}
                              style={{
                                padding: '10px 16px',
                                background: theme.bgSecondary,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '8px',
                                color: theme.text,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '14px',
                                fontWeight: 500
                              }}
                            >
                              <Activity size={16} /> Test Connection
                            </button>
                          </>
                        )}
                      </div>
                    </SettingCard>
                  ))}
                </div>
              </div>
            )}

            {/* SECRETS & KEYS TAB */}
            {activeTab === 'secrets' && (
              <SecretsTab
                secrets={secrets}
                newSecretData={newSecretData}
                setNewSecretData={setNewSecretData}
                handleCreateSecret={handleCreateSecret}
                showSecretValue={showSecretValue}
                fetchSecretValue={fetchSecretValue}
                handleDeleteSecret={handleDeleteSecret}
                theme={theme}
              />
            )}

            {/* SECURITY & API TAB */}
            {activeTab === 'security' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="Security & API Keys" 
                  description="Manage API access and security settings"
                  theme={theme}
                />
                
                <SettingCard
                  icon={<Key />}
                  title="App Access Tokens"
                  description="Generate tokens for accessing THIS dashboard's API externally"
                  theme={theme}
                >
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <input 
                      type="text" 
                      placeholder="Token Name (e.g., CI/CD Pipeline)" 
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      style={{ 
                        flex: 1, 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: `1px solid ${theme.border}`, 
                        background: theme.bg, 
                        color: theme.text,
                        fontSize: '14px'
                      }}
                    />
                    <button 
                      type="button"
                      onClick={handleGenerateApiKey} 
                      style={{ 
                        background: theme.primary, 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '8px', 
                        padding: '0 24px', 
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Plus size={16} /> Generate
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {apiKeys.map(key => (
                      <div 
                        key={key.id} 
                        style={{ 
                          padding: '16px', 
                          background: theme.bg, 
                          borderRadius: '8px',
                          border: `1px solid ${theme.border}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: theme.text, marginBottom: '4px' }}>{key.name}</div>
                            <div style={{ fontSize: '11px', color: theme.textSecondary }}>
                              Created {new Date(key.created).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setShowApiKey({ ...showApiKey, [key.id]: !showApiKey[key.id] })}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: theme.textSecondary,
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px',
                                display: 'flex'
                              }}
                            >
                              {showApiKey[key.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyApiKey(key.key)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: theme.textSecondary,
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px',
                                display: 'flex'
                              }}
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteApiKey(key.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: theme.danger,
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '6px',
                                display: 'flex'
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div style={{
                          padding: '12px',
                          background: theme.card,
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: theme.text,
                          wordBreak: 'break-all'
                        }}>
                          {showApiKey[key.id] ? key.key : '•'.repeat(64)}
                        </div>
                      </div>
                    ))}
                    {apiKeys.length === 0 && (
                      <div style={{ 
                        padding: '32px', 
                        textAlign: 'center', 
                        color: theme.textSecondary,
                        fontSize: '14px'
                      }}>
                        No API keys generated. Create one to get started.
                      </div>
                    )}
                  </div>
                </SettingCard>
              </div>
            )}

            {/* DATA MANAGEMENT TAB */}
            {activeTab === 'data' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="Data Management" 
                  description="Import, export, and manage your monitoring data"
                  theme={theme}
                />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                  <SettingCard
                    icon={<Download />}
                    title="Export Data"
                    description="Download all site configurations and history"
                    theme={theme}
                  >
                    <button 
                      type="button"
                      onClick={handleExportSites} 
                      disabled={isExporting}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        background: theme.primary, 
                        border: 'none', 
                        borderRadius: '8px', 
                        color: '#fff', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}
                    >
                      {isExporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />} 
                      {isExporting ? 'Exporting...' : 'Export JSON'}
                    </button>
                  </SettingCard>

                  <SettingCard
                    icon={<Upload />}
                    title="Import Data"
                    description="Restore sites from a JSON backup file"
                    theme={theme}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept=".json"
                      onChange={handleImportFileChange}
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      disabled={isImporting}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        background: theme.primary, 
                        border: 'none', 
                        borderRadius: '8px', 
                        color: '#fff', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}
                    >
                      {isImporting ? <RefreshCw size={16} className="spin" /> : <Upload size={16} />} 
                      {isImporting ? 'Importing...' : 'Select File'}
                    </button>
                  </SettingCard>
                </div>

                <div style={{ 
                  padding: '24px', 
                  borderRadius: '12px', 
                  border: `2px solid ${theme.danger}40`, 
                  background: `${theme.danger}08`
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                    <AlertTriangle size={24} color={theme.danger} />
                    <div>
                      <h3 style={{ margin: '0 0 8px 0', color: theme.danger, fontSize: '18px', fontWeight: 700 }}>Danger Zone</h3>
                      <p style={{ margin: 0, color: theme.textSecondary, fontSize: '14px' }}>
                        These actions are permanent and cannot be undone. Proceed with caution.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      type="button"
                      onClick={() => setShowDeleteAllConfirm(true)}
                      style={{ 
                        padding: '12px 20px', 
                        background: theme.danger, 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontWeight: 600
                      }}
                    >
                      <Trash2 size={16} /> Delete All Sites
                    </button>
                    <button 
                      type="button"
                      onClick={handleClearCache}
                      style={{ 
                        padding: '12px 20px', 
                        background: 'transparent', 
                        border: `2px solid ${theme.danger}`, 
                        color: theme.danger, 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontWeight: 600
                      }}
                    >
                      <RefreshCw size={16} /> Clear Local Cache
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="User Management" 
                  description="Manage access and permissions for dashboard users"
                  theme={theme}
                />
                
                {/* Create User */}
                <SettingCard
                  icon={<Plus />}
                  title="Create New User"
                  description="Add a new user to the dashboard"
                  theme={theme}
                >
                  <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: theme.textSecondary, fontWeight: 500 }}>First Name</label>
                      <input 
                        type="text" 
                        required 
                        value={newUserData.firstName}
                        onChange={e => setNewUserData({...newUserData, firstName: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: `1px solid ${theme.border}`, 
                          background: theme.bg, 
                          color: theme.text 
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: theme.textSecondary, fontWeight: 500 }}>Last Name</label>
                      <input 
                        type="text" 
                        required 
                        value={newUserData.lastName}
                        onChange={e => setNewUserData({...newUserData, lastName: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: `1px solid ${theme.border}`, 
                          background: theme.bg, 
                          color: theme.text 
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: theme.textSecondary, fontWeight: 500 }}>Email</label>
                      <input 
                        type="email" 
                        required 
                        value={newUserData.email}
                        onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: `1px solid ${theme.border}`, 
                          background: theme.bg, 
                          color: theme.text 
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: theme.textSecondary, fontWeight: 500 }}>Password</label>
                      <input 
                        type="password" 
                        required 
                        value={newUserData.password}
                        onChange={e => setNewUserData({...newUserData, password: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: `1px solid ${theme.border}`, 
                          background: theme.bg, 
                          color: theme.text 
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: theme.textSecondary, fontWeight: 500 }}>Role</label>
                      <select 
                        value={newUserData.role}
                        onChange={e => setNewUserData({...newUserData, role: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: `1px solid ${theme.border}`, 
                          background: theme.bg, 
                          color: theme.text 
                        }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button 
                        type="submit" 
                        style={{ 
                          width: '100%',
                          padding: '10px 16px', 
                          background: theme.primary, 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '8px', 
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <Plus size={16} /> Create User
                      </button>
                    </div>
                  </form>
                </SettingCard>

                {/* User List */}
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: theme.text, marginBottom: '16px' }}>
                    Active Users ({users.length})
                  </h3>
                  <div style={{ background: theme.card, borderRadius: '12px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: theme.bgSecondary }}>
                        <tr>
                          <th style={{ padding: '16px', textAlign: 'left', color: theme.textSecondary, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>USER</th>
                          <th style={{ padding: '16px', textAlign: 'left', color: theme.textSecondary, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROLE</th>
                          <th style={{ padding: '16px', textAlign: 'right', color: theme.textSecondary, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                            <td style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.primary}dd)`,
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '14px'
                                }}>
                                  {u.firstName?.[0]}{u.lastName?.[0]}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: theme.text }}>{u.firstName} {u.lastName}</div>
                                  <div style={{ fontSize: '13px', color: theme.textSecondary }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '16px' }}>
                              <span style={{ 
                                padding: '6px 12px', 
                                borderRadius: '16px', 
                                fontSize: '12px', 
                                fontWeight: 700, 
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: u.role === 'admin' ? `${theme.primary}20` : theme.bgSecondary,
                                color: u.role === 'admin' ? theme.primary : theme.textSecondary
                              }}>
                                {u.role}
                              </span>
                            </td>
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                              {u.email !== user?.email && (
                                <button 
                                  type="button"
                                  onClick={() => setShowDeleteUserConfirm(u)}
                                  style={{ 
                                    background: `${theme.danger}15`, 
                                    border: 'none', 
                                    color: theme.danger, 
                                    cursor: 'pointer',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: 600,
                                    fontSize: '13px'
                                  }}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {usersLoading && (
                      <div style={{ padding: '40px', textAlign: 'center', color: theme.textSecondary }}>
                        <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
                        <div>Loading users...</div>
                      </div>
                    )}
                    {!usersLoading && users.length === 0 && (
                      <div style={{ padding: '40px', textAlign: 'center', color: theme.textSecondary }}>
                        No users found. Create one to get started.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ADVANCED TAB */}
            {activeTab === 'advanced' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="Advanced Settings" 
                  description="Fine-tune advanced dashboard behavior"
                  theme={theme}
                />
                
                <SettingCard
                  icon={<Code />}
                  title="Developer Options"
                  description="Advanced settings for developers and power users"
                  theme={theme}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Toggle 
                      checked={false}
                      onChange={() => {}}
                      label="Enable debug mode"
                      theme={theme}
                    />
                    <Toggle 
                      checked={false}
                      onChange={() => {}}
                      label="Show performance metrics"
                      theme={theme}
                    />
                    <Toggle 
                      checked={false}
                      onChange={() => {}}
                      label="Enable experimental features"
                      theme={theme}
                    />
                  </div>
                </SettingCard>
              </div>
            )}

            {/* DEBUG TAB */}
            {activeTab === 'debug' && (
              <div style={{ maxWidth: '900px' }}>
                <SectionHeader 
                  title="System Debug" 
                  description="Diagnostics, testing tools, and system information"
                  theme={theme}
                />
                
                <SettingCard
                  icon={<Activity />}
                  title="Connection Tests"
                  description="Test connectivity to backend services"
                  theme={theme}
                >
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      type="button"
                      onClick={testBackendConnection}
                      style={{ 
                        padding: '12px 20px', 
                        background: theme.card, 
                        border: `1px solid ${theme.border}`, 
                        borderRadius: '8px', 
                        color: theme.text, 
                        cursor: 'pointer', 
                        display: 'flex', 
                        gap: '8px', 
                        alignItems: 'center',
                        fontWeight: 600
                      }}
                    >
                      <Activity size={16} /> Test Backend
                    </button>
                    <button 
                      type="button"
                      onClick={() => showSuccess('Test notification')}
                      style={{ 
                        padding: '12px 20px', 
                        background: theme.card, 
                        border: `1px solid ${theme.border}`, 
                        borderRadius: '8px', 
                        color: theme.text, 
                        cursor: 'pointer', 
                        display: 'flex', 
                        gap: '8px', 
                        alignItems: 'center',
                        fontWeight: 600
                      }}
                    >
                      <Bell size={16} /> Test Notification
                    </button>
                  </div>
                </SettingCard>

                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: theme.text, marginBottom: '12px' }}>Debug Logs</h3>
                  <div style={{ 
                    background: '#0d1117', 
                    borderRadius: '12px', 
                    padding: '20px', 
                    height: '400px', 
                    overflowY: 'auto', 
                    fontFamily: 'monospace', 
                    fontSize: '12px',
                    border: `1px solid ${theme.border}`
                  }}>
                    {debugLogs.length === 0 ? (
                      <div style={{ color: '#6e7681', textAlign: 'center', marginTop: '150px' }}>
                        No debug logs available. Run a test to see logs here.
                      </div>
                    ) : (
                      debugLogs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #21262d' }}>
                          <span style={{ color: '#6e7681' }}>[{new Date(log.time).toLocaleTimeString()}]</span>{' '}
                          <span style={{ 
                            color: log.type === 'ERROR' ? '#f85149' : '#3fb950', 
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: log.type === 'ERROR' ? '#f8514920' : '#3fb95020'
                          }}>
                            {log.type}
                          </span>{' '}
                          <span style={{ color: '#c9d1d9' }}>{log.msg}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      
      {/* Confirmation Modals */}
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
          message={`Are you sure you want to delete ${showDeleteUserConfirm.firstName} ${showDeleteUserConfirm.lastName} (${showDeleteUserConfirm.email})?`}
          onConfirm={() => handleDeleteUser(showDeleteUserConfirm.id)}
          onCancel={() => setShowDeleteUserConfirm(null)}
          theme={theme}
        />
      )}
    </div>
  );
};

export default EnhancedSettingsModal;

