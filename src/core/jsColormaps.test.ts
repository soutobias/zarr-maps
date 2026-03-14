import { describe, it, expect } from 'vitest';
import { colormapBuilder, allColorScales, colorScaleByName } from './jsColormaps';

describe('allColorScales', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(allColorScales)).toBe(true);
    expect(allColorScales.length).toBeGreaterThan(0);
  });

  it('includes common colormaps', () => {
    const expected = ['viridis', 'jet', 'plasma', 'inferno', 'magma', 'RdBu', 'Blues'];
    for (const name of expected) {
      expect(allColorScales).toContain(name);
    }
  });

  it('includes reversed variants (ending in _r)', () => {
    const reversed = allColorScales.filter(name => name.endsWith('_r'));
    expect(reversed.length).toBeGreaterThan(0);
  });
});

describe('colormapBuilder', () => {
  it('returns 255 colors by default for viridis', () => {
    const colors = colormapBuilder('viridis');
    expect(colors).toHaveLength(255);
  });

  it('returns the specified number of colors', () => {
    const colors = colormapBuilder('plasma', '', 10);
    expect(colors).toHaveLength(10);
  });

  it('returns arrays of RGB values by default', () => {
    const colors = colormapBuilder('viridis', '', 5) as number[][];
    expect(colors[0]).toHaveLength(3);
    colors.forEach(c => {
      expect(c[0]).toBeGreaterThanOrEqual(0);
      expect(c[1]).toBeGreaterThanOrEqual(0);
      expect(c[2]).toBeGreaterThanOrEqual(0);
      expect(c[0]).toBeLessThanOrEqual(255);
      expect(c[1]).toBeLessThanOrEqual(255);
      expect(c[2]).toBeLessThanOrEqual(255);
    });
  });

  it('returns hex strings when convertTo is "hex"', () => {
    const colors = colormapBuilder('viridis', 'hex', 5) as string[];
    colors.forEach(c => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('returns css rgb() strings when convertTo is "css" and opacity is 1', () => {
    const colors = colormapBuilder('viridis', 'css', 5) as string[];
    colors.forEach(c => {
      expect(c).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    });
  });

  it('returns css rgba() strings when convertTo is "css" and opacity < 1', () => {
    const colors = colormapBuilder('viridis', 'css', 5, 0.5) as string[];
    colors.forEach(c => {
      expect(c).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
    });
  });

  it('appends an opacity channel when opacity < 1', () => {
    const colors = colormapBuilder('viridis', '', 5, 0.8) as number[][];
    colors.forEach(c => {
      expect(c).toHaveLength(4);
      expect(c[3]).toBeCloseTo(0.8, 5);
    });
  });

  it('works for a reversed colormap (viridis_r)', () => {
    const forward = colormapBuilder('viridis', '', 5) as number[][];
    const reversed = colormapBuilder('viridis_r', '', 5) as number[][];
    // The first color of viridis should approximately match the last color of viridis_r
    expect(forward[0][0]).toBeCloseTo(reversed[4][0], 0);
  });

  it('works for every colormap in allColorScales without throwing', () => {
    for (const name of allColorScales) {
      expect(() => colormapBuilder(name, '', 10)).not.toThrow();
    }
  });
});

describe('colorScaleByName', () => {
  it('returns a callable function', () => {
    const fn = colorScaleByName('viridis');
    expect(typeof fn).toBe('function');
  });

  it('returns an RGB array when called with a value in [0, 1]', () => {
    const fn = colorScaleByName('viridis');
    const color = fn(0.5) as number[];
    expect(color).toHaveLength(3);
    color.forEach(c => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    });
  });
});
