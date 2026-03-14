import { describe, it, expect } from 'vitest';
import { lonDegToMercX, latDegToMercY } from './mercator-utils';
import { EARTH_RADIUS, MAX_LAT } from './constants';

describe('lonDegToMercX', () => {
  it('returns 0 for longitude 0', () => {
    expect(lonDegToMercX(0)).toBe(0);
  });

  it('converts 180 degrees to the correct Mercator X', () => {
    const expected = EARTH_RADIUS * Math.PI;
    expect(lonDegToMercX(180)).toBeCloseTo(expected, 5);
  });

  it('converts -180 degrees to the negative Mercator X', () => {
    const expected = -EARTH_RADIUS * Math.PI;
    expect(lonDegToMercX(-180)).toBeCloseTo(expected, 5);
  });

  it('converts 90 degrees correctly', () => {
    const expected = (EARTH_RADIUS * 90 * Math.PI) / 180;
    expect(lonDegToMercX(90)).toBeCloseTo(expected, 5);
  });

  it('is linear (additive)', () => {
    expect(lonDegToMercX(20) + lonDegToMercX(30)).toBeCloseTo(lonDegToMercX(50), 5);
  });
});

describe('latDegToMercY', () => {
  it('returns 0 for latitude 0 (equator)', () => {
    expect(latDegToMercY(0)).toBeCloseTo(0, 5);
  });

  it('returns a positive value for northern latitudes', () => {
    expect(latDegToMercY(45)).toBeGreaterThan(0);
  });

  it('returns a negative value for southern latitudes', () => {
    expect(latDegToMercY(-45)).toBeLessThan(0);
  });

  it('clamps latitudes above MAX_LAT to MAX_LAT', () => {
    const atMax = latDegToMercY(MAX_LAT);
    const aboveMax = latDegToMercY(MAX_LAT + 5);
    expect(aboveMax).toBeCloseTo(atMax, 5);
  });

  it('clamps latitudes below -MAX_LAT to -MAX_LAT', () => {
    const atNegMax = latDegToMercY(-MAX_LAT);
    const belowNegMax = latDegToMercY(-MAX_LAT - 5);
    expect(belowNegMax).toBeCloseTo(atNegMax, 5);
  });

  it('is symmetric: latDegToMercY(lat) === -latDegToMercY(-lat)', () => {
    const lat = 30;
    expect(latDegToMercY(lat)).toBeCloseTo(-latDegToMercY(-lat), 5);
  });
});
