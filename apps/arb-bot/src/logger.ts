function ts(): string {
  return new Date().toISOString();
}

export const log = {
  info: (...args: unknown[]) => console.log(`[${ts()}] INFO`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${ts()}] WARN`, ...args),
  error: (...args: unknown[]) => console.error(`[${ts()}] ERROR`, ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) console.log(`[${ts()}] DEBUG`, ...args);
  },
};
