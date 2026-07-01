'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import AssetDrawer from './AssetDrawer';
import RegionDrawer from './RegionDrawer';
import AddMarketForm from '../forms/AddMarketForm';
import { loadAssets, addAsset } from '@/lib/store/assetStore';
import { loadDrawings, addDrawing, updateDrawing, deleteDrawing } from '@/lib/store/drawingStore';

const STATUS_COLORS = {
  scouting: '#f59e0b',
  active: '#6366f1',
  passed: '#ef4444',
  closed: '#10b981',
};

// Region name labels only appear at/above this zoom (hidden when far out)
const REGION_LABEL_MIN_ZOOM = 10;

// The location info sidebar appears once you're zoomed in at least this much
const LOCATION_PANEL_MIN_ZOOM = 9;

// Region draw colors
const REGION_COLOR = '#6366f1'; // standard region (indigo)
const GOAL_COLOR = '#10b981'; // goal region (green)
const MARKET_COLOR = '#e2e8f0'; // market boundary (outline only, no fill)

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#212330' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212330' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a99b8' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#353d4d' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#8a99b8' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2d3541' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8a99b8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#283139' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#353d4d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212330' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a99b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#454d5f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#212330' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a202f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5a6578' }] },
];

export default function MapView({ markets, selectedAssetId = null }) {
  const searchParams = useSearchParams();
  const assetParam = searchParams.get('asset');
  const cityParam = searchParams.get('city');
  const qParam = searchParams.get('q');
  const qNonce = searchParams.get('qn');
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const clustererRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const highlightCircleRef = useRef(null);
  const markerClickedRef = useRef(false);
  const geocoderRef = useRef(null);
  const assetsRef = useRef([]);
  const drawingsRef = useRef([]);
  const lastGeoKeyRef = useRef(null);
  const drawnShapesRef = useRef({});
  const drawingInfoWindowRef = useRef(null);
  const drawingModeRef = useRef(false);
  const createAssetModeRef = useRef(false);
  const drawColorRef = useRef('#6366f1');
  const drawKindRef = useRef('region');
  const redrawTargetRef = useRef(null);
  const inProgressPathRef = useRef([]);
  const inProgressPolygonRef = useRef(null);
  const vertexMarkersRef = useRef([]);
  const [pendingPointCount, setPendingPointCount] = useState(0);
  const [assets, setAssets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [clickedLocation, setClickedLocation] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [drawings, setDrawings] = useState([]);
  const [drawingMode, setDrawingMode] = useState(false);
  const [createAssetMode, setCreateAssetMode] = useState(false);
  const [pendingColor, setPendingColor] = useState('#6366f1');
  const [pendingKind, setPendingKind] = useState('region');
  const [redrawTarget, setRedrawTarget] = useState(null);
  const [locationPanel, setLocationPanel] = useState(null);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [showCreateAsset, setShowCreateAsset] = useState(false);
  const [caName, setCaName] = useState('');
  const [caAddress, setCaAddress] = useState('');
  const [caSaving, setCaSaving] = useState(false);
  const [caError, setCaError] = useState(null);
  const [showDrawingNameInput, setShowDrawingNameInput] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [drawingName, setDrawingName] = useState('');
  const [drawingDescription, setDrawingDescription] = useState('');

  useEffect(() => {
    if (!mapRef.current) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,drawing,geometry`;
    script.async = true;
    script.onload = () => {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        zoom: 4,
        center: { lat: 37.0902, lng: -95.7129 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: DARK_MAP_STYLE,
      });

      // InfoWindow used to show saved-area details
      drawingInfoWindowRef.current = new google.maps.InfoWindow();
      geocoderRef.current = new google.maps.Geocoder();

      // Toggle region label visibility as the user zooms
      mapInstance.current.addListener('zoom_changed', updateRegionLabelVisibility);

      // Update the location info sidebar when the view settles
      mapInstance.current.addListener('idle', updateLocationPanel);

      // Add click listener: in drawing mode add a polygon vertex, otherwise create asset
      mapInstance.current.addListener('click', async (e) => {
        // Drawing mode: each click adds a vertex to the in-progress polygon
        if (drawingModeRef.current) {
          addPolygonVertex({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          return;
        }
        // Only create an asset when Create Asset mode is active
        if (!createAssetModeRef.current) return;
        // Ignore map clicks if a marker was just clicked
        if (markerClickedRef.current) {
          markerClickedRef.current = false;
          return;
        }
        // Also ignore if click target is a marker or part of the UI
        if (e.placeId) return;

        // Exit create-asset mode now that a spot was chosen
        createAssetModeRef.current = false;
        setCreateAssetMode(false);
        setOverlaysClickable(true);
        mapInstance.current.setOptions({ draggableCursor: null });

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        // Try to reverse geocode
        const geocoder = new google.maps.Geocoder();
        try {
          const results = await geocoder.geocode({ location: { lat, lng } });
          const address = results[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setClickedLocation({ lat, lng, address });
        } catch (error) {
          console.error('Geocoding error:', error);
          setClickedLocation({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        }

        setAssetName('');
        setShowNameInput(true);
      });

      // Render markers and saved drawings
      renderAssetMarkers();
      renderDrawings();
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    loadAssets().then(loadedAssets => {
      setAssets(loadedAssets);
    });
  }, []);

  useEffect(() => {
    loadDrawings().then(loaded => {
      setDrawings(loaded);
    });
  }, []);

  useEffect(() => {
    renderAssetMarkers();
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    renderDrawings();
    drawingsRef.current = drawings;
  }, [drawings]);

  // Opening any asset/region detail should expand the (possibly minimized) window
  useEffect(() => {
    if (selectedMarket || selectedRegion) setPanelMinimized(false);
  }, [selectedMarket, selectedRegion]);

  // Fly to any searched place (geocode the query) — works for any city.
  // An explicit asset focus takes priority over a leftover search query.
  useEffect(() => {
    if (!qParam) return;
    if (selectedAssetId || assetParam) return;
    let cancelled = false;
    const focus = () => {
      if (cancelled) return;
      if (!mapInstance.current || !geocoderRef.current) {
        setTimeout(focus, 150);
        return;
      }
      geocoderRef.current.geocode({ address: qParam }, (results, status) => {
        if (cancelled) return;
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          mapInstance.current.setCenter(loc);
          mapInstance.current.setZoom(11);
        }
      });
    };
    focus();
    return () => { cancelled = true; };
  }, [qParam, qNonce, selectedAssetId, assetParam]);

  useEffect(() => {
    const focusAsset = async () => {
      const targetId = selectedAssetId || assetParam;
      if (targetId) {
        // Wait for map instance to be ready
        const checkMapReady = setInterval(() => {
          if (mapInstance.current) {
            clearInterval(checkMapReady);
            (async () => {
              const loadedAssets = await loadAssets();
              const asset = loadedAssets?.find(a => a.id === targetId);
              if (asset && asset.lat && asset.lng) {
                mapInstance.current.setCenter({ lat: asset.lat, lng: asset.lng });
                mapInstance.current.setZoom(16);
                setSelectedMarket(asset);
              }
            })();
          }
        }, 100);

        // Cleanup timeout after 5 seconds
        const timeout = setTimeout(() => clearInterval(checkMapReady), 5000);
        return () => clearTimeout(timeout);
      }
    };

    focusAsset();
  }, [selectedAssetId, assetParam]);

  useEffect(() => {
    const focusCity = async () => {
      if (cityParam && mapInstance.current) {
        const assets = await loadAssets();
        const cityAssets = assets.filter(a => a.address.includes(cityParam));
        if (cityAssets.length > 0) {
          const avgLat = cityAssets.reduce((sum, a) => sum + a.lat, 0) / cityAssets.length;
          const avgLng = cityAssets.reduce((sum, a) => sum + a.lng, 0) / cityAssets.length;
          mapInstance.current.setCenter({ lat: avgLat, lng: avgLng });
          mapInstance.current.setZoom(12);
        }
      }
    };
    focusCity();
  }, [cityParam]);

  useEffect(() => {
    if (highlightCircleRef.current) {
      highlightCircleRef.current.setMap(null);
      highlightCircleRef.current = null;
    }

    if (selectedMarket && selectedMarket.lat && selectedMarket.lng && mapInstance.current) {
      highlightCircleRef.current = new google.maps.Circle({
        center: { lat: selectedMarket.lat, lng: selectedMarket.lng },
        radius: 500,
        map: mapInstance.current,
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        strokeColor: '#6366f1',
        strokeOpacity: 0.4,
        strokeWeight: 2,
      });
    }
  }, [selectedMarket]);


  function getMarkerIcon(color, size = 'small') {
    const dim = size === 'large' ? 30 : 16;
    const c = dim / 2;
    const r = size === 'large' ? 11 : 5;
    const sw = size === 'large' ? 3 : 2;
    const svg = `<svg width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${c}" cy="${c}" r="${r}" fill="${color}" stroke="white" stroke-width="${sw}"/>
    </svg>`;
    return {
      url: `data:image/svg+xml;base64,${btoa(svg)}`,
      scaledSize: new google.maps.Size(dim, dim),
      anchor: new google.maps.Point(c, c),
    };
  }

  function renderAssetMarkers() {
    if (!mapInstance.current) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(marker => marker.setMap(null));
    markersRef.current = {};

    // Create new markers from assets
    assets.forEach(asset => {
      if (!asset.lat || !asset.lng) return;

      const color = STATUS_COLORS[asset.status] || '#808080';
      const marker = new google.maps.Marker({
        position: { lat: asset.lat, lng: asset.lng },
        map: mapInstance.current,
        title: asset.name,
        icon: getMarkerIcon(color, 'small'),
        zIndex: 10,
      });

      // Small by default, grow + raise on hover (name shows via native title tooltip)
      marker.addListener('mouseover', () => {
        marker.setIcon(getMarkerIcon(color, 'large'));
        marker.setZIndex(1000);
      });

      marker.addListener('mouseout', () => {
        marker.setIcon(getMarkerIcon(color, 'small'));
        marker.setZIndex(10);
      });

      marker.addListener('click', () => {
        markerClickedRef.current = true;
        setSelectedRegion(null);
        focusOnAsset(asset);
        setSelectedMarket(asset);
      });

      markersRef.current[asset.id] = marker;
    });
  }

  // Create an asset from a typed address — geocode it to exact coordinates
  async function handleCreateAsset() {
    if (!caName.trim() || !caAddress.trim()) return;
    if (!geocoderRef.current) {
      setCaError('Map is still loading — try again in a moment.');
      return;
    }
    setCaSaving(true);
    setCaError(null);
    try {
      const result = await new Promise((resolve) => {
        geocoderRef.current.geocode({ address: caAddress }, (results, status) => {
          resolve(status === 'OK' && results && results[0] ? results[0] : null);
        });
      });
      if (!result) {
        setCaError('Could not find that address. Add city/state (e.g. "8555 S Lewis Ave, Tulsa, OK").');
        setCaSaving(false);
        return;
      }
      const loc = result.geometry.location;
      const lat = loc.lat();
      const lng = loc.lng();
      const saved = await addAsset({
        name: caName.trim(),
        address: result.formatted_address,
        lat,
        lng,
        status: 'scouting',
      });

      const updated = await loadAssets();
      setAssets(updated);

      // Reset + close
      setShowCreateAsset(false);
      setCaName('');
      setCaAddress('');

      // Fly to the new pin and open its drawer
      if (mapInstance.current) {
        mapInstance.current.setCenter({ lat, lng });
        mapInstance.current.setZoom(16);
      }
      setSelectedRegion(null);
      setPanelMinimized(false);
      setSelectedMarket(saved);
    } catch (err) {
      setCaError('Failed to create asset: ' + err.message);
    } finally {
      setCaSaving(false);
    }
  }

  // Create an asset from a clicked map point (uses the exact clicked coordinates)
  async function handleCreateAssetFromClick() {
    if (!assetName.trim() || !clickedLocation) return;
    const saved = await addAsset({
      name: assetName.trim(),
      address: clickedLocation.address,
      lat: clickedLocation.lat,
      lng: clickedLocation.lng,
      status: 'scouting',
    });
    const updated = await loadAssets();
    setAssets(updated);
    setShowNameInput(false);
    setAssetName('');
    setClickedLocation(null);
    setSelectedRegion(null);
    setPanelMinimized(false);
    setSelectedMarket(saved);
  }

  // Center on an asset; zoom in only if currently far out
  function focusOnAsset(asset) {
    if (!mapInstance.current || asset.lat == null || asset.lng == null) return;
    mapInstance.current.panTo({ lat: asset.lat, lng: asset.lng });
    if (mapInstance.current.getZoom() < 14) {
      mapInstance.current.setZoom(16);
    }
  }

  function polygonCentroid(path) {
    const n = path.length;
    if (!n) return { lat: 0, lng: 0 };
    const sum = path.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / n, lng: sum.lng / n };
  }

  function transparentLabelIcon() {
    const svg = `<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg"></svg>`;
    return {
      url: `data:image/svg+xml;base64,${btoa(svg)}`,
      scaledSize: new google.maps.Size(1, 1),
      anchor: new google.maps.Point(0, 0),
    };
  }

  function renderDrawings() {
    if (!mapInstance.current || !window.google) return;

    // Clear existing rendered shapes
    Object.values(drawnShapesRef.current).forEach(({ polygon, label }) => {
      polygon.setMap(null);
      if (label) label.setMap(null);
    });
    drawnShapesRef.current = {};

    drawings.forEach((drawing) => {
      if (!drawing.paths || !Array.isArray(drawing.paths) || drawing.paths.length < 3) return;
      const isMarket = drawing.kind === 'market';
      const color = drawing.color || (isMarket ? MARKET_COLOR : '#6366f1');

      const polygon = new google.maps.Polygon({
        paths: drawing.paths,
        map: mapInstance.current,
        fillColor: color,
        fillOpacity: isMarket ? 0 : 0.07,
        strokeColor: color,
        strokeOpacity: isMarket ? 0.85 : 0,
        strokeWeight: isMarket ? 3 : 0,
        clickable: !createAssetModeRef.current && !drawingModeRef.current,
        zIndex: isMarket ? 1 : 2,
      });

      const center = polygonCentroid(drawing.paths);

      // Floating text label at the centroid (only visible when zoomed in)
      const label = new google.maps.Marker({
        position: center,
        map: mapInstance.current,
        icon: transparentLabelIcon(),
        label: {
          text: drawing.name || 'Area',
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: '600',
          className: 'drawing-label',
        },
      });

      const openRegion = () => {
        setSelectedMarket(null);
        setSelectedRegion(drawing);
      };

      polygon.addListener('click', openRegion);
      label.addListener('click', openRegion);

      drawnShapesRef.current[drawing.id] = { polygon, label };
    });

    updateRegionLabelVisibility();
  }

  function updateRegionLabelVisibility() {
    if (!mapInstance.current) return;
    const zoom = mapInstance.current.getZoom();
    const visible = zoom >= REGION_LABEL_MIN_ZOOM;
    Object.values(drawnShapesRef.current).forEach(({ label }) => {
      if (label) label.setVisible(visible);
    });
  }

  // While placing an asset, regions/markers must not swallow the map click
  function setOverlaysClickable(clickable) {
    Object.values(drawnShapesRef.current).forEach(({ polygon, label }) => {
      if (polygon) polygon.setOptions({ clickable });
      if (label) label.setOptions({ clickable });
    });
    Object.values(markersRef.current).forEach((m) => m.setOptions({ clickable }));
  }

  function cityNameFromResults(results) {
    const comp = results?.[0]?.address_components || [];
    const find = (type) => comp.find((c) => c.types.includes(type));
    const locality =
      find('locality') || find('postal_town') || find('sublocality') || find('administrative_area_level_2');
    const state = find('administrative_area_level_1');
    if (locality && state) return `${locality.long_name}, ${state.short_name}`;
    if (locality) return locality.long_name;
    if (state) return state.long_name;
    return results?.[0]?.formatted_address || 'This area';
  }

  function updateLocationPanel() {
    const map = mapInstance.current;
    if (!map) return;
    const zoom = map.getZoom();
    if (zoom < LOCATION_PANEL_MIN_ZOOM) {
      setLocationPanel(null);
      lastGeoKeyRef.current = null;
      return;
    }
    const bounds = map.getBounds();
    if (!bounds) return;

    const regionsInView = drawingsRef.current.filter(
      (d) =>
        d.kind !== 'market' &&
        Array.isArray(d.paths) &&
        d.paths.length >= 3 &&
        bounds.contains(polygonCentroid(d.paths))
    );
    const assetsInView = assetsRef.current.filter(
      (a) => a.lat != null && a.lng != null && bounds.contains({ lat: a.lat, lng: a.lng })
    );

    setLocationPanel((prev) => ({
      city: prev?.city || 'Loading…',
      regions: regionsInView,
      assets: assetsInView,
    }));

    // Reverse-geocode the center for the area name (only when the center moves)
    const c = map.getCenter();
    const key = `${c.lat().toFixed(2)},${c.lng().toFixed(2)}`;
    if (key !== lastGeoKeyRef.current && geocoderRef.current) {
      lastGeoKeyRef.current = key;
      geocoderRef.current.geocode(
        { location: { lat: c.lat(), lng: c.lng() } },
        (results, status) => {
          if (status === 'OK' && results) {
            const city = cityNameFromResults(results);
            setLocationPanel((prev) => (prev ? { ...prev, city } : prev));
          }
        }
      );
    }
  }

  function vertexDotIcon(color = REGION_COLOR) {
    const svg = `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5" fill="#ffffff" stroke="${color}" stroke-width="2"/>
    </svg>`;
    return {
      url: `data:image/svg+xml;base64,${btoa(svg)}`,
      scaledSize: new google.maps.Size(14, 14),
      anchor: new google.maps.Point(7, 7),
    };
  }

  function addPolygonVertex(point) {
    if (!mapInstance.current || !window.google) return;
    const path = inProgressPathRef.current;
    const color = drawColorRef.current || REGION_COLOR;
    path.push(point);

    const isMarket = drawKindRef.current === 'market';
    // Create/update the in-progress polygon
    if (!inProgressPolygonRef.current) {
      inProgressPolygonRef.current = new google.maps.Polygon({
        paths: path,
        map: mapInstance.current,
        fillColor: color,
        fillOpacity: isMarket ? 0 : 0.15,
        strokeColor: color,
        strokeOpacity: 0.95,
        strokeWeight: isMarket ? 3 : 2,
        clickable: false,
        zIndex: 2,
      });
    } else {
      inProgressPolygonRef.current.setPath(path);
    }

    // Add a vertex dot. Clicking the first dot (with >=3 points) finishes the area.
    const isFirst = path.length === 1;
    const marker = new google.maps.Marker({
      position: point,
      map: mapInstance.current,
      icon: vertexDotIcon(color),
      zIndex: 3,
      cursor: isFirst ? 'pointer' : undefined,
      title: isFirst ? 'Click to close the area' : undefined,
    });
    if (isFirst) {
      marker.addListener('click', () => {
        if (inProgressPathRef.current.length >= 3) finishDrawing();
      });
    }
    vertexMarkersRef.current.push(marker);

    setPendingPointCount(path.length);
  }

  function clearInProgress() {
    if (inProgressPolygonRef.current) {
      inProgressPolygonRef.current.setMap(null);
      inProgressPolygonRef.current = null;
    }
    vertexMarkersRef.current.forEach((m) => m.setMap(null));
    vertexMarkersRef.current = [];
    inProgressPathRef.current = [];
    setPendingPointCount(0);
  }

  function beginDraw(color = REGION_COLOR, kind = 'region') {
    // Drawing and create-asset modes are mutually exclusive
    if (createAssetModeRef.current) {
      createAssetModeRef.current = false;
      setCreateAssetMode(false);
    }
    clearInProgress();
    drawColorRef.current = color;
    drawKindRef.current = kind;
    drawingModeRef.current = true;
    setDrawingMode(true);
    setOverlaysClickable(false); // don't let existing shapes swallow drawing clicks
    if (mapInstance.current) {
      mapInstance.current.setOptions({ draggableCursor: 'crosshair', disableDoubleClickZoom: true });
    }
  }

  // Start re-drawing an existing region's shape (keeps its name/description/color)
  function startRedraw(region) {
    setSelectedRegion(null);
    redrawTargetRef.current = region;
    setRedrawTarget(region);
    beginDraw(region.color || REGION_COLOR);
  }

  function toggleCreateAssetMode() {
    if (createAssetMode) {
      createAssetModeRef.current = false;
      setCreateAssetMode(false);
      setOverlaysClickable(true);
      if (mapInstance.current) mapInstance.current.setOptions({ draggableCursor: null });
    } else {
      // Turn off drawing mode if it was active
      if (drawingModeRef.current) {
        clearInProgress();
        stopDrawingMode();
      }
      createAssetModeRef.current = true;
      setCreateAssetMode(true);
      setOverlaysClickable(false);
      if (mapInstance.current) mapInstance.current.setOptions({ draggableCursor: 'crosshair' });
    }
  }

  function stopDrawingMode() {
    drawingModeRef.current = false;
    setDrawingMode(false);
    setOverlaysClickable(true);
    if (mapInstance.current) {
      mapInstance.current.setOptions({ draggableCursor: null, disableDoubleClickZoom: false });
    }
  }

  function toggleDrawingMode() {
    if (drawingMode) {
      // Cancel: discard the in-progress shape
      clearInProgress();
      stopDrawingMode();
      // If cancelling a redraw, reopen the region unchanged
      if (redrawTargetRef.current) {
        const t = redrawTargetRef.current;
        redrawTargetRef.current = null;
        setRedrawTarget(null);
        setSelectedRegion(t);
      }
    } else {
      beginDraw(REGION_COLOR);
    }
  }

  function finishDrawing() {
    const path = inProgressPathRef.current;
    if (path.length < 3) return;

    // Re-drawing an existing region: replace only its shape
    if (redrawTargetRef.current) {
      const target = redrawTargetRef.current;
      const newPath = [...path];
      redrawTargetRef.current = null;
      setRedrawTarget(null);
      clearInProgress();
      stopDrawingMode();
      (async () => {
        const updated = await updateDrawing(target.id, { paths: newPath });
        const refreshed = await loadDrawings();
        setDrawings(refreshed);
        setSelectedRegion(updated || { ...target, paths: newPath });
      })();
      return;
    }

    setPendingPath([...path]);
    setPendingColor(drawColorRef.current || REGION_COLOR);
    setPendingKind(drawKindRef.current || 'region');
    setDrawingName('');
    setDrawingDescription('');
    setShowDrawingNameInput(true);
    // Remove the in-progress helpers; saved polygon will render via renderDrawings
    clearInProgress();
    stopDrawingMode();
  }

  async function handleSaveDrawing() {
    if (!drawingName.trim() || !pendingPath) return;
    const saved = await addDrawing({
      name: drawingName.trim(),
      description: drawingDescription.trim(),
      paths: pendingPath,
      color: pendingColor,
      kind: pendingKind,
    });
    setShowDrawingNameInput(false);
    setPendingPath(null);
    setDrawingName('');
    setDrawingDescription('');
    setDrawings((prev) => [saved, ...prev]);
  }

  function handleCancelDrawing() {
    setShowDrawingNameInput(false);
    setPendingPath(null);
    setDrawingName('');
    setDrawingDescription('');
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Map controls (top-left) */}
      <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
        <div className="flex gap-2">
          {/* Draw Area button with hover flyout for region type */}
          <div className="relative group">
            <button
              onClick={toggleDrawingMode}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors duration-200 ${
                drawingMode
                  ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-600'
                  : 'bg-gray-900 text-gray-200 hover:bg-gray-800 border border-gray-700'
              }`}
            >
              {drawingMode ? '✕ Cancel' : '✎ Draw Area'}
            </button>

            {!drawingMode && (
              <div className="absolute left-full top-0 pl-2 z-10 whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-200 ease-out flex flex-col gap-2">
                <button
                  onClick={() => beginDraw(GOAL_COLOR, 'region')}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors duration-200 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  ✎ Goal Region
                </button>
                <button
                  onClick={() => beginDraw(MARKET_COLOR, 'market')}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors duration-200 bg-gray-200 text-gray-900 hover:bg-white"
                >
                  ▢ Market (outline)
                </button>
              </div>
            )}
          </div>

          {drawingMode && (
            <button
              onClick={finishDrawing}
              disabled={pendingPointCount < 3}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors duration-200 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✓ Finish area
            </button>
          )}
        </div>

        <div className="relative group">
          <button
            onClick={toggleCreateAssetMode}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors duration-200 ${
              createAssetMode
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-900 text-gray-200 hover:bg-gray-800 border border-gray-700'
            }`}
          >
            {createAssetMode ? '✕ Cancel placing' : '📍 Create Asset'}
          </button>

          {!createAssetMode && (
            <div className="absolute left-full top-0 pl-2 z-10 whitespace-nowrap opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-200 ease-out">
              <button
                onClick={() => { setCaError(null); setShowCreateAsset(true); }}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-colors duration-200 bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-600"
              >
                ⌨ Add by address
              </button>
            </div>
          )}
        </div>
        {createAssetMode && (
          <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 max-w-[240px] shadow-lg">
            Click anywhere on the map to drop the asset pin.
          </div>
        )}

        {drawingMode && (
          <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 max-w-[240px] shadow-lg">
            {redrawTarget ? `Redrawing "${redrawTarget.name}" — outline the new shape` : 'Click points on the map to outline an area'}
            {pendingPointCount > 0 ? ` (${pendingPointCount} point${pendingPointCount === 1 ? '' : 's'})` : ''}.
            {pendingPointCount >= 3
              ? ' Click "Finish area" or the first point to close.'
              : ' Add at least 3 points.'}
          </div>
        )}
      </div>

      {/* Location info sidebar (appears when zoomed in; sits below the controls) */}
      {locationPanel && !selectedMarket && !selectedRegion && !panelMinimized && (
        <div className="absolute left-4 top-28 bottom-4 w-72 z-30 flex flex-col bg-gray-900/95 border border-gray-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="px-4 py-3 border-b border-gray-800 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => setLocationPanel(null)}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors text-sm font-medium"
                title="Back (dismiss)"
              >
                ← Back
              </button>
              <button
                onClick={() => setPanelMinimized(true)}
                className="text-gray-400 hover:text-gray-200 transition-colors text-lg leading-none px-1"
                title="Minimize"
              >
                —
              </button>
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Viewing</p>
            <h3 className="text-lg font-bold text-white leading-tight mt-0.5">{locationPanel.city}</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Regions in view */}
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                Regions ({locationPanel.regions.length})
              </p>
              {locationPanel.regions.length > 0 ? (
                <div className="space-y-1.5">
                  {locationPanel.regions.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedMarket(null); setSelectedRegion(r); }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-800 transition-colors flex items-center gap-2"
                    >
                      <span style={{ color: r.color || '#6366f1' }}>◆</span>
                      <span className="text-sm text-gray-200 font-medium truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600">No regions in view.</p>
              )}
            </div>

            {/* Assets in view */}
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                Assets ({locationPanel.assets.length})
              </p>
              {locationPanel.assets.length > 0 ? (
                <div className="space-y-1.5">
                  {locationPanel.assets.map((a) => {
                    const color = STATUS_COLORS[a.status] || '#808080';
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setSelectedRegion(null);
                          focusOnAsset(a);
                          setSelectedMarket(a);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-800 transition-colors flex items-start gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
                        <span className="min-w-0">
                          <span className="block text-sm text-gray-200 font-medium truncate">{a.name || a.address}</span>
                          <span className="block text-xs text-gray-500 truncate">{a.address}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-600">No assets in view.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3" style={{ background: '#16181d', borderColor: 'rgba(255,255,255,0.06)', boxShadow: '0 4px 6px rgba(0,0,0,0.4)' }}>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.scouting }} />
          <span className="text-gray-300 font-medium">Scouting</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.active }} />
          <span className="text-gray-300 font-medium">Active</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.passed }} />
          <span className="text-gray-300 font-medium">Passed</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.closed }} />
          <span className="text-gray-300 font-medium">Closed</span>
        </div>
      </div>

      {selectedMarket && !panelMinimized && (
        <AssetDrawer
          key={selectedMarket.id}
          asset={selectedMarket}
          onClose={() => setSelectedMarket(null)}
          onMinimize={() => setPanelMinimized(true)}
        />
      )}

      {selectedRegion && !panelMinimized && (
        <RegionDrawer
          key={selectedRegion.id}
          region={selectedRegion}
          assets={assets}
          onAssetSelect={(a) => {
            setSelectedRegion(null);
            focusOnAsset(a);
            setSelectedMarket(a);
          }}
          onClose={() => setSelectedRegion(null)}
          onMinimize={() => setPanelMinimized(true)}
          onRedraw={() => startRedraw(selectedRegion)}
          onUpdated={async (updated) => {
            setSelectedRegion(updated);
            const refreshed = await loadDrawings();
            setDrawings(refreshed);
          }}
          onDeleted={async () => {
            setSelectedRegion(null);
            const refreshed = await loadDrawings();
            setDrawings(refreshed);
          }}
        />
      )}

      {/* Minimized viewing window → compact pill (click to expand) */}
      {panelMinimized && (selectedMarket || selectedRegion || locationPanel) && (
        <button
          onClick={() => setPanelMinimized(false)}
          className="absolute left-4 top-28 z-40 flex items-center gap-2 max-w-[18rem] px-3 py-2 bg-gray-900/95 border border-gray-800 rounded-xl shadow-2xl backdrop-blur hover:bg-gray-800 transition-colors"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          title="Expand"
        >
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide shrink-0">
            {selectedMarket ? 'Asset' : selectedRegion ? 'Region' : 'Viewing'}
          </span>
          <span className="text-sm text-gray-200 font-semibold truncate">
            {selectedMarket ? (selectedMarket.name || selectedMarket.address)
              : selectedRegion ? selectedRegion.name
              : locationPanel?.city}
          </span>
          <span className="text-gray-400 shrink-0">⤢</span>
        </button>
      )}

      {showNameInput && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={() => setShowNameInput(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-96 p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-1 text-white">Name this Asset</h2>
            {clickedLocation?.address && (
              <p className="text-xs text-gray-500 mb-4 truncate">📍 {clickedLocation.address}</p>
            )}
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g., Downtown Tulsa Apt Complex"
              className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 mb-6 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && assetName.trim()) handleCreateAssetFromClick();
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNameInput(false); setAssetName(''); setClickedLocation(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAssetFromClick}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                disabled={!assetName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showDrawingNameInput && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={handleCancelDrawing}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-96 p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-1 text-white">{pendingKind === 'market' ? 'Name this Market' : 'Name this Area'}</h2>
            <p className="text-xs text-gray-500 mb-5">Give the {pendingKind === 'market' ? 'market' : 'area'} a name and a short description.</p>
            <input
              type="text"
              value={drawingName}
              onChange={(e) => setDrawingName(e.target.value)}
              placeholder="e.g., North Tulsa submarket"
              className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 mb-4 focus:border-b-2 focus:border-gray-500 outline-none transition-colors duration-200"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && drawingName.trim()) handleSaveDrawing();
              }}
            />
            <textarea
              value={drawingDescription}
              onChange={(e) => setDrawingDescription(e.target.value)}
              placeholder="Short description (optional)"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 mb-6 focus:border-gray-500 outline-none transition-colors duration-200 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCancelDrawing}
                className="flex-1 px-4 py-2.5 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDrawing}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                disabled={!drawingName.trim()}
              >
                Save Area
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddMarketForm
          assetName={assetName}
          prefilledLocation={clickedLocation}
          onClose={() => {
            setShowAddForm(false);
            setClickedLocation(null);
            setAssetName('');
          }}
          onSuccess={() => {
            setShowAddForm(false);
            setClickedLocation(null);
            setAssetName('');
          }}
        />
      )}

      {showCreateAsset && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreateAsset(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-96 p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-1 text-white">Create Asset</h2>
            <p className="text-xs text-gray-500 mb-5">Enter an address — it’s pinned at the exact location.</p>
            <input
              autoFocus
              type="text"
              value={caName}
              onChange={(e) => setCaName(e.target.value)}
              placeholder="Asset name (e.g., University Village)"
              className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 mb-4 focus:border-gray-500 outline-none transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAsset(); }}
            />
            <input
              type="text"
              value={caAddress}
              onChange={(e) => setCaAddress(e.target.value)}
              placeholder="Full address (e.g., 8555 S Lewis Ave, Tulsa, OK)"
              className="w-full px-3 py-2.5 border-b-2 border-gray-700 bg-gray-900/50 rounded-lg text-sm text-gray-100 mb-2 focus:border-gray-500 outline-none transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAsset(); }}
            />
            {caError && <p className="text-xs text-red-400 mb-2">{caError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreateAsset(false)}
                className="flex-1 px-4 py-2.5 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAsset}
                disabled={!caName.trim() || !caAddress.trim() || caSaving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {caSaving ? 'Locating…' : 'Create'}
              </button>
            </div>
            <button
              onClick={() => { setShowCreateAsset(false); if (!createAssetMode) toggleCreateAssetMode(); }}
              className="w-full mt-3 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              📍 Or click on the map to drop a pin instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
