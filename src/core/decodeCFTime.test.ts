import { describe, it, expect } from 'vitest';
import { parseCFUnits, decodeCFTime } from './decodeCFTime';

describe('parseCFUnits', () => {
  it('parses days since reference date', () => {
    const { unit, ref } = parseCFUnits('days since 2000-01-01');
    expect(unit).toBe('days');
    expect(ref).toBe('2000-01-01');
  });

  it('parses hours since reference date', () => {
    const { unit, ref } = parseCFUnits('hours since 2023-06-01 00:00:00');
    expect(unit).toBe('hours');
    expect(ref).toBe('2023-06-01 00:00:00');
  });

  it('parses minutes since reference date', () => {
    const { unit, ref } = parseCFUnits('minutes since 1970-01-01');
    expect(unit).toBe('minutes');
    expect(ref).toBe('1970-01-01');
  });

  it('parses seconds since reference date', () => {
    const { unit, ref } = parseCFUnits('seconds since 1990-01-01');
    expect(unit).toBe('seconds');
    expect(ref).toBe('1990-01-01');
  });

  it('is case-insensitive for the unit', () => {
    const { unit, ref } = parseCFUnits('Days Since 2000-01-01');
    expect(unit).toBe('days');
    expect(ref).toBe('2000-01-01');
  });

  it('throws an error for an invalid CF units string', () => {
    expect(() => parseCFUnits('invalid string')).toThrow('Invalid CF units');
  });
});

describe('decodeCFTime', () => {
  describe('gregorian / standard calendar', () => {
    it('decodes days offset of 0', () => {
      const result = decodeCFTime([0], 'days since 2000-01-01', 'standard');
      expect(result[0]).toContain('2000-01-01');
    });

    it('decodes sequential days', () => {
      const result = decodeCFTime([0, 1, 2], 'days since 2000-01-01', 'standard');
      expect(result[0]).toContain('2000-01-01');
      expect(result[1]).toContain('2000-01-02');
      expect(result[2]).toContain('2000-01-03');
    });

    it('correctly crosses month boundary', () => {
      const result = decodeCFTime([31], 'days since 2000-01-01', 'gregorian');
      expect(result[0]).toContain('2000-02-01');
    });

    it('handles hours unit', () => {
      const result = decodeCFTime([24], 'hours since 2000-01-01', 'standard');
      expect(result[0]).toContain('2000-01-02');
    });

    it('handles minutes unit', () => {
      const result = decodeCFTime([1440], 'minutes since 2000-01-01', 'standard');
      expect(result[0]).toContain('2000-01-02');
    });

    it('handles seconds unit', () => {
      const result = decodeCFTime([86400], 'seconds since 2000-01-01', 'standard');
      expect(result[0]).toContain('2000-01-02');
    });

    it('handles leap year February 29 on standard calendar', () => {
      // 2000 is a leap year; day 60 from 2000-01-01 = 2000-02-29
      const result = decodeCFTime([59], 'days since 2000-01-01', 'standard');
      expect(result[0]).toContain('2000-02-29');
    });
  });

  describe('noleap calendar', () => {
    it('skips Feb 29 — day 60 from 2000-01-01 is 2000-03-01', () => {
      // In noleap, February always has 28 days
      const result = decodeCFTime([59], 'days since 2000-01-01', 'noleap');
      expect(result[0]).toContain('2000-03-01');
    });

    it('365_day alias behaves the same as noleap', () => {
      const noleap = decodeCFTime([59], 'days since 2000-01-01', 'noleap');
      const day365 = decodeCFTime([59], 'days since 2000-01-01', '365_day');
      expect(noleap[0]).toBe(day365[0]);
    });
  });

  describe('all_leap calendar', () => {
    it('February always has 29 days', () => {
      // In all_leap, Feb has 29 days every year — day 60 from non-leap year start
      const result = decodeCFTime([59], 'days since 2001-01-01', 'all_leap');
      expect(result[0]).toContain('2001-02-29');
    });

    it('366_day alias behaves the same as all_leap', () => {
      const allLeap = decodeCFTime([59], 'days since 2001-01-01', 'all_leap');
      const day366 = decodeCFTime([59], 'days since 2001-01-01', '366_day');
      expect(allLeap[0]).toBe(day366[0]);
    });
  });

  describe('360_day calendar', () => {
    it('each month has exactly 30 days', () => {
      // Day 30 from 2000-01-01 should be 2000-02-01 in a 360-day calendar
      const result = decodeCFTime([30], 'days since 2000-01-01', '360_day');
      expect(result[0]).toContain('2000-02-01');
    });

    it('day 360 from 2000-01-01 wraps to 2001-01-01', () => {
      const result = decodeCFTime([360], 'days since 2000-01-01', '360_day');
      expect(result[0]).toContain('2001-01-01');
    });
  });

  describe('julian calendar', () => {
    it('decodes basic day offset', () => {
      const result = decodeCFTime([1], 'days since 2000-01-01', 'julian');
      expect(result[0]).toContain('2000-01-02');
    });
  });

  it('throws on unsupported time unit', () => {
    expect(() => decodeCFTime([0], 'weeks since 2000-01-01', 'standard')).toThrow(
      'Unsupported time unit'
    );
  });

  it('returns an array with the same length as the input', () => {
    const values = [0, 10, 20, 30, 40];
    const result = decodeCFTime(values, 'days since 2000-01-01', 'standard');
    expect(result).toHaveLength(values.length);
  });

  it('returns ISO date strings', () => {
    const result = decodeCFTime([0], 'days since 2000-01-01', 'standard');
    expect(result[0]).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
