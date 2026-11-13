import type { Request, Response } from 'express';
import { CanonicalHostMiddleware } from '../../src/core/server/middleware/CanonicalHost.Middleware';

const run = (hostname: string, method = 'GET', originalUrl = '/vi/san-pham/kit?tinh-trang=3') => {
  const redirect = jest.fn();
  const next = jest.fn();
  CanonicalHostMiddleware({ hostname, method, originalUrl } as Request, { redirect } as unknown as Response, next);
  return { redirect, next };
};

describe('canonical host', () => {
  const previous = process.env.SHOP_PUBLIC_URL;
  beforeAll(() => {
    process.env.SHOP_PUBLIC_URL = 'https://modeluniverse.vn';
  });
  afterAll(() => {
    process.env.SHOP_PUBLIC_URL = previous;
  });

  it('moves a page on www permanently to the same path and query on the public host', () => {
    const { redirect, next } = run('www.modeluniverse.vn');
    expect(redirect).toHaveBeenCalledWith(301, 'https://modeluniverse.vn/vi/san-pham/kit?tinh-trang=3');
    expect(next).not.toHaveBeenCalled();
    expect(run('www.modeluniverse.vn', 'HEAD', '/').redirect).toHaveBeenCalledWith(301, 'https://modeluniverse.vn/');
  });

  it('serves the public host, localhost and other hosts as they are', () => {
    for (const host of ['modeluniverse.vn', 'localhost', '127.0.0.1', 'www.example.com']) {
      const { redirect, next } = run(host);
      expect(redirect).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('does not redirect a webhook or a form posted to www', () => {
    const { redirect, next } = run('www.modeluniverse.vn', 'POST', '/api/payments/payos/webhook');
    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
