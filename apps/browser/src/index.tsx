import { h, render } from 'preact';
import { BrowserNavigator, setNavigator } from '@isc/navigation';
import { App } from './App.js';
import './styles/main.css';

console.log('[ISC] Module loaded');

function init() {
  console.log('[ISC] init() called');
  
  const container = document.getElementById('app');
  if (!container) {
    console.error('[ISC] Container not found!');
    return;
  }
  
  try {
    const navigator = new BrowserNavigator();
    setNavigator(navigator);
    console.log('[ISC] Navigator created');
    
    render(<App />, container);
    console.log('[ISC] Render complete');
  } catch (err) {
    console.error('[ISC] Fatal error:', err);
    container.innerHTML = `<div style="color:red;padding:20px;"><h1>Error</h1><pre>${err instanceof Error ? err.message : String(err)}</pre></div>`;
  }
}

setTimeout(init, 100);
