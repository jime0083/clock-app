/**
 * Dev-only logging wrapper. `log` is silent in production builds;
 * `warn`/`error` always output since they're allowed by the no-console rule
 * and are useful for diagnosing issues from device logs.
 */
export const logger = {
  log: (...args: unknown[]): void => {
    if (__DEV__) {
      // eslint-disable-next-line no-console -- sole intentional console.log call site
      console.log(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
