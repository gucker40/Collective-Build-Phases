import React from 'react';
import { useUIStore } from '../store/ui.js';
import { useAuthStore } from '../store/auth.js';
import { useLayout } from '../useLayout.js';
import { colors } from '../theme/tokens.js';
import TitleBar from './TitleBar.jsx';
import Sidebar from './Sidebar.jsx';
import HistorySidebar from '../components/HistorySidebar.jsx';
import ArtifactPanel from '../logos/ArtifactPanel.jsx';
import ChatPanel from '../logos/ChatPanel.jsx';
import Dashboard from '../pillars/dashboard/Dashboard.jsx';
import Productivity from '../pillars/productivity/Productivity.jsx';
import Finance from '../pillars/finance/Finance.jsx';
import DataVault from '../pillars/data-vault/DataVault.jsx';
import Config from '../pillars/config/Config.jsx';

function Notification() {
  const { notification } = useUIStore();
  if (!notification) return null;
  const map = {
    success: ['rgba(80,216,144,0.15)', 'rgba(80,216,144,0.4)', '#50d890'],
    error:   ['rgba(255,96,96,0.15)',  'rgba(255,96,96,0.4)',  '#ff9090'],
    info:    ['rgba(240,192,64,0.15)', 'rgba(240,192,64,0.4)', '#f0c040'],
  };
  const [bg, border, color] = map[notification.type] || map.info;
  return (
    <div style={{
      position: 'absolute', top: '44px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 500, padding: '8px 20px', borderRadius: '8px',
      background: bg, border: `1px solid ${border}`, color,
      fontFamily: "'IBM Plex Mono',monospace", fontSize: '12px', whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>
      {notification.text}
    </div>
  );
}

export default function AppShell() {
  const { activePillar, activeView, showHistory, artifact, artifactOpen,
          chatKey, activeSession, historyRefresh } = useUIStore();
  const { isMobile } = useLayout();
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  const isLogos = activePillar === 'logos';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
      overflow: 'hidden', background: colors.bg }}>
      <TitleBar />
      <Notification />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        {/* History sidebar — only visible in Logos view */}
        {isLogos && !isMobile && showHistory && (
          <HistorySidebar />
        )}

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {isLogos          && <ChatPanel key={chatKey} loadedSession={activeSession} />}
            {activePillar === 'dashboard'    && <Dashboard />}
            {activePillar === 'productivity' && <Productivity />}
            {activePillar === 'finance'      && <Finance />}
            {activePillar === 'data-vault'   && <DataVault />}
            {activePillar === 'config'       && <Config />}
          </div>

          {/* Artifact panel slides in from right */}
          {isLogos && <ArtifactPanel artifact={artifact} open={artifactOpen} />}
        </div>
      </div>
    </div>
  );
}
