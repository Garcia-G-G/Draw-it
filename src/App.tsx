import { useEffect } from 'react';
import { Header, SplitView, StyleSelector } from './components/Layout';
import { ToastContainer } from './components/UI';
import { useRealtimeGeneration } from './hooks';
import { checkHealth } from './services/api';
import { useAppStore } from './store';

function App() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Detect server capabilities on mount
  useEffect(() => {
    checkHealth()
      .then((h) => useAppStore.getState().setCapabilities({ openai: h.hasOpenAI, fal: h.hasFal, together: h.hasTogether ?? false }))
      .catch(() => { /* server unreachable — use defaults */ });
  }, []);

  // Realtime generation loop (no-ops if disabled)
  useRealtimeGeneration();

  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
      <Header />
      <StyleSelector />
      <SplitView />
      <ToastContainer />
    </div>
  );
}

export default App;
