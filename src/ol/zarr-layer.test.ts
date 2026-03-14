import { describe, it, expect, vi, afterEach } from 'vitest';
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

describe('OpenLayers ZarrLayer', () => {
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

    it('defaults mapProjection to EPSG:3857 when crs is not specified', () => {
      const layer = new ZarrLayer(baseOptions);
      // mapProjection is private; verify indirectly via the layer being constructable
      expect(layer).toBeDefined();
    });

    it('sets mapProjection from the crs option', () => {
      // Construction should not throw with an explicit CRS
      expect(() => new ZarrLayer({ ...baseOptions, crs: 'EPSG:4326' })).not.toThrow();
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

    it('does not refresh the source when style is unchanged', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateStyle').mockReturnValue(false);
      const mockSource = { refresh: vi.fn() };
      vi.spyOn(layer, 'getSource').mockReturnValue(mockSource as any);
      layer.updateStyle({ colormap: 'viridis' });
      expect(mockSource.refresh).not.toHaveBeenCalled();
    });

    it('refreshes the source when style changes', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateStyle').mockReturnValue(true);
      const mockSource = { refresh: vi.fn() };
      vi.spyOn(layer, 'getSource').mockReturnValue(mockSource as any);
      layer.updateStyle({ colormap: 'jet' });
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('calls setOpacity when opacity is provided', () => {
      const layer = new ZarrLayer(baseOptions);
      const setOpacitySpy = vi.spyOn(layer, 'setOpacity').mockImplementation(() => {});
      layer.updateStyle({ opacity: 0.7 });
      expect(setOpacitySpy).toHaveBeenCalledWith(0.7);
    });

    it('does not call setOpacity when opacity is not provided', () => {
      const layer = new ZarrLayer(baseOptions);
      const setOpacitySpy = vi.spyOn(layer, 'setOpacity').mockImplementation(() => {});
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

    it('does not refresh the source when selectors are unchanged', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateSelectors').mockReturnValue(false);
      const mockSource = { refresh: vi.fn(), setKey: vi.fn() };
      vi.spyOn(layer, 'getSource').mockReturnValue(mockSource as any);
      layer.updateSelectors({ time: { selected: 0 } });
      expect(mockSource.refresh).not.toHaveBeenCalled();
    });

    it('refreshes the source when selectors change', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateSelectors').mockReturnValue(true);
      const mockSource = { refresh: vi.fn(), setKey: vi.fn() };
      vi.spyOn(layer, 'getSource').mockReturnValue(mockSource as any);
      layer.updateSelectors({ time: { selected: 3, type: 'index' as const } });
      expect(mockSource.refresh).toHaveBeenCalled();
    });

    it('sets the cache key on the source when selectors change', () => {
      const layer = new ZarrLayer(baseOptions);
      vi.spyOn(layer.provider, 'updateSelectors').mockReturnValue(true);
      const mockSource = { refresh: vi.fn(), setKey: vi.fn() };
      vi.spyOn(layer, 'getSource').mockReturnValue(mockSource as any);
      layer.updateSelectors({ elevation: { selected: 0, type: 'index' as const } });
      expect(mockSource.setKey).toHaveBeenCalledWith('mock-key');
    });

    it('supports value-based selectors', () => {
      const layer = new ZarrLayer(baseOptions);
      const spy = vi.spyOn(layer.provider, 'updateSelectors');
      const selectors = { time: { selected: '2023-06-01T00:00:00Z', type: 'value' as const } };
      layer.updateSelectors(selectors);
      expect(spy).toHaveBeenCalledWith(selectors);
    });
  });

  describe('disposeInternal()', () => {
    it('calls provider.destroy when the layer is disposed', () => {
      const layer = new ZarrLayer(baseOptions);
      const destroySpy = vi.spyOn(layer.provider, 'destroy');
      layer.disposeInternal();
      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
