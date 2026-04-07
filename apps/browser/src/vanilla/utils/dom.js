/* eslint-disable */
/**
 * DOM Utilities
 *
 * High-performance DOM manipulation utilities.
 */

/**
 * Create element with attributes and children
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {Array<Node|string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'className') node.className = v;
    else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => (node.dataset[dk] = dv));
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function')
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  });

  children.forEach((child) => {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  });

  return node;
}

/**
 * Create element from HTML string
 * @param {string} html
 * @returns {HTMLElement}
 */
export function elFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild;
}

/**
 * Escape HTML entities
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Find element(s) with error handling
 * @param {ParentNode} root
 * @param {string} selector
 * @param {boolean} [all=false]
 * @returns {HTMLElement|NodeList|null}
 */
export function find(root, selector, all = false) {
  try {
    return all ? root.querySelectorAll(selector) : root.querySelector(selector);
  } catch {
    return all ? new NodeList() : null;
  }
}

/**
 * Toggle class on element
 * @param {HTMLElement} el
 * @param {string} className
 * @param {boolean} [force]
 */
export function toggleClass(el, className, force) {
  el?.classList.toggle(className, force);
}

/**
 * Set attributes on element
 * @param {HTMLElement} el
 * @param {Object} attrs
 */
export function setAttrs(el, attrs) {
  if (!el || !attrs) return;
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null || v === false) el.removeAttribute(k);
    else if (k === 'className') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  });
}

/**
 * Clear element children
 * @param {HTMLElement} el
 */
export function clear(el) {
  if (el) el.innerHTML = '';
}

/**
 * Render HTML into element
 * @param {HTMLElement} el
 * @param {string} html
 */
export function render(el, html) {
  if (el) el.innerHTML = html ?? '';
}

/**
 * Delegate event handler
 * @param {HTMLElement} root
 * @param {string} selector
 * @param {string} event
 * @param {Function} handler
 * @returns {Function} Unbind function
 */
export function delegate(root, selector, event, handler) {
  const listener = (e) => {
    const target = e.target.closest(selector);
    if (root.contains(target)) handler(e, target);
  };
  root.addEventListener(event, listener);
  return () => root.removeEventListener(event, listener);
}

/**
 * Check if the current device is mobile
 * @returns {boolean}
 */
export function isMobile() {
  return window.innerWidth < 768;
}

/**
 * Check if the device is in low power mode
 * @returns {Promise<boolean>}
 */
export async function isLowPowerMode() {
  if (typeof navigator === 'undefined' || !navigator.getBattery) return false;
  try {
    const battery = await navigator.getBattery();
    return battery.level < 0.2 || battery.charging === false;
  } catch {
    return false;
  }
}

export function announce(message) {
  if (!message || typeof document === 'undefined') return;
  const region = document.getElementById('aria-live-region');
  if (region) {
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 100);
  }
}

/**
 * Show the PWA install prompt (call after user interaction)
 * @param {BeforeInstallPromptEvent} deferredPrompt
 */
export async function showInstallPrompt(deferredPrompt) {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    console.log('[PWA] App installed');
  }
  deferredPrompt = null;
}
