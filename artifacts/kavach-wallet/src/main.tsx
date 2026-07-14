import { Buffer } from 'buffer';

import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Node-only globals expected by browser-bundled crypto libs (ethers, bip32, bs58, etc.)
(window as any).Buffer = (window as any).Buffer || Buffer;
(window as any).global = (window as any).global || window;

createRoot(document.getElementById('root')!).render(<App />);
