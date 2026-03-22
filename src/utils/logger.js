// ─── SYSTEM LOGGER ───────────────────────────────────────────
// Centralized logging for the master control system

const MAX_ENTRIES = 200;

export function createLogger(setState) {
  return (msg, type = 'info') => {
    const entry = {
      time: new Date(),
      msg,
      type, // 'info' | 'success' | 'warn' | 'error'
    };

    setState(prev => [...prev.slice(-(MAX_ENTRIES - 1)), entry]);

    // Also log to browser console with appropriate level
    const consoleFn = type === 'error' ? console.error
      : type === 'warn' ? console.warn
      : console.log;
    consoleFn(`[Master] ${msg}`);
  };
}
