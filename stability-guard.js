// Runtime stability guard for legacy enhancement modules.
// Prevents repeated global click/keydown listeners from the same module from
// accumulating on every polling tick and eventually freezing the browser.
(() => {
  if (window.__DLM_STABILITY_GUARD__) return;
  window.__DLM_STABILITY_GUARD__ = true;

  const original = Document.prototype.addEventListener;
  const seen = new Set();

  Document.prototype.addEventListener = function(type, listener, options) {
    if ((type === 'click' || type === 'keydown') && typeof listener === 'function') {
      let stack = '';
      try { stack = new Error().stack || ''; } catch {}
      if (stack.includes('advanced-suite.js')) {
        const key = `advanced-suite:${type}`;
        if (seen.has(key)) return;
        seen.add(key);
      }
    }
    return original.call(this, type, listener, options);
  };
})();
