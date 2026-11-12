import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consoleSink,
  createLogger,
  createMemorySink,
  getLogLevel,
  setLogLevel,
  setLogSinks,
  addLogSink,
  type LogLevel,
} from './logger';

describe('logger', () => {
  let memory: ReturnType<typeof createMemorySink>;
  let previousLevel: LogLevel;

  beforeEach(() => {
    previousLevel = getLogLevel();
    memory = createMemorySink();
    setLogSinks([memory.sink]);
    setLogLevel('debug');
  });

  afterEach(() => {
    setLogSinks([consoleSink]);
    setLogLevel(previousLevel);
  });

  it('writes records with scope, level, message and data', () => {
    createLogger('engine:packs').info('loaded', { id: 'core' });
    expect(memory.records).toHaveLength(1);
    expect(memory.records[0]).toMatchObject({
      level: 'info',
      scope: 'engine:packs',
      message: 'loaded',
      data: [{ id: 'core' }],
    });
  });

  it('filters below the global level', () => {
    const log = createLogger('t');
    setLogLevel('warn');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(memory.records.map((r) => r.level)).toEqual(['warn', 'error']);
  });

  it('silent drops everything', () => {
    setLogLevel('silent');
    createLogger('t').error('e');
    expect(memory.records).toHaveLength(0);
  });

  it('child loggers extend the scope', () => {
    createLogger('engine').child('packs').child('schema').warn('x');
    expect(memory.records[0]?.scope).toBe('engine:packs:schema');
  });

  it('addLogSink returns a remover', () => {
    const extra = createMemorySink();
    const remove = addLogSink(extra.sink);
    const log = createLogger('t');
    log.info('one');
    remove();
    log.info('two');
    expect(extra.records.map((r) => r.message)).toEqual(['one']);
    expect(memory.records.map((r) => r.message)).toEqual(['one', 'two']);
  });
});
