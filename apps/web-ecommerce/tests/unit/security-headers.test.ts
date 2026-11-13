import type { Request, Response } from 'express';
import {
  SECURITY_HEADERS,
  SecurityHeadersMiddleware,
} from '../../src/core/server/middleware/SecurityHeaders.Middleware';

const run = (secure: boolean) => {
  const headers = new Map<string, string>();
  const next = jest.fn();
  SecurityHeadersMiddleware(
    { secure } as Request,
    { setHeader: (name: string, value: string) => headers.set(name, value) } as unknown as Response,
    next,
  );
  expect(next).toHaveBeenCalledTimes(1);
  return headers;
};

describe('security headers', () => {
  it('protects every response against sniffing, framing and referrer leaks', () => {
    const headers = run(false);
    expect(Object.fromEntries(headers)).toEqual(SECURITY_HEADERS);
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'self'");
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sends HSTS only over HTTPS, so plain-HTTP development is not locked out', () => {
    expect(run(false).has('Strict-Transport-Security')).toBe(false);
    expect(run(true).get('Strict-Transport-Security')).toBe('max-age=31536000');
  });
});
