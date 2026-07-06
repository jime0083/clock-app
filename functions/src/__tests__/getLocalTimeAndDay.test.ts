import { getLocalTimeAndDay } from '../index';

describe('getLocalTimeAndDay (Problem 26: timezone-aware alarm judgment)', () => {
  it('should compute the correct local time and weekday for Asia/Tokyo', () => {
    // 2026-07-06 is a Monday. 00:30 UTC = 09:30 JST (UTC+9)
    const date = new Date('2026-07-06T00:30:00.000Z');

    const result = getLocalTimeAndDay('Asia/Tokyo', date);

    expect(result.time).toBe('09:30');
    expect(result.day).toBe(1); // Monday
  });

  it('should compute the correct local time and weekday for a negative UTC offset (America/New_York)', () => {
    // 2026-07-06T00:30:00Z, EDT is UTC-4 -> 2026-07-05 20:30 local (still Sunday)
    const date = new Date('2026-07-06T00:30:00.000Z');

    const result = getLocalTimeAndDay('America/New_York', date);

    expect(result.time).toBe('20:30');
    expect(result.day).toBe(0); // Sunday (day rolled back across the date line)
  });

  it('should handle the midnight rollover into the next local day', () => {
    // 15:00 UTC = 00:00 JST the next day (also exercises the "24"->"00"
    // correction on ICU versions that format midnight as hour "24")
    const date = new Date('2026-07-05T15:00:00.000Z');

    const result = getLocalTimeAndDay('Asia/Tokyo', date);

    expect(result.time).toBe('00:00');
    expect(result.day).toBe(1); // Monday in JST, even though still Sunday in UTC
  });

  it('should fall back to Asia/Tokyo for an invalid/unknown timezone', () => {
    const date = new Date('2026-07-06T00:30:00.000Z');

    const invalidResult = getLocalTimeAndDay('Not/ARealTimezone', date);
    const tokyoResult = getLocalTimeAndDay('Asia/Tokyo', date);

    expect(invalidResult).toEqual(tokyoResult);
  });

  it('should fall back to Asia/Tokyo for an empty timezone string', () => {
    const date = new Date('2026-07-06T00:30:00.000Z');

    const emptyResult = getLocalTimeAndDay('', date);
    const tokyoResult = getLocalTimeAndDay('Asia/Tokyo', date);

    expect(emptyResult).toEqual(tokyoResult);
  });
});
