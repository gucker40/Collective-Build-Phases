import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth.js';
import { api } from './api/index.js';
import LoginScreen from './components/auth/LoginScreen.jsx';
import SetupWizard from './components/auth/SetupWizard.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import AppShell from './layout/AppShell.jsx';

export default function App() {
  const { token, user } = useAuthStore();
  const [booting, setBooting] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    async function boot() {
      await new Promise(r => setTimeout(r, 300));
      if (token && user) {
        try {
          const cfg = await api.settings.get();
          setNeedsSetup(!cfg.setup_complete);
        } catch {
          // Backend not ready yet — show app anyway
        }
      }
      setBooting(false);
    }
    boot();
  }, [token, user]);

  if (booting)      return <LoadingScreen />;
  if (!token || !user) return <LoginScreen />;
  if (needsSetup)   return <SetupWizard onComplete={() => setNeedsSetup(false)} />;
  return <AppShell />;
}
