/**
 * Candidate touring markets. Coordinates are public city centroids; the
 * cultural signal for each city comes from Qloo at request time.
 */

export type RegionId = "north_america" | "uk_europe" | "india" | "australia_nz" | "latin_america";

export interface Market {
  city: string;
  country: string;
  region: RegionId;
  lat: number;
  lng: number;
}

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: "north_america", label: "North America" },
  { id: "uk_europe", label: "UK & Europe" },
  { id: "india", label: "India" },
  { id: "australia_nz", label: "Australia & NZ" },
  { id: "latin_america", label: "Latin America" },
];

const m = (city: string, country: string, region: RegionId, lat: number, lng: number): Market => ({
  city,
  country,
  region,
  lat,
  lng,
});

export const MARKETS: Market[] = [
  // North America
  m("New York", "US", "north_america", 40.7128, -74.006),
  m("Los Angeles", "US", "north_america", 34.0522, -118.2437),
  m("Chicago", "US", "north_america", 41.8781, -87.6298),
  m("Austin", "US", "north_america", 30.2672, -97.7431),
  m("Nashville", "US", "north_america", 36.1627, -86.7816),
  m("Atlanta", "US", "north_america", 33.749, -84.388),
  m("Seattle", "US", "north_america", 47.6062, -122.3321),
  m("Portland", "US", "north_america", 45.5152, -122.6784),
  m("San Francisco", "US", "north_america", 37.7749, -122.4194),
  m("Denver", "US", "north_america", 39.7392, -104.9903),
  m("Minneapolis", "US", "north_america", 44.9778, -93.265),
  m("Philadelphia", "US", "north_america", 39.9526, -75.1652),
  m("Boston", "US", "north_america", 42.3601, -71.0589),
  m("Washington", "US", "north_america", 38.9072, -77.0369),
  m("Detroit", "US", "north_america", 42.3314, -83.0458),
  m("New Orleans", "US", "north_america", 29.9511, -90.0715),
  m("Houston", "US", "north_america", 29.7604, -95.3698),
  m("Dallas", "US", "north_america", 32.7767, -96.797),
  m("Miami", "US", "north_america", 25.7617, -80.1918),
  m("Phoenix", "US", "north_america", 33.4484, -112.074),
  m("Salt Lake City", "US", "north_america", 40.7608, -111.891),
  m("Kansas City", "US", "north_america", 39.0997, -94.5786),
  m("St. Louis", "US", "north_america", 38.627, -90.1994),
  m("Columbus", "US", "north_america", 39.9612, -82.9988),
  m("Pittsburgh", "US", "north_america", 40.4406, -79.9959),
  m("Asheville", "US", "north_america", 35.5951, -82.5515),
  m("Las Vegas", "US", "north_america", 36.1699, -115.1398),
  m("San Diego", "US", "north_america", 32.7157, -117.1611),
  m("Toronto", "CA", "north_america", 43.6532, -79.3832),
  m("Montreal", "CA", "north_america", 45.5019, -73.5674),
  m("Vancouver", "CA", "north_america", 49.2827, -123.1207),
  // UK & Europe
  m("London", "GB", "uk_europe", 51.5074, -0.1278),
  m("Manchester", "GB", "uk_europe", 53.4808, -2.2426),
  m("Glasgow", "GB", "uk_europe", 55.8642, -4.2518),
  m("Bristol", "GB", "uk_europe", 51.4545, -2.5879),
  m("Dublin", "IE", "uk_europe", 53.3498, -6.2603),
  m("Paris", "FR", "uk_europe", 48.8566, 2.3522),
  m("Amsterdam", "NL", "uk_europe", 52.3676, 4.9041),
  m("Brussels", "BE", "uk_europe", 50.8503, 4.3517),
  m("Berlin", "DE", "uk_europe", 52.52, 13.405),
  m("Hamburg", "DE", "uk_europe", 53.5511, 9.9937),
  m("Cologne", "DE", "uk_europe", 50.9375, 6.9603),
  m("Copenhagen", "DK", "uk_europe", 55.6761, 12.5683),
  m("Stockholm", "SE", "uk_europe", 59.3293, 18.0686),
  m("Oslo", "NO", "uk_europe", 59.9139, 10.7522),
  m("Barcelona", "ES", "uk_europe", 41.3874, 2.1686),
  m("Madrid", "ES", "uk_europe", 40.4168, -3.7038),
  m("Lisbon", "PT", "uk_europe", 38.7223, -9.1393),
  m("Milan", "IT", "uk_europe", 45.4642, 9.19),
  m("Vienna", "AT", "uk_europe", 48.2082, 16.3738),
  m("Prague", "CZ", "uk_europe", 50.0755, 14.4378),
  m("Warsaw", "PL", "uk_europe", 52.2297, 21.0122),
  // India
  m("Mumbai", "IN", "india", 19.076, 72.8777),
  m("Delhi", "IN", "india", 28.6139, 77.209),
  m("Bengaluru", "IN", "india", 12.9716, 77.5946),
  m("Pune", "IN", "india", 18.5204, 73.8567),
  m("Hyderabad", "IN", "india", 17.385, 78.4867),
  m("Chennai", "IN", "india", 13.0827, 80.2707),
  m("Kolkata", "IN", "india", 22.5726, 88.3639),
  m("Goa", "IN", "india", 15.2993, 74.124),
  m("Jaipur", "IN", "india", 26.9124, 75.7873),
  m("Ahmedabad", "IN", "india", 23.0225, 72.5714),
  m("Chandigarh", "IN", "india", 30.7333, 76.7794),
  m("Shillong", "IN", "india", 25.5788, 91.8933),
  // Australia & NZ
  m("Sydney", "AU", "australia_nz", -33.8688, 151.2093),
  m("Melbourne", "AU", "australia_nz", -37.8136, 144.9631),
  m("Brisbane", "AU", "australia_nz", -27.4698, 153.0251),
  m("Perth", "AU", "australia_nz", -31.9505, 115.8605),
  m("Adelaide", "AU", "australia_nz", -34.9285, 138.6007),
  m("Auckland", "NZ", "australia_nz", -36.8485, 174.7633),
  m("Wellington", "NZ", "australia_nz", -41.2865, 174.7762),
  // Latin America
  m("Mexico City", "MX", "latin_america", 19.4326, -99.1332),
  m("Guadalajara", "MX", "latin_america", 20.6597, -103.3496),
  m("Monterrey", "MX", "latin_america", 25.6866, -100.3161),
  m("Bogotá", "CO", "latin_america", 4.711, -74.0721),
  m("Medellín", "CO", "latin_america", 6.2442, -75.5812),
  m("Lima", "PE", "latin_america", -12.0464, -77.0428),
  m("Santiago", "CL", "latin_america", -33.4489, -70.6693),
  m("Buenos Aires", "AR", "latin_america", -34.6037, -58.3816),
  m("São Paulo", "BR", "latin_america", -23.5505, -46.6333),
  m("Rio de Janeiro", "BR", "latin_america", -22.9068, -43.1729),
];

export function marketsFor(region: RegionId): Market[] {
  return MARKETS.filter((x) => x.region === region);
}

export function findMarket(city: string): Market | undefined {
  const q = city.trim().toLowerCase();
  return (
    MARKETS.find((x) => x.city.toLowerCase() === q) ??
    MARKETS.find((x) => q.startsWith(x.city.toLowerCase()) || x.city.toLowerCase().startsWith(q))
  );
}
