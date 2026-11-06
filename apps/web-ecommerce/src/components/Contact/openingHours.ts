// Whether the showroom is open at `now`, in the shop's time zone (Asia/Ho_Chi_Minh), 08:00–22:00 every day.
export const OPEN_FROM_HOUR = 8;
export const OPEN_UNTIL_HOUR = 22;

export const isShopOpen = (now: Date = new Date()) => {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(now),
  );
  return hour >= OPEN_FROM_HOUR && hour < OPEN_UNTIL_HOUR;
};
