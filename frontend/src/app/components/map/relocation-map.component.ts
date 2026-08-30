import {
  Component, Input, Output, EventEmitter, OnChanges, OnDestroy,
  SimpleChanges, ElementRef, ViewChild, AfterViewInit, signal
} from '@angular/core';
import { environment } from '../../../environments/environment';
import type { Property } from '../../core/models/relocation.models';

const MAPBOX_TOKEN: string = environment.mapboxToken;

const DEFAULT_OFFICE: [number, number] = [88.4335, 22.5762];

const OSM_RASTER_STYLE: any = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap, © CARTO',
    },
  },
  layers: [{ id: 'carto-voyager-layer', type: 'raster', source: 'carto-voyager', minzoom: 0, maxzoom: 19 }],
};

let mapboxglCache: typeof import('mapbox-gl') | null = null;

async function fetchIsochrone(coords: [number, number]): Promise<any> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const r = await fetch(
      `https://api.mapbox.com/isochrone/v1/mapbox/driving/${coords[0]},${coords[1]}` +
      `?contours_minutes=10,20,30&polygons=true&access_token=${MAPBOX_TOKEN}`
    );
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function fetchRoute(from: [number, number], to: [number, number]): Promise<any> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const r = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving` +
      `/${from[0]},${from[1]};${to[0]},${to[1]}` +
      `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d?.routes?.[0]?.geometry ?? null;
  } catch { return null; }
}

function spreadDupe(coordinates: [number, number], counter: Map<string, number>): [number, number] {
  const [lon, lat] = coordinates;
  const key = `${lon.toFixed(5)}:${lat.toFixed(5)}`;
  const idx = counter.get(key) ?? 0;
  counter.set(key, idx + 1);
  if (idx === 0) return [lon, lat];
  const angle = idx * 137.5;
  const radius = Math.min(0.012, 0.0022 * idx);
  const rad = (angle * Math.PI) / 180;
  return [
    lon + (radius * Math.cos(rad)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180)),
    lat + radius * Math.sin(rad),
  ];
}

