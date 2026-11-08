const SCRIPT_ID = "yandex-maps-v2";
const SCRIPT_TIMEOUT_MS = 12_000;

export type LngLat = [lng: number, lat: number];
export type LngLatBounds = [LngLat, LngLat];

export type YandexMarker = {
  element: HTMLElement;
  update: (props: { zIndex?: number }) => void;
  remove: () => void;
};

export type YandexMap = {
  bounds?: LngLatBounds;
  center: LngLat;
  zoom: number;
  setLocation: (location: { center: LngLat; zoom: number }) => void;
  destroy: () => void;
  addMarker: (input: {
    coordinates: LngLat;
    element: HTMLElement;
    zIndex?: number;
    shape: [[number, number], [number, number]];
    onClick?: () => void;
    onEnter?: () => void;
    onLeave?: () => void;
  }) => YandexMarker;
  onClick: (handler: () => void) => void;
  onMove: (handler: () => void) => void;
  onIdle: (handler: () => void) => void;
  onResize: (handler: () => void) => void;
};

type RawPlacemark = {
  options: { set: (key: string, value: unknown) => void };
  events: { add: (name: string, handler: () => void) => void };
};

type RawMap = {
  geoObjects: { add: (mark: RawPlacemark) => void; remove: (mark: RawPlacemark) => void };
  behaviors: { disable: (name: string) => void };
  controls: { get: (name: string) => { options: { set: (key: string, value: unknown) => void } } | null };
  events: { add: (name: string, handler: () => void) => void };
  container: { events: { add: (name: string, handler: () => void) => void }; fitToViewport: () => void };
  getBounds: () => [[number, number], [number, number]] | null;
  getCenter: () => [number, number];
  getZoom: () => number;
  setCenter: (center: [number, number], zoom: number) => void;
  destroy: () => void;
};

type LayoutInstance = { getParentElement: () => HTMLElement };
type LayoutClass = { superclass: { build: (this: LayoutInstance) => void; clear: (this: LayoutInstance) => void } };

type YMaps = {
  ready: (callback: () => void) => void;
  Map: new (
    element: HTMLElement,
    state: { center: [number, number]; zoom: number; controls: string[] },
    options?: Record<string, unknown>,
  ) => RawMap;
  Placemark: new (coords: [number, number], properties: Record<string, unknown>, options: Record<string, unknown>) => RawPlacemark;
  templateLayoutFactory: {
    createClass: (template: string, overrides: Record<string, unknown>) => LayoutClass;
  };
};

declare global {
  interface Window {
    ymaps?: YMaps;
  }
}

/**
 * The JavaScript API key is public in the browser. Restrict it by HTTP referrer in the Yandex cabinet.
 * API 3 rejects a key until that referrer field is saved. API 2.1 accepts this key and is the map we load.
 */
export function yandexMapsJsApiKey() {
  return (import.meta.env.VITE_YANDEX_MAPS_JS_API_KEY as string | undefined)?.trim() ?? "";
}

let loading: Promise<YMaps> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Yandex Maps timed out")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("Yandex Maps failed"));
      },
    );
  });
}

export function loadYandexMaps() {
  const key = yandexMapsJsApiKey();
  if (!key) return Promise.reject(new Error("Yandex Maps key is empty"));
  if (window.ymaps) {
    return withTimeout(new Promise<YMaps>((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    }), SCRIPT_TIMEOUT_MS);
  }
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
      script.onload = () => {
        const api = window.ymaps;
        if (!api) {
          loading = null;
          reject(new Error("Yandex Maps did not start"));
          return;
        }
        api.ready(() => resolve(api));
      };
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error("Yandex Maps script failed"));
      };
      document.head.appendChild(script);
    });
  }
  return withTimeout(loading, SCRIPT_TIMEOUT_MS);
}

function elementLayout(ymaps: YMaps, element: HTMLElement) {
  const Layout = ymaps.templateLayoutFactory.createClass("<div></div>", {
    build(this: LayoutInstance) {
      Layout.superclass.build.call(this);
      this.getParentElement().appendChild(element);
    },
    clear(this: LayoutInstance) {
      element.remove();
      Layout.superclass.clear.call(this);
    },
  });
  return Layout;
}

function wrapMap(ymaps: YMaps, raw: RawMap): YandexMap {
  raw.behaviors.disable("scrollZoom");
  const zoom = raw.controls.get("zoomControl");
  zoom?.options.set("size", "small");
  zoom?.options.set("position", { left: 12, top: 12 });
  return {
    get bounds(): LngLatBounds | undefined {
      const box = raw.getBounds();
      if (!box) return undefined;
      return [
        [box[0][1], box[0][0]],
        [box[1][1], box[1][0]],
      ];
    },
    get center(): LngLat {
      const point = raw.getCenter();
      return [point[1], point[0]];
    },
    get zoom() {
      return raw.getZoom();
    },
    setLocation(location) {
      raw.setCenter([location.center[1], location.center[0]], location.zoom);
    },
    destroy() {
      raw.destroy();
    },
    addMarker(input) {
      const placemark = new ymaps.Placemark([input.coordinates[1], input.coordinates[0]], {}, {
        iconLayout: elementLayout(ymaps, input.element),
        iconShape: { type: "Rectangle", coordinates: input.shape },
        zIndex: input.zIndex ?? 0,
        cursor: "pointer",
        hasBalloon: false,
        hasHint: false,
      });
      raw.geoObjects.add(placemark);
      if (input.onClick) placemark.events.add("click", input.onClick);
      if (input.onEnter) placemark.events.add("mouseenter", input.onEnter);
      if (input.onLeave) placemark.events.add("mouseleave", input.onLeave);
      return {
        element: input.element,
        update(props) {
          if (props.zIndex != null) placemark.options.set("zIndex", props.zIndex);
        },
        remove() {
          raw.geoObjects.remove(placemark);
        },
      };
    },
    onClick(handler) {
      raw.events.add("click", handler);
    },
    onMove(handler) {
      raw.events.add("actiontick", handler);
      raw.events.add("boundschange", handler);
    },
    onIdle(handler) {
      raw.events.add("actionend", handler);
    },
    onResize(handler) {
      raw.container.events.add("sizechange", () => {
        raw.container.fitToViewport();
        handler();
      });
    },
  };
}

/** The map pane should not take arrow keys. Copyright links stay reachable. */
export function quietMapChrome(node: HTMLElement) {
  for (const el of node.querySelectorAll<HTMLElement>("[tabindex]")) {
    if (el.tagName !== "A") el.tabIndex = -1;
  }
}

export function mountYandexMap(ymaps: YMaps, node: HTMLElement, center: LngLat, zoom: number) {
  const raw = new ymaps.Map(node, {
    center: [center[1], center[0]],
    zoom,
    controls: ["zoomControl"],
  }, {
    suppressMapOpenBlock: false,
    yandexMapDisablePoiInteractivity: true,
    minZoom: 2,
    maxZoom: 19,
  });
  return wrapMap(ymaps, raw);
}
