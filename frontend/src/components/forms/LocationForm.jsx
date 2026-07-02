import { useState } from 'react';
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
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label className="form-label">Location Name</label>
        <input className={`form-input ${errors.name ? 'input-error' : ''}`} name="name" value={form.name} onChange={handleChange} placeholder="e.g. Main Office" />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

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

      <button type="button" className="btn-ghost" onClick={handleUseCurrentLocation} disabled={locating} style={{ marginBottom: 16 }}>
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
          {submitting ? 'Saving...' : initial ? 'Update' : 'Add Location'}
        </button>
      </div>
    </form>
  );
};

export default LocationForm;
