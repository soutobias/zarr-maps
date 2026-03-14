import { describe, it, expect } from 'vitest';
import {
  identifyDimensionIndices,
  calculateSliceArgs,
  calculateNearestIndex,
  resolveNoDataRange,
  extractNoDataMetadata,
  detectCRS
} from './zarr-utils';
import * as zarr from 'zarrita';

describe('identifyDimensionIndices', () => {
  it('identifies lat, lon, time, and elevation by default aliases', () => {
    const dims = ['time', 'lat', 'lon'];
    const result = identifyDimensionIndices(dims);
    expect(result.lat).toMatchObject({ name: 'lat', index: 1 });
    expect(result.lon).toMatchObject({ name: 'lon', index: 2 });
    expect(result.time).toMatchObject({ name: 'time', index: 0 });
  });

  it('matches alternate latitude alias "latitude"', () => {
    const dims = ['latitude', 'longitude'];
    const result = identifyDimensionIndices(dims);
    expect(result.lat).toMatchObject({ name: 'latitude', index: 0 });
    expect(result.lon).toMatchObject({ name: 'longitude', index: 1 });
  });

  it('matches alternate latitude alias "y" and longitude alias "x"', () => {
    const dims = ['y', 'x'];
    const result = identifyDimensionIndices(dims);
    expect(result.lat).toMatchObject({ name: 'y', index: 0 });
    expect(result.lon).toMatchObject({ name: 'x', index: 1 });
  });

  it('matches elevation alias "depth"', () => {
    const dims = ['depth', 'lat', 'lon'];
    const result = identifyDimensionIndices(dims);
    expect(result.elevation).toMatchObject({ name: 'depth', index: 0 });
  });

  it('respects custom dimensionNames overrides', () => {
    const dims = ['mytime', 'mylat', 'mylon'];
    const result = identifyDimensionIndices(dims, {
      time: 'mytime',
      lat: 'mylat',
      lon: 'mylon'
    });
    expect(result.time).toMatchObject({ name: 'mytime', index: 0 });
    expect(result.lat).toMatchObject({ name: 'mylat', index: 1 });
    expect(result.lon).toMatchObject({ name: 'mylon', index: 2 });
  });

  it('handles "others" in dimensionNames', () => {
    const dims = ['lat', 'lon', 'scenario'];
    const result = identifyDimensionIndices(dims, { others: ['scenario'] });
    expect(result.scenario).toMatchObject({ name: 'scenario', index: 2 });
  });

  it('returns no entry for dimensions not present in the array', () => {
    const dims = ['lat', 'lon'];
    const result = identifyDimensionIndices(dims);
    expect(result.time).toBeUndefined();
    expect(result.elevation).toBeUndefined();
  });

  it('uses CF standard_name from coordinates to override aliases', () => {
    const dims = ['y_coord', 'x_coord'];
    const coordinates: Record<string, any> = {
      y_coord: { attrs: { standard_name: 'latitude' } },
      x_coord: { attrs: { standard_name: 'longitude' } }
    };
    const result = identifyDimensionIndices(dims, undefined, coordinates);
    expect(result.lat).toMatchObject({ name: 'y_coord', index: 0 });
    expect(result.lon).toMatchObject({ name: 'x_coord', index: 1 });
  });
});

describe('calculateSliceArgs', () => {
  it('assigns Zarr slice objects for lat and lon dimensions', () => {
    const shape = [100, 200];
    const dimIndices = {
      lat: { name: 'lat', index: 0, array: null },
      lon: { name: 'lon', index: 1, array: null }
    };
    const dataSlice = { startX: 10, endX: 50, startY: 20, endY: 80 };
    const selectors = {};

    const result = calculateSliceArgs(shape, dataSlice, dimIndices, selectors);

    expect(result[0]).toEqual(zarr.slice(20, 80));
    expect(result[1]).toEqual(zarr.slice(10, 50));
  });

  it('assigns scalar index for non-spatial dimensions', () => {
    const shape = [10, 100, 200];
    const dimIndices = {
      time: { name: 'time', index: 0, array: null },
      lat: { name: 'lat', index: 1, array: null },
      lon: { name: 'lon', index: 2, array: null }
    };
    const dataSlice = { startX: 0, endX: 50, startY: 0, endY: 50 };
    const selectors = { time: { selected: 5, type: 'index' as const } };

    const result = calculateSliceArgs(shape, dataSlice, dimIndices, selectors);

    expect(result[0]).toBe(5);
    expect(result[1]).toEqual(zarr.slice(0, 50));
    expect(result[2]).toEqual(zarr.slice(0, 50));
  });
});

