import { config } from '../config/env.js';

const isDev = config.nodeEnv === 'development';

export const logger = {
  debug: (...args) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args) => {
    console.log('[INFO]', ...args);
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
};

export default logger;
