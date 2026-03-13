import { useEffect } from 'react';
import { Header, SplitView, StyleSelector } from './components/Layout';
import { ToastContainer } from './components/UI';
import { useAppStore } from './store';

function App() {
  const theme = useAppStore((s) => s.theme);

  // Sync dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
