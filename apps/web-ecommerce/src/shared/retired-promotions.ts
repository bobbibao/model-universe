// Reserved code family issued by the removed automatic time-slot promotion.
export const isRetiredTimedCoupon = (code: string) => /^D\d{6}-(00|12|20)$/i.test(code);
