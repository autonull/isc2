/**
 * Content Sanitization - XSS Protection
 * Uses DOMPurify to sanitize user-generated content
 */

import DOMPurify from 'dompurify';

// Configure DOMPurify for security
DOMPurify.setConfig({
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'code', 'pre', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'style', 'link', 'meta', 'base', 'svg', 'math'],
  FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect', 'onkeydown', 'onkeypress', 'onkeyup', 'onabort', 'ondblclick', 'onmousedown', 'onmouseup', 'onmousemove', 'oncontextmenu', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'oninput', 'oninvalid', 'onscroll', 'onwheel', 'oncopy', 'oncut', 'onpaste'],
});

/**
 * Sanitize HTML content
 * @param content - Raw HTML/string content from user
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(content: string): string {
  if (!content) return '';
  return DOMPurify.sanitize(content, {
    ALLOW_UNKNOWN_PROTOCOLS: false,
    USE_PROFILES: { html: true },
  });
}

/**
 * Sanitize text content (escape HTML entities)
 * @param text - Raw text from user
 * @returns Escaped text safe for rendering
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize URL for links
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn('[Sanitizer] Blocked URL with disallowed protocol:', url);
      return '';
    }
    
    return parsed.href;
  } catch {
    console.warn('[Sanitizer] Invalid URL:', url);
    return '';
  }
}

/**
 * Sanitize message content for chat
 * @param message - Chat message content
 * @returns Sanitized message
 */
export function sanitizeMessage(message: string): string {
  if (!message) return '';
  // For chat messages, we just escape HTML to prevent any formatting
  return sanitizeText(message);
}
