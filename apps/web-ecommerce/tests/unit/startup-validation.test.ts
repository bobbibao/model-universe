import { assertSessionConfiguration } from '../../src/shared/server/utils/StartupValidation';

describe('effective production session configuration', () => {
  it('rejects a missing or weak production session secret', () => {
    for (const JWT_SECRET of [undefined, '', 'short-preview-only'])
      expect(() => assertSessionConfiguration({ NODE_ENV: 'production', JWT_SECRET })).toThrow('at least 32 bytes');
  });
  it('accepts an explicitly configured 32-byte production secret', () => {
    expect(() => assertSessionConfiguration({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) })).not.toThrow();
  });
  it('retains development configuration behavior', () => {
    expect(() => assertSessionConfiguration({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('blocks disposable databases, destructive seed flags and simulated shipping in real commerce', () => {
    const environment = { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32), REAL_COMMERCE: 'true', DB_NAME: 'shop', SUPERAI_ORDER_MODE: 'live', COOKIE_SECURE: 'true' };
    expect(() => assertSessionConfiguration(environment)).not.toThrow();
    for (const patch of [{ PORT: '6060' }, { DB_NAME: 'shop_demo' }, { DB_NAME: 'shop_test' }, { SEED_DATA: 'true' }, { DROP_TABLES: 'true' }, { SUPERAI_ORDER_MODE: 'simulate' }, { COOKIE_SECURE: 'false' }])
      expect(() => assertSessionConfiguration({ ...environment, ...patch })).toThrow();
  });
});
