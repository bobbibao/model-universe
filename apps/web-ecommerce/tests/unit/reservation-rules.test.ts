import { DAY_MS, reservationDays, reservationDeadline, minimumHoldVnd } from '../../src/shared/reservation';
describe('exact net-merchandise hold tiers', () => {
  it.each([
    [0, 0],
    [199999, 0],
    [200000, 10],
    [399999, 10],
    [400000, 15],
    [499999, 15],
    [500000, 25],
    [599999, 25],
    [600000, 30],
    [699999, 30],
    [700000, 45],
    [999999, 45],
    [1000000, 0],
  ])('maps %i VND to %i days', (paid, days) => expect(reservationDays(1000000, paid)).toBe(days));
  it('never rounds a ratio over a tier boundary', () => {
    expect(minimumHoldVnd(1000001)).toBe(200001);
    expect(reservationDays(1000001, 200000)).toBe(0);
    expect(reservationDays(1000001, 500000)).toBe(15);
    expect(reservationDays(1000001, 700000)).toBe(30);
  });
  it('anchors a top-up to the original 24h start', () => {
    const start = new Date('2026-10-08T03:00:00Z');
    expect(reservationDeadline(start, 1000000, 650000).getTime()).toBe(start.getTime() + 30 * DAY_MS);
    expect(reservationDeadline(start, 1000000, 700000, 2).getTime()).toBe(start.getTime() + 47 * DAY_MS);
  });
  it.each([-1, 1000001, 500000.5, NaN])('rejects invalid/overpaid %s', (paid) =>
    expect(() => reservationDays(1000000, paid)).toThrow(),
  );
  it('has no timed deadline below 20% or after full payment', () => {
    for (const paid of [199999, 1000000]) expect(() => reservationDeadline(new Date(), 1000000, paid)).toThrow();
  });
});
