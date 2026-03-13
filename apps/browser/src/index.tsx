import { h, render } from 'preact';
import { BrowserNavigator, setNavigator } from '@isc/navigation';
import { App } from './App.js';

function main() {
  const container = document.getElementById('app');
  if (!container) {
    console.error('App container not found');
    return;
  }

  // Initialize browser navigator
  const navigator = new BrowserNavigator();
  setNavigator(navigator);

  render(<App />, container);
}

document.addEventListener('DOMContentLoaded', main);
