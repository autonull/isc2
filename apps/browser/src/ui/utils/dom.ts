/**
 * Robust HTML Escaping Utility for untrusted peer data
 * Prevents XSS injection vulnerabilities when rendering into DOM via innerHTML
 */
export function escapeHTML(str: string | undefined | null): string {
  if (str == null) return '';
  return String(str).replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
