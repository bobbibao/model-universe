// Validate the effective environment after Next loads its configuration, before database initialization.
export function assertSessionConfiguration(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV === 'production' && (!environment.JWT_SECRET || new TextEncoder().encode(environment.JWT_SECRET).length < 32))
    throw new Error('Production requires JWT_SECRET with at least 32 bytes.');
  if (environment.REAL_COMMERCE === 'true') {
    if (environment.PORT && environment.PORT !== '6050')
      throw new Error('Real commerce uses the single website port 6050.');
    if (environment.SEED_DATA === 'true' || environment.DROP_TABLES === 'true')
      throw new Error('Real commerce cannot seed or drop shop data.');
    if (!environment.DB_NAME || /(_demo|_test)$/.test(environment.DB_NAME))
      throw new Error('Real commerce requires the shop database.');
    if (environment.SUPERAI_ORDER_MODE !== 'live')
      throw new Error('Real commerce requires live shipping; simulated waybills are disabled.');
    if (environment.COOKIE_SECURE !== 'true')
      throw new Error('Real commerce requires secure session cookies.');
  }
}
