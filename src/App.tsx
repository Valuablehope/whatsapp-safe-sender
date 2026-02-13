import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { CampaignScreen } from './components/CampaignScreen';
import { ContactsScreen } from './components/ContactsScreen';
import { LogsScreen } from './components/LogsScreen';
import { MainLayout } from './components/layout/MainLayout';
import { Sidebar } from './components/layout/Sidebar';
import './App.css';

type View = 'dashboard' | 'campaign' | 'contacts' | 'logs';

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [status, setStatus] = useState('disconnected');
  const [logs, setLogs] = useState<any[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [dailyCount, setDailyCount] = useState(0);

  useEffect(() => {
    if (window.electronAPI) {
      // 1. Listeners
      window.electronAPI.onStatusUpdate((s: string) => {
        console.log('[App] Received status update:', s);
        setStatus(s);
        if (s === 'ready') setQrCode(null);
      });

      window.electronAPI.onLogUpdate((log: any) => {
        setLogs(prev => [log, ...prev].slice(0, 50));
        if (log.status === 'SENT') {
          setDailyCount(prev => prev + 1);
        }
      });

      // 2. Initial Data Fetch
      window.electronAPI.getQRCode();

      const loadData = async () => {
        const initialLogs = await window.electronAPI.fetchLogs();
        setLogs(initialLogs);
        const count = await window.electronAPI.getDailyCount();
        setDailyCount(count);
      };
      loadData();
    }
  }, []);

  const handleClearLogs = async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearLogs();
      setLogs([]);
    }
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard status={status} qrCode={qrCode} dailyCount={dailyCount} />;
      case 'campaign':
        return <CampaignScreen status={status} />;
      case 'contacts':
        return <ContactsScreen />;
      case 'logs':
        return <LogsScreen logs={logs} onClearLogs={handleClearLogs} />;
    }
  };

  return (
    <MainLayout
      sidebar={
        <Sidebar
          currentView={view}
          onViewChange={(v) => setView(v as View)}
          status={status}
        />
      }
    >
      {renderView()}
    </MainLayout>
  );
}

export default App;
