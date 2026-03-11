import { h, render } from 'preact';
import { App } from './App.js';

function main() {
  const container = document.getElementById('app');
  if (!container) {
    console.error('App container not found');
    return;
  }

  render(<App />, container);
}

document.addEventListener('DOMContentLoaded', main);
