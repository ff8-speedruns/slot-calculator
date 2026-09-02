import React from 'react';
import { createRoot } from 'react-dom/client';
import { FF8Provider } from '@ff8-speedruns/ui';
import App from './App.tsx';

import '@mantine/core/styles.css';
import '@ff8-speedruns/ui/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('no #root element to mount into');

createRoot(container).render(
  <React.StrictMode>
    <FF8Provider>
      <App />
    </FF8Provider>
  </React.StrictMode>,
);
