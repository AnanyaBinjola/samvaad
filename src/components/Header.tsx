import React, { useState } from 'react';
import { VoxMascot, type VoxState } from './VoxMascot';
import type { ServerConfig } from '../types';

interface HeaderProps {
  serverConfig: ServerConfig;
  onUpdateServerConfig: (config: ServerConfig) => void;
  voxState: VoxState;
  forceOpenSettings?: boolean;
  onCloseSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serverConfig,
  onUpdateServerConfig,
  voxState = 'idle',
  forceOpenSettings = false,
  onCloseSettings,
}) => {
  const [internalOpenSettings, setInternalOpenSettings] = useState<boolean>(false);
  const showSettings = internalOpenSettings || forceOpenSettings;

  const [tempEndpoint, setTempEndpoint] = useState<string>(serverConfig.endpoint);
  const [tempApiKey, setTempApiKey] = useState<string>(serverConfig.apiKey || '');
  const [saveNotification, setSaveNotification] = useState<boolean>(false);

  const openSettings = () => {
    setTempEndpoint(serverConfig.endpoint);
    setTempApiKey(serverConfig.apiKey || '');
    setInternalOpenSettings(true);
  };

  const handleClose = () => {
    setInternalOpenSettings(false);
    onCloseSettings?.();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateServerConfig({
      endpoint: tempEndpoint.trim(),
      apiKey: tempApiKey.trim(),
    });
    setSaveNotification(true);
    setTimeout(() => setSaveNotification(false), 3000);
    setInternalOpenSettings(false);
    onCloseSettings?.();
  };

  const isProxyActive = tempEndpoint.startsWith('/api') || tempEndpoint.includes('/api/translate');

  return (
    <header className="editorial-header">
      <div className="header-inner">
        {/* Branding & Masthead with reactive VOX companion */}
        <div className="brand-group">
          <VoxMascot state={voxState} size="sm" />
          <div className="brand-text">
            <span className="brand-pretitle">Multilateral Speech Translation</span>
            <h1 className="brand-title">Samvaad</h1>
          </div>
        </div>

        {/* Server & Connectivity Badges */}
        <div className="header-meta-group">
          <div className="status-indicator-badge" title={`Configured endpoint: ${serverConfig.endpoint}`}>
            <span className="status-dot"></span>
            <span className="status-label">
              Backend: <code>{serverConfig.endpoint.replace(/^https?:\/\//, '')}</code>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showSettings) {
                handleClose();
              } else {
                openSettings();
              }
            }}
            className="settings-toggle-btn"
            aria-label="Configure backend server connection and settings"
            aria-expanded={showSettings}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Server Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Modal / Configuration Panel */}
      {showSettings && (
        <div className="settings-drawer-card" role="dialog" aria-modal="true" aria-labelledby="settings-drawer-title">
          <div className="drawer-header">
            <h4 id="settings-drawer-title">Backend Connection & Translation API Settings</h4>
            <button
              type="button"
              onClick={handleClose}
              className="drawer-close-btn"
              aria-label="Close server settings"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label htmlFor="server-endpoint-input">
                Server Endpoint URL or Proxy Path
              </label>
              <input
                id="server-endpoint-input"
                type="text"
                required
                value={tempEndpoint}
                onChange={(e) => setTempEndpoint(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                className="text-input"
              />

              <div className="preset-endpoint-buttons">
                <button
                  type="button"
                  onClick={() => setTempEndpoint('http://127.0.0.1:8000')}
                  className={`preset-btn ${tempEndpoint === 'http://127.0.0.1:8000' ? 'active' : ''}`}
                >
                  Local Backend (127.0.0.1:8000)
                </button>
                <button
                  type="button"
                  onClick={() => setTempEndpoint('/api/translate')}
                  className={`preset-btn ${isProxyActive ? 'active' : ''}`}
                >
                  Vite Dev Proxy (/api/translate)
                </button>
              </div>

              <small className="input-hint">
                Default: <code>/api/translate</code> (Vite Dev Proxy). Forwards requests to <code>http://127.0.0.1:8000/translate</code> while bypassing browser CORS restrictions during development.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="server-api-key-input">
                API Key (Optional Header: <code>X-API-Key</code>)
              </label>
              <input
                id="server-api-key-input"
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Leave empty if server uses backend GEMINI_API_KEY"
                className="text-input"
                autoComplete="off"
              />
              <small className="input-hint">
                Optional override sent as <code>X-API-Key</code> header. By default, the backend loads <code>GEMINI_API_KEY</code> from its environment configuration.
              </small>
            </div>

            <div className="drawer-actions">
              <button type="submit" className="save-settings-btn">
                Save & Apply Configuration
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempEndpoint('/api/translate');
                  setTempApiKey('');
                }}
                className="reset-settings-btn"
              >
                Reset Default
              </button>
            </div>
          </form>
        </div>
      )}

      {saveNotification && (
        <div className="toast-notification" role="status">
          ✓ Server configuration updated successfully
        </div>
      )}
    </header>
  );
};
