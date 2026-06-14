import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme, ToastViewport} from 'silver-ui';
import 'silver-ui/styles.css';
import {App} from './App.js';
import {QueryProvider} from './QueryProvider.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme>
      <ToastViewport position="bottomEnd">
        <QueryProvider>
          <App />
        </QueryProvider>
      </ToastViewport>
    </Theme>
  </StrictMode>,
);