describe('calculateNearestIndex', () => {
  it('returns the index of an exact match', () => {
    expect(calculateNearestIndex([1, 2, 3, 4, 5], 3)).toBe(2);
  });

  it('returns the index of the nearest value when no exact match', () => {
    expect(calculateNearestIndex([0, 10, 20, 30], 12)).toBe(1);
  });

  it('returns 0 for target below all values', () => {
    expect(calculateNearestIndex([10, 20, 30], 0)).toBe(0);
  });

  it('returns last index for target above all values', () => {
    expect(calculateNearestIndex([10, 20, 30], 100)).toBe(2);
  });

  it('works with Float64Array input', () => {
    const arr = new Float64Array([1.5, 2.5, 3.5]);
    expect(calculateNearestIndex(arr, 2.4)).toBe(1);
  });

  it('handles time strings by parsing as dates', () => {
    const times = ['2000-01-01T00:00:00Z', '2000-01-02T00:00:00Z', '2000-01-03T00:00:00Z'];
    expect(calculateNearestIndex(times, '2000-01-02T00:00:00Z')).toBe(1);
  });

  it('finds nearest time string when not exact', () => {
    const times = ['2000-01-01T00:00:00Z', '2000-01-05T00:00:00Z', '2000-01-10T00:00:00Z'];
    // 2000-01-04 is closer to 2000-01-05 than to 2000-01-01
    expect(calculateNearestIndex(times, '2000-01-04T00:00:00Z')).toBe(1);
  });
});

describe('resolveNoDataRange', () => {
  it('returns user-defined values when both are provided', () => {
    const result = resolveNoDataRange(-100, 100, -999, 999);
    expect(result).toEqual({ noDataMin: -100, noDataMax: 100 });
  });

  it('returns metadata values when user values are undefined', () => {
    const result = resolveNoDataRange(undefined, undefined, -500, 500);
    expect(result).toEqual({ noDataMin: -500, noDataMax: 500 });
  });

  it('returns fallback values when both user and metadata are undefined', () => {
    const result = resolveNoDataRange(undefined, undefined, undefined, undefined);
    expect(result).toEqual({ noDataMin: -9999, noDataMax: 9999 });
  });

  it('prefers user values over metadata values', () => {
    const result = resolveNoDataRange(0, 50, -999, 999);
    expect(result).toEqual({ noDataMin: 0, noDataMax: 50 });
  });

  it('falls back to defaults if only one metadata bound is defined', () => {
    // metadataMin defined but metadataMax is not — falls back to defaults
    const result = resolveNoDataRange(undefined, undefined, -100, undefined);
    expect(result).toEqual({ noDataMin: -9999, noDataMax: 9999 });
  });
});

describe('extractNoDataMetadata', () => {
  function makeZarrArray(attrs: Record<string, any>) {
    return { attrs } as unknown as zarr.Array<any>;
  }

  it('extracts valid_min and valid_max from attrs', () => {
    const arr = makeZarrArray({ valid_min: -50, valid_max: 50 });
    const result = extractNoDataMetadata(arr);
    expect(result.metadataMin).toBe(-50);
    expect(result.metadataMax).toBe(50);
    expect(result.fillValue).toBeUndefined();
    expect(result.useFillValue).toBe(false);
  });

  it('extracts _FillValue and sets useFillValue to true', () => {
    const arr = makeZarrArray({ _FillValue: -9999 });
    const result = extractNoDataMetadata(arr);
    expect(result.fillValue).toBe(-9999);
    expect(result.useFillValue).toBe(true);
  });

  it('extracts missing_value and sets useFillValue to true', () => {
    const arr = makeZarrArray({ missing_value: 1e20 });
    const result = extractNoDataMetadata(arr);
    expect(result.fillValue).toBe(1e20);
    expect(result.useFillValue).toBe(true);
  });

  it('prefers _FillValue over missing_value', () => {
    const arr = makeZarrArray({ _FillValue: -9999, missing_value: 1e20 });
    const result = extractNoDataMetadata(arr);
    expect(result.fillValue).toBe(-9999);
    expect(result.useFillValue).toBe(true);
  });

  it('returns undefined values when attrs is empty', () => {
    const arr = makeZarrArray({});
    const result = extractNoDataMetadata(arr);
    expect(result.metadataMin).toBeUndefined();
    expect(result.metadataMax).toBeUndefined();
    expect(result.fillValue).toBeUndefined();
    expect(result.useFillValue).toBe(false);
  });
});

describe('detectCRS', () => {
  function makeZarrArray(attrs: Record<string, any>) {
    return { attrs } as unknown as zarr.Array<any>;
  }

  it('returns CRS from multiscales attrs when present', async () => {
    const attrs = {
      multiscales: [{ datasets: [{ crs: 'EPSG:3857' }] }]
    };
    const result = await detectCRS(attrs, null);
    expect(result).toBe('EPSG:3857');
  });

  it('returns CRS from array attrs when present', async () => {
    const arr = makeZarrArray({ crs: 'EPSG:3857' });
    const result = await detectCRS({}, arr);
    expect(result).toBe('EPSG:3857');
  });

  it('returns EPSG:4326 when no CRS attribute and no xyLimits', async () => {
    const result = await detectCRS({}, null);
    expect(result).toBe('EPSG:4326');
  });

  it('returns EPSG:4326 when xMax is within degree range', async () => {
    const xyLimits = { xMin: -180, xMax: 180, yMin: -90, yMax: 90 };
    const result = await detectCRS({}, null, xyLimits);
    expect(result).toBe('EPSG:4326');
  });

  it('returns EPSG:3857 when xMax exceeds degree range', async () => {
    const xyLimits = { xMin: -20037508, xMax: 20037508, yMin: -20037508, yMax: 20037508 };
    const result = await detectCRS({}, null, xyLimits);
    expect(result).toBe('EPSG:3857');
  });
});
