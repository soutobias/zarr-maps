// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import L from 'leaflet';
import { ZarrLayer } from './zarr-layer';

// Use a plain class for the mock so it is constructable with `new`
vi.mock('../core/zarr-layer-provider', () => {
  class ZarrLayerProvider {
    public constructorOpts: any;
    public readyPromise: Promise<boolean>;
    public cacheKey = 'mock-key';

    constructor(opts: any) {
      this.constructorOpts = opts;
      this.readyPromise = Promise.resolve(true);
    }

    updateStyle(_opts: any) {
      return false;
    }
    updateSelectors(_selectors: any) {
      return false;
    }
    destroy() {}
  }
  return { ZarrLayerProvider };
});

const baseOptions = {
  id: 'test-layer',
  url: 'http://example.com/zarr',
  variable: 'temperature'
};

describe('Leaflet ZarrLayer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates a ZarrLayerProvider with the provided url and variable', () => {
      const layer = new ZarrLayer(baseOptions);
      const provider = layer.provider as any;
      expect(provider.constructorOpts).toMatchObject({
        url: baseOptions.url,
        variable: baseOptions.variable
      });
    });

    it('uses default tileSize of 256 when not specified', () => {
      const layer = new ZarrLayer(baseOptions);
      expect((layer.provider as any).constructorOpts.tileSize).toBe(256);
    });

    it('uses the custom tileSize when specified', () => {
      const layer = new ZarrLayer({ ...baseOptions, tileSize: 512 });
      expect((layer.provider as any).constructorOpts.tileSize).toBe(512);
    });

    it('passes colormap to the provider', () => {
      const layer = new ZarrLayer({ ...baseOptions, colormap: 'plasma' });
      expect((layer.provider as any).constructorOpts.colormap).toBe('plasma');
    });

    it('passes scale to the provider', () => {
      const layer = new ZarrLayer({ ...baseOptions, scale: [-5, 5] as [number, number] });
      expect((layer.provider as any).constructorOpts.scale).toEqual([-5, 5]);
    });

    it('passes selectors to the provider', () => {
      const selectors = { time: { selected: 3, type: 'index' as const } };
      const layer = new ZarrLayer({ ...baseOptions, selectors });
      expect((layer.provider as any).constructorOpts.selectors).toEqual(selectors);
    });

    it('exposes the provider instance as a public property', () => {
      const layer = new ZarrLayer(baseOptions);
      expect(layer.provider).toBeDefined();
    });

    it('is an instance of L.GridLayer', () => {
      const layer = new ZarrLayer(baseOptions);
      expect(layer).toBeInstanceOf(L.GridLayer);
    });
  });

  describe('load()', () => {
    it('returns true when the provider is ready', async () => {
      const layer = new ZarrLayer(baseOptions);
      const result = await layer.load();
      expect(result).toBe(true);
    });

    it('returns false when the provider initialization fails', async () => {
      const layer = new ZarrLayer(baseOptions);
      (layer.provider as any).readyPromise = Promise.resolve(false);
      const result = await layer.load();
      expect(result).toBe(false);
    });
  });

  describe('updateStyle()', () => {
    it('calls provider.updateStyle with scale and colormap', () => {
      const layer = new ZarrLayer(baseOptions);
      const spy = vi.spyOn(layer.provider, 'updateStyle');
      layer.updateStyle({ scale: [0, 10], colormap: 'plasma' });
      expect(spy).toHaveBeenCalledWith({ scale: [0, 10], colormap: 'plasma' });
    });

    it('does not redraw when the style is unchanged', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateStyle').mockReturnValue(false);
      const redrawSpy = vi.spyOn(layer, 'redraw').mockReturnValue(layer);
      layer.updateStyle({ colormap: 'viridis' });
      expect(redrawSpy).not.toHaveBeenCalled();
    });

    it('redraws when the style changes', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateStyle').mockReturnValue(true);
      const redrawSpy = vi.spyOn(layer, 'redraw').mockReturnValue(layer);
      layer.updateStyle({ colormap: 'jet' });
      expect(redrawSpy).toHaveBeenCalled();
    });

    it('calls setOpacity when opacity is provided', () => {
      const layer = new ZarrLayer(baseOptions);
      const setOpacitySpy = vi.spyOn(layer, 'setOpacity').mockImplementation(() => layer);
      layer.updateStyle({ opacity: 0.5 });
      expect(setOpacitySpy).toHaveBeenCalledWith(0.5);
    });

    it('does not call setOpacity when opacity is not provided', () => {
      const layer = new ZarrLayer(baseOptions);
      const setOpacitySpy = vi.spyOn(layer, 'setOpacity').mockImplementation(() => layer);
      layer.updateStyle({ colormap: 'viridis' });
      expect(setOpacitySpy).not.toHaveBeenCalled();
    });

    it('can update scale only', () => {
      const layer = new ZarrLayer(baseOptions);
      const spy = vi.spyOn(layer.provider, 'updateStyle');
      layer.updateStyle({ scale: [-3, 3] });
      expect(spy).toHaveBeenCalledWith({ scale: [-3, 3], colormap: undefined });
    });
  });

  describe('updateSelectors()', () => {
    it('calls provider.updateSelectors with the given selectors', () => {
      const layer = new ZarrLayer(baseOptions);
      const spy = vi.spyOn(layer.provider, 'updateSelectors');
      const selectors = { time: { selected: 5, type: 'index' as const } };
      layer.updateSelectors(selectors);
      expect(spy).toHaveBeenCalledWith(selectors);
    });

    it('does not redraw when selectors are unchanged', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateSelectors').mockReturnValue(false);
      const redrawSpy = vi.spyOn(layer, 'redraw').mockReturnValue(layer);
      layer.updateSelectors({ time: { selected: 0 } });
      expect(redrawSpy).not.toHaveBeenCalled();
    });

    it('redraws when selectors change', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateSelectors').mockReturnValue(true);
      const redrawSpy = vi.spyOn(layer, 'redraw').mockReturnValue(layer);
      layer.updateSelectors({ time: { selected: 3, type: 'index' as const } });
      expect(redrawSpy).toHaveBeenCalled();
    });

    it('supports value-based selectors', () => {
      const layer = new ZarrLayer(baseOptions);
      const spy = vi.spyOn(layer.provider, 'updateSelectors');
      const selectors = { time: { selected: '2023-01-01T00:00:00Z', type: 'value' as const } };
      layer.updateSelectors(selectors);
      expect(spy).toHaveBeenCalledWith(selectors);
    });
  });

  describe('onRemove()', () => {
    it('calls provider.destroy when removed from map', () => {
      const layer = new ZarrLayer(baseOptions);
      const destroySpy = vi.spyOn(layer.provider, 'destroy');
      // Stub the parent class onRemove to avoid DOM operations on an unmounted layer
      vi.spyOn(L.GridLayer.prototype as any, 'onRemove').mockReturnValue(layer);
      layer.onRemove({} as any);
      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
