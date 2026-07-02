const toRad = (deg) => (deg * Math.PI) / 180;

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Generic replacement for the old hardcoded isWithinSines() — checks a given
// lat/lng against ANY location row (id, name, latitude, longitude, radius_meters).
const isWithinLocation = (lat, lng, location) => {
  const distance = haversineDistance(lat, lng, location.latitude, location.longitude);
  return { valid: distance <= location.radius_meters, distance: Math.round(distance) };
};

module.exports = { haversineDistance, isWithinLocation };
