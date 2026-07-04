import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import getCurrentLocation from '../../hooks/useGeolocation';
import '../../styles/forms.css';

// Accepts plain decimals ("33.646115") as well as the format map apps
// commonly display/copy, e.g. "33.6420° N" or "72.9860° E" — strips the
// degree symbol and applies the sign implied by S/W.
const parseCoordinate = (raw) => {
  if (raw === '' || raw == null) return NaN;
  const match = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?$/i);
  if (!match) return NaN;
  let num = parseFloat(match[1]);
  const dir = match[2]?.toUpperCase();
  if (dir === 'S' || dir === 'W') num = -Math.abs(num);
  return num;
};

const LocationForm = ({ initial, onSubmit, submitting, onCancel }) => {
  const [form, setForm] = useState({
    name: initial?.name || '',
    latitude: initial?.latitude ?? '',
    longitude: initial?.longitude ?? '',
    radius_meters: initial?.radius_meters ?? 80,
  });
  const [errors, setErrors] = useState({});
  const [locating, setLocating] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Map is initialized once on mount. Falls back to a zoomed-out world view
  // (rather than assuming any one city/region) when there's no existing
  // location and the browser won't give us the admin's current position —
  // a hardcoded default coordinate would be wrong for any org outside
  // wherever that hardcode happened to point.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const existingLat = parseCoordinate(form.latitude);
    const existingLng = parseCoordinate(form.longitude);
    const hasExisting = !Number.isNaN(existingLat) && !Number.isNaN(existingLng);

    const map = L.map(mapContainerRef.current).setView(
      hasExisting ? [existingLat, existingLng] : [20, 0],
      hasExisting ? 15 : 2
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const radius = Number(form.radius_meters) || 80;
    let marker = null;
    let circle = null;

    if (hasExisting) {
      marker = L.marker([existingLat, existingLng], { draggable: true }).addTo(map);
      circle = L.circle([existingLat, existingLng], {
        radius,
        color: '#2C7BD6',
        fillColor: '#2C7BD6',
        fillOpacity: 0.15,
      }).addTo(map);
    }

    const placePin = (latlng) => {
      if (!marker) {
        marker = L.marker(latlng, { draggable: true }).addTo(map);
        circle = L.circle(latlng, { radius: Number(form.radius_meters) || 80, color: '#2C7BD6', fillColor: '#2C7BD6', fillOpacity: 0.15 }).addTo(map);
        marker.on('dragend', () => placePin(marker.getLatLng()));
        markerRef.current = marker;
        circleRef.current = circle;
      } else {
        marker.setLatLng(latlng);
        circle.setLatLng(latlng);
      }
      setForm(p => ({ ...p, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) }));
      setErrors(p => ({ ...p, latitude: '', longitude: '' }));
    };

    map.on('click', (e) => placePin(e.latlng));
    if (marker) marker.on('dragend', () => placePin(marker.getLatLng()));

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Keep the map's marker/circle in sync when lat/lng/radius change from
  // outside a map click — typing in the fields, pasting, or "use my
  // current location".
  useEffect(() => {
    if (!mapRef.current) return;
    const lat = parseCoordinate(form.latitude);
    const lng = parseCoordinate(form.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on('dragend', () => {
        const latlng = markerRef.current.getLatLng();
        setForm(p => ({ ...p, latitude: latlng.lat.toFixed(6), longitude: latlng.lng.toFixed(6) }));
      });
      circleRef.current = L.circle([lat, lng], {
        radius: Number(form.radius_meters) || 80,
        color: '#2C7BD6',
        fillColor: '#2C7BD6',
        fillOpacity: 0.15,
      }).addTo(mapRef.current);
      mapRef.current.setView([lat, lng], 15);
    } else {
      const cur = markerRef.current.getLatLng();
      if (Math.abs(cur.lat - lat) > 1e-9 || Math.abs(cur.lng - lng) > 1e-9) {
        markerRef.current.setLatLng([lat, lng]);
        circleRef.current.setLatLng([lat, lng]);
        mapRef.current.setView([lat, lng]);
      }
    }
  }, [form.latitude, form.longitude, form.radius_meters]);

  useEffect(() => {
    if (circleRef.current) {
      const r = Number(form.radius_meters) || 80;
      if (circleRef.current.getRadius() !== r) circleRef.current.setRadius(r);
    }
  }, [form.radius_meters]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Location name is required';
    const lat = parseCoordinate(form.latitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      e.latitude = 'Latitude must be a number between -90 and 90 (e.g. 33.646115 or 33.6461° N)';
    }
    const lng = parseCoordinate(form.longitude);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      e.longitude = 'Longitude must be a number between -180 and 180 (e.g. 72.997455 or 72.9975° E)';
    }
    if (!form.radius_meters || Number(form.radius_meters) < 1 || Number(form.radius_meters) > 5000) {
      e.radius_meters = 'Radius must be between 1 and 5000 meters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  // Handles pasting a combined "33.6420° N, 72.9860° E" string (the format
  // Google Maps gives you when you copy coordinates) into either field —
  // splits it across both instead of jamming the whole string into one.
  const handleCoordPaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text.includes(',')) {
      const [latPart, lngPart] = text.split(',').map(s => s.trim());
      if (latPart && lngPart) {
        e.preventDefault();
        setForm(p => ({ ...p, latitude: latPart, longitude: lngPart }));
        setErrors(p => ({ ...p, latitude: '', longitude: '' }));
      }
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { latitude, longitude } = await getCurrentLocation();
      setForm(p => ({ ...p, latitude, longitude }));
      setErrors(p => ({ ...p, latitude: '', longitude: '' }));
    } catch (err) {
      setErrors(p => ({ ...p, latitude: err.message }));
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        name: form.name,
        latitude: parseCoordinate(form.latitude),
        longitude: parseCoordinate(form.longitude),
        radius_meters: Number(form.radius_meters),
        // Only present on edit — required by the backend's optimistic-lock
        // check. Absent on create, which has no version yet.
        ...(initial?.version != null ? { version: initial.version } : {}),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label className="form-label">Location name</label>
        <input className={`form-input ${errors.name ? 'input-error' : ''}`} name="name" value={form.name} onChange={handleChange} placeholder="e.g. Main Office" />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label className="form-label">Pick on map</label>
        <div ref={mapContainerRef} className="location-map" />
        <span className="form-hint">Click the map to drop a pin, or drag it to fine-tune.</span>
      </div>

      <div className="coord-grid">
        <div className="form-group">
          <label className="form-label">Latitude</label>
          <input className={`form-input ${errors.latitude ? 'input-error' : ''}`} name="latitude" value={form.latitude} onChange={handleChange} onPaste={handleCoordPaste} placeholder="e.g. 33.646115 or 33.6461° N" />
          {errors.latitude && <span className="form-error">{errors.latitude}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Longitude</label>
          <input className={`form-input ${errors.longitude ? 'input-error' : ''}`} name="longitude" value={form.longitude} onChange={handleChange} onPaste={handleCoordPaste} placeholder="e.g. 72.997455 or 72.9975° E" />
          {errors.longitude && <span className="form-error">{errors.longitude}</span>}
        </div>
      </div>

      <button type="button" className="btn-ghost" onClick={handleUseCurrentLocation} disabled={locating} style={{ marginBottom: 4 }}>
        {locating ? 'Getting location…' : 'Use my current location'}
      </button>

      <div className="form-group">
        <label className="form-label">Check-in radius (meters)</label>
        <input className={`form-input ${errors.radius_meters ? 'input-error' : ''}`} type="number" name="radius_meters" value={form.radius_meters} onChange={handleChange} placeholder="80" />
        {errors.radius_meters && <span className="form-error">{errors.radius_meters}</span>}
      </div>

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : initial ? 'Save changes' : 'Add location'}
        </button>
      </div>
    </form>
  );
};

export default LocationForm;
