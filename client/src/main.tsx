import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);

// Registration itself is async and non-blocking, so it's safe to fire immediately rather
// than waiting for the window 'load' event — by the time this module (part of the main
// hashed bundle) finishes executing, 'load' has often already fired, and a listener
// registered after the fact never runs. Enables the app shell to load with no connection
// (see public/sw.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/app/sw.js').catch((err) => {
    console.error('Service worker registration failed:', err);
  });
}
