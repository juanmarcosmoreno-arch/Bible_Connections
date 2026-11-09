import '@fontsource-variable/inter';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, applyHash } from './App.tsx';
import { appStore } from './state/appState.ts';

// Theme is applied synchronously (outside React) so canvas code reads the right CSS variables.
const applyTheme = () => {
  const theme = appStore.get().theme;
  if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#08090D' : '#F7F7F5');
};
applyTheme();
appStore.subscribe(applyTheme);
applyHash();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