@Component({
  selector: 'app-relocation-map',
  standalone: true,
  host: { style: 'display:block;width:100%;height:100%;' },
  templateUrl: './relocation-map.component.html',
  styleUrl: './relocation-map.component.scss',
})
export class RelocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') mapContainerRef!: ElementRef<HTMLDivElement>;

  @Input() properties?: Property[];
  @Input() activePropertyIndex?: number;
  @Input() officeCoordinates?: [number, number];
  @Input() officeLabel?: string;
  @Output() markerClick = new EventEmitter<number>();

  mapReady = signal(false);
  cafeOn = signal(false);
  transitOn = signal(false);

  private map: any = null;
  private mgl: any = null;
  private markers: any[] = [];
  private popup: any = null;
  private routeTimer: any = null;
  private cancelled = false;
  private initDone = false;

  private get office(): [number, number] { return this.officeCoordinates ?? DEFAULT_OFFICE; }

  private get pins(): Property[] {
    return (this.properties?.filter((p) => p.location?.coordinates) ?? []).slice(0, 12);
  }

  ngAfterViewInit(): void {
    void this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['properties'] && !changes['properties'].firstChange && this.initDone) {
      this.reloadMarkers();
    }
    if (changes['activePropertyIndex'] && !changes['activePropertyIndex'].firstChange) {
      void this.flyToActive();
    }
  }

  ngOnDestroy(): void {
    this.cancelled = true;
    if (this.routeTimer) clearInterval(this.routeTimer);
    this.markers.forEach((m) => m.remove());
    this.popup?.remove();
    this.map?.remove();
    this.map = null;
  }

  toggleCafe(): void {
    const on = !this.cafeOn();
    this.cafeOn.set(on);
    try { this.map?.setLayoutProperty('poi-label', 'visibility', on ? 'visible' : 'none'); } catch {}
  }

  toggleTransit(): void {
    const on = !this.transitOn();
    this.transitOn.set(on);
    try { this.map?.setLayoutProperty('transit-label', 'visibility', on ? 'visible' : 'none'); } catch {}
  }

  private async initMap(): Promise<void> {
    const container = this.mapContainerRef?.nativeElement;
    if (!container) return;

    // Dynamically import mapbox-gl
    if (!mapboxglCache) {
      mapboxglCache = await import('mapbox-gl');
    }
    if (this.cancelled) return;
    this.mgl = mapboxglCache;

    // Set access token
    (this.mgl as any).default.accessToken = MAPBOX_TOKEN;

    this.map = new (this.mgl as any).default.Map({
      container,
      style: MAPBOX_TOKEN
        ? 'mapbox://styles/mapbox/light-v11'
        : OSM_RASTER_STYLE,
      center: this.office,
      zoom: 12,
      attributionControl: false,
    });

    this.map.addControl(
      new (this.mgl as any).default.NavigationControl({ visualizePitch: false }),
      'top-right'
    );

    this.map.on('error', (e: any) => {
      console.warn('Mapbox warning:', e?.error?.message ?? e);
    });

    this.map.on('load', async () => {
      if (this.cancelled) return;
      this.mapReady.set(true);
      this.initDone = true;

      // Force layout resize calculation
      setTimeout(() => this.map?.resize(), 100);
      setTimeout(() => this.map?.resize(), 500);

      // Observe container size changes
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          if (this.map) this.map.resize();
        });
        ro.observe(container);
      }

      // Hide POI & transit by default
      try { this.map.setLayoutProperty('poi-label', 'visibility', 'none'); } catch {}
      try { this.map.setLayoutProperty('transit-label', 'visibility', 'none'); } catch {}

      // Isochrone commute rings
      const iso = await fetchIsochrone(this.office);
      if (!this.cancelled && iso?.features?.length) {
        const sorted = [...iso.features].sort(
          (a: any, b: any) => (b.properties?.contour ?? 0) - (a.properties?.contour ?? 0)
        );
        const RING = [
          { fill: 'hsla(228,72%,58%,0.055)', line: 'hsla(228,72%,58%,0.18)' },
          { fill: 'hsla(228,72%,58%,0.09)',  line: 'hsla(228,72%,58%,0.26)' },
          { fill: 'hsla(228,72%,58%,0.13)',  line: 'hsla(228,72%,58%,0.38)' },
        ];
        sorted.forEach((feat: any, i: number) => {
          const r = RING[i] ?? RING[RING.length - 1];
          try {
            this.map.addSource(`iso-src-${i}`, { type: 'geojson', data: feat });
            this.map.addLayer({ id: `iso-fill-${i}`, type: 'fill', source: `iso-src-${i}`, paint: { 'fill-color': r.fill } });
            this.map.addLayer({ id: `iso-border-${i}`, type: 'line', source: `iso-src-${i}`,
              paint: { 'line-color': r.line, 'line-width': 1.5, 'line-dasharray': [3, 2] } });
          } catch {}
        });
      }

      // Empty route layers
      try {
        this.map.addSource('route-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        this.map.addLayer({ id: 'route-bg', type: 'line', source: 'route-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': 'hsl(228,72%,78%)', 'line-width': 5, 'line-opacity': 0.28 } });
        this.map.addLayer({ id: 'route-line', type: 'line', source: 'route-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': 'hsl(228,72%,56%)', 'line-width': 3.2, 'line-opacity': 0.92,
                   'line-dasharray': [0, 4, 3] } });
      } catch {}

      // Office marker
      const offEl = document.createElement('div');
      offEl.style.cssText = [
        'background:hsl(228,72%,58%)', 'color:white', 'padding:4px 10px',
        'border-radius:999px', 'font-size:11px', 'font-weight:700',
        "font-family:'Inter',system-ui,sans-serif", 'white-space:nowrap',
        'box-shadow:0 2px 8px hsl(228 72% 58% / 0.4)',
        'border:2px solid white',
      ].join(';');
      offEl.textContent = this.officeLabel?.trim() || 'Office';

      new (this.mgl as any).default.Marker({ element: offEl, anchor: 'bottom' })
        .setLngLat(this.office)
        .addTo(this.map);

      // Property markers
      this.addPropertyMarkers();
    });
  }

  private addPropertyMarkers(): void {
    // Remove old markers
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    const counter = new Map<string, number>();

    this.pins.forEach((property, idx) => {
      const coords = property.location?.coordinates;
      if (!coords) return;
      const pos = spreadDupe(coords, counter);

      const el = document.createElement('button');
      el.type = 'button';
      el.style.cssText = [
        'width:28px', 'height:28px', 'border-radius:50%',
        'background:hsl(228,72%,58%)', 'color:white',
        'font-size:11px', 'font-weight:800',
        'display:flex', 'align-items:center', 'justify-content:center',
        'border:2.5px solid white',
        'box-shadow:0 2px 8px hsl(215 25% 8% / 0.25)',
        'cursor:pointer', 'opacity:0',
        'transform:scale(0.3) translateY(16px)',
      ].join(';');
      el.textContent = String(idx + 1);
      el.setAttribute('aria-label', property.title);
      el.addEventListener('click', () => this.markerClick.emit(idx));

      // Staggered entrance animation
      setTimeout(() => {
        el.style.transition = 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        el.style.opacity = '1';
        el.style.transform = 'scale(1) translateY(0)';
      }, 420 + idx * 65);

      const marker = new (this.mgl as any).default.Marker({ element: el, anchor: 'center' })
        .setLngLat(pos)
        .addTo(this.map);
      this.markers.push(marker);
    });

    // Fit map bounds to show office + all pins
    if (this.markers.length > 0) {
      const bounds = new (this.mgl as any).default.LngLatBounds(this.office, this.office);
      this.pins.forEach((p) => { if (p.location?.coordinates) bounds.extend(p.location.coordinates); });
      this.map.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 450, right: 60 },
        maxZoom: 13,
        duration: 1400,
      });
    }
  }

  private reloadMarkers(): void {
    if (!this.map || !this.mapReady()) return;
    this.addPropertyMarkers();
  }

  private async flyToActive(): Promise<void> {
    const idx = this.activePropertyIndex;
    if (idx === undefined || idx === null) return;
    if (!this.map || !this.mgl || !this.mapReady()) return;

    const prop = this.pins[idx];
    if (!prop?.location?.coordinates) return;

    const counter = new Map<string, number>();
    this.pins.slice(0, idx).forEach((p) => { if (p.location?.coordinates) spreadDupe(p.location.coordinates, counter); });
    const pos = spreadDupe(prop.location.coordinates, counter);

    // Close old popup
    this.popup?.remove();
    this.popup = null;

    // Highlight active marker
    this.markers.forEach((m, i) => {
      const el = m.getElement();
      const isActive = i === idx;
      el.style.background = isActive ? 'hsl(25,90%,58%)' : 'hsl(228,72%,58%)';
      el.style.transform = isActive ? 'scale(1.25)' : 'scale(1)';
      el.style.zIndex = isActive ? '10' : '1';
    });

    // Stop old route animation
    if (this.routeTimer) { clearInterval(this.routeTimer); this.routeTimer = null; }

    // Fly to property
    this.map.flyTo({
      center: pos,
      zoom: 14,
      duration: 900,
      essential: true,
      padding: { left: 450, top: 80, right: 80, bottom: 80 },
    } as any);

    // Clear previous route
    try { (this.map.getSource('route-src') as any)?.setData({ type: 'FeatureCollection', features: [] }); } catch {}

    // Fetch & draw route
    const geom = await fetchRoute(this.office, pos);
    if (!geom || !this.map) return;

    try {
      (this.map.getSource('route-src') as any)?.setData({ type: 'Feature', properties: {}, geometry: geom });

      // Animated flowing dash
      const DASH = [[0,4,3],[0.5,4,3],[1,4,3],[1.5,4,3],[2,4,3],[2.5,4,3],[3,4,3],[3.5,4,3]];
      let step = 0;
      this.routeTimer = setInterval(() => {
        if (!this.map?.getLayer?.('route-line')) return;
        try { this.map.setPaintProperty('route-line', 'line-dasharray', DASH[step % DASH.length]); } catch {}
        step++;
      }, 80);
    } catch {}

    // Popup after fly settles
    const priceK = Math.round(prop.rent / 1000);
    const locality = [prop.locality, prop.city].filter(Boolean).join(', ');
    const commuteTag = prop.commute_estimate_minutes
      ? `<span class="relo-popup-tag relo-popup-tag-commute">⏱ ${prop.commute_estimate_minutes}\u202fmin</span>` : '';
    const distTag = typeof prop.distance_to_office_km === 'number'
      ? `<span class="relo-popup-tag">📍 ${prop.distance_to_office_km.toFixed(1)}\u202fkm</span>` : '';
    const html = `
      <div class="relo-popup-inner">
        <div class="relo-popup-header">
          <span class="relo-popup-num">${idx + 1}</span>
          <span class="relo-popup-locality">${locality || prop.title}</span>
        </div>
        <div class="relo-popup-price">₹${priceK}k<span style="font-size:.65rem;font-weight:500;color:#6e7d96">/mo</span></div>
        <div class="relo-popup-tags">${commuteTag}${distTag}</div>
      </div>`;

    this.popup = new (this.mgl as any).default.Popup({
      closeButton: false, offset: 20, className: 'relo-popup', maxWidth: '260px',
    }).setHTML(html).setLngLat(pos);

    setTimeout(() => { if (this.map) this.popup?.addTo(this.map); }, 750);
  }
}
