/**
 * Scoped logger with levels and pluggable sinks.
 *
 * ```ts
 * const log = createLogger('engine:packs');
 * log.info('loaded', { id: 'core' });
 * const sub = log.child('schema'); // scope "engine:packs:schema"
 * ```
 *
 * Global settings (`setLogLevel`, `addLogSink`, ...) apply to every logger. The default
 * sink writes to the console. Tests can swap in a memory sink.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type MessageLevel = Exclude<LogLevel, 'silent'>;

export interface LogRecord {
  readonly level: MessageLevel;
  readonly scope: string;
  readonly message: string;
  readonly data: readonly unknown[];
  readonly time: number;
}

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  readonly scope: string;
  debug(message: string, ...data: unknown[]): void;
  info(message: string, ...data: unknown[]): void;
  warn(message: string, ...data: unknown[]): void;
  error(message: string, ...data: unknown[]): void;
  child(scope: string): Logger;
}

const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

export const consoleSink: LogSink = (record) => {
  const prefix = `[${record.scope}]`;
  switch (record.level) {
    case 'debug':
      // eslint-disable-next-line no-console -- the console sink is the one place allowed to log
      console.debug(prefix, record.message, ...record.data);
      break;
    case 'info':
      console.info(prefix, record.message, ...record.data);
      break;
    case 'warn':
      console.warn(prefix, record.message, ...record.data);
      break;
    case 'error':
      console.error(prefix, record.message, ...record.data);
      break;
  }
};

const config = {
  level: (import.meta.env?.DEV ? 'debug' : 'info') as LogLevel,
  sinks: [consoleSink] as LogSink[],
  now: (): number => Date.now(),
};

export function setLogLevel(level: LogLevel): void {
  config.level = level;
}

export function getLogLevel(): LogLevel {
  return config.level;
}

/** Adds a sink; returns a function that removes it. */
export function addLogSink(sink: LogSink): () => void {
  config.sinks.push(sink);
  return () => {
    const i = config.sinks.indexOf(sink);
    if (i >= 0) config.sinks.splice(i, 1);
  };
}

/** Replaces all sinks (e.g. `[]` to mute output in tests). */
export function setLogSinks(sinks: readonly LogSink[]): void {
  config.sinks = [...sinks];
}

/** Sink that stores records in an array; useful in tests. */
export function createMemorySink(): { sink: LogSink; records: LogRecord[] } {
  const records: LogRecord[] = [];
  return { sink: (r) => records.push(r), records };
}

export function createLogger(scope: string): Logger {
  const write = (level: MessageLevel, message: string, data: unknown[]): void => {
    if (RANK[level] < RANK[config.level]) return;
    const record: LogRecord = { level, scope, message, data, time: config.now() };
    for (const sink of config.sinks) sink(record);
  };
  return {
    scope,
    debug: (message, ...data) => write('debug', message, data),
    info: (message, ...data) => write('info', message, data),
    warn: (message, ...data) => write('warn', message, data),
    error: (message, ...data) => write('error', message, data),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}
