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
  /** Unambiguous locality query for Qloo (bare "Washington" resolves to the state). */
  query: string;
}

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: "north_america", label: "North America" },
  { id: "uk_europe", label: "UK & Europe" },
  { id: "india", label: "India" },
  { id: "australia_nz", label: "Australia & NZ" },
  { id: "latin_america", label: "Latin America" },
];

const m = (city: string, country: string, region: RegionId, lat: number, lng: number, query: string): Market => ({
  city,
  country,
  region,
  lat,
  lng,
  query,
});

export const MARKETS: Market[] = [
  // North America
  m("New York", "US", "north_america", 40.7128, -74.006, "New York, New York"),
  m("Los Angeles", "US", "north_america", 34.0522, -118.2437, "Los Angeles, California"),
  m("Chicago", "US", "north_america", 41.8781, -87.6298, "Chicago, Illinois"),
  m("Austin", "US", "north_america", 30.2672, -97.7431, "Austin, Texas"),
  m("Nashville", "US", "north_america", 36.1627, -86.7816, "Nashville, Tennessee"),
  m("Atlanta", "US", "north_america", 33.749, -84.388, "Atlanta, Georgia"),
  m("Seattle", "US", "north_america", 47.6062, -122.3321, "Seattle, Washington"),
  m("Portland", "US", "north_america", 45.5152, -122.6784, "Portland, Oregon"),
  m("San Francisco", "US", "north_america", 37.7749, -122.4194, "San Francisco, California"),
  m("Denver", "US", "north_america", 39.7392, -104.9903, "Denver, Colorado"),
  m("Minneapolis", "US", "north_america", 44.9778, -93.265, "Minneapolis, Minnesota"),
  m("Philadelphia", "US", "north_america", 39.9526, -75.1652, "Philadelphia, Pennsylvania"),
  m("Boston", "US", "north_america", 42.3601, -71.0589, "Boston, Massachusetts"),
  m("Washington", "US", "north_america", 38.9072, -77.0369, "Washington, D.C."),
  m("Detroit", "US", "north_america", 42.3314, -83.0458, "Detroit, Michigan"),
  m("New Orleans", "US", "north_america", 29.9511, -90.0715, "New Orleans, Louisiana"),
  m("Houston", "US", "north_america", 29.7604, -95.3698, "Houston, Texas"),
  m("Dallas", "US", "north_america", 32.7767, -96.797, "Dallas, Texas"),
  m("Miami", "US", "north_america", 25.7617, -80.1918, "Miami, Florida"),
  m("Phoenix", "US", "north_america", 33.4484, -112.074, "Phoenix, Arizona"),
  m("Salt Lake City", "US", "north_america", 40.7608, -111.891, "Salt Lake City, Utah"),
  m("Kansas City", "US", "north_america", 39.0997, -94.5786, "Kansas City, Missouri"),
  m("St. Louis", "US", "north_america", 38.627, -90.1994, "St. Louis, Missouri"),
  m("Columbus", "US", "north_america", 39.9612, -82.9988, "Columbus, Ohio"),
  m("Pittsburgh", "US", "north_america", 40.4406, -79.9959, "Pittsburgh, Pennsylvania"),
  m("Asheville", "US", "north_america", 35.5951, -82.5515, "Asheville, North Carolina"),
  m("Las Vegas", "US", "north_america", 36.1699, -115.1398, "Las Vegas, Nevada"),
  m("San Diego", "US", "north_america", 32.7157, -117.1611, "San Diego, California"),
  m("Toronto", "CA", "north_america", 43.6532, -79.3832, "Toronto, Ontario"),
  m("Montreal", "CA", "north_america", 45.5019, -73.5674, "Montreal"),
  m("Vancouver", "CA", "north_america", 49.2827, -123.1207, "Vancouver"),
  // UK & Europe
  m("London", "GB", "uk_europe", 51.5074, -0.1278, "London, United Kingdom"),
  m("Manchester", "GB", "uk_europe", 53.4808, -2.2426, "Manchester"),
  m("Glasgow", "GB", "uk_europe", 55.8642, -4.2518, "Glasgow, United Kingdom"),
  m("Bristol", "GB", "uk_europe", 51.4545, -2.5879, "Bristol"),
  m("Dublin", "IE", "uk_europe", 53.3498, -6.2603, "Dublin"),
  m("Paris", "FR", "uk_europe", 48.8566, 2.3522, "Paris, France"),
  m("Amsterdam", "NL", "uk_europe", 52.3676, 4.9041, "Amsterdam, Netherlands"),
  m("Brussels", "BE", "uk_europe", 50.8503, 4.3517, "Brussels, Belgium"),
  m("Berlin", "DE", "uk_europe", 52.52, 13.405, "Berlin, Germany"),
  m("Hamburg", "DE", "uk_europe", 53.5511, 9.9937, "Hamburg, Germany"),
  m("Cologne", "DE", "uk_europe", 50.9375, 6.9603, "Cologne"),
  m("Copenhagen", "DK", "uk_europe", 55.6761, 12.5683, "Copenhagen, Capital Region of Denmark"),
  m("Stockholm", "SE", "uk_europe", 59.3293, 18.0686, "Stockholm, Sweden"),
  m("Oslo", "NO", "uk_europe", 59.9139, 10.7522, "Oslo"),
  m("Barcelona", "ES", "uk_europe", 41.3874, 2.1686, "Barcelona, Spain"),
  m("Madrid", "ES", "uk_europe", 40.4168, -3.7038, "Madrid"),
  m("Lisbon", "PT", "uk_europe", 38.7223, -9.1393, "Lisbon, Portugal"),
  m("Milan", "IT", "uk_europe", 45.4642, 9.19, "Milan, Italy"),
  m("Vienna", "AT", "uk_europe", 48.2082, 16.3738, "Vienna, Austria"),
  m("Prague", "CZ", "uk_europe", 50.0755, 14.4378, "Praha"),
  m("Warsaw", "PL", "uk_europe", 52.2297, 21.0122, "Warsaw, Poland"),
  // India
  m("Mumbai", "IN", "india", 19.076, 72.8777, "Mumbai"),
  m("Delhi", "IN", "india", 28.6139, 77.209, "Delhi, India"),
  m("Bengaluru", "IN", "india", 12.9716, 77.5946, "Bengaluru, India"),
  m("Pune", "IN", "india", 18.5204, 73.8567, "Pune, India"),
  m("Hyderabad", "IN", "india", 17.385, 78.4867, "Hyderabad, India"),
  m("Chennai", "IN", "india", 13.0827, 80.2707, "Chennai, India"),
  m("Kolkata", "IN", "india", 22.5726, 88.3639, "Kolkata, India"),
  m("Goa", "IN", "india", 15.2993, 74.124, "Goa, India"),
  m("Jaipur", "IN", "india", 26.9124, 75.7873, "Jaipur, India"),
  m("Ahmedabad", "IN", "india", 23.0225, 72.5714, "Ahmedabad, India"),
  m("Chandigarh", "IN", "india", 30.7333, 76.7794, "Chandigarh, India"),
  m("Kochi", "IN", "india", 9.9312, 76.2673, "Kochi, Kerala"),
  m("Guwahati", "IN", "india", 26.1445, 91.7362, "Guwahati, Assam"),
  // Australia & NZ
  m("Sydney", "AU", "australia_nz", -33.8688, 151.2093, "Sydney, Australia"),
  m("Melbourne", "AU", "australia_nz", -37.8136, 144.9631, "Melbourne, Australia"),
  m("Brisbane", "AU", "australia_nz", -27.4698, 153.0251, "Brisbane"),
  m("Perth", "AU", "australia_nz", -31.9505, 115.8605, "Perth, Australia"),
  m("Adelaide", "AU", "australia_nz", -34.9285, 138.6007, "Adelaide, Australia"),
  m("Auckland", "NZ", "australia_nz", -36.8485, 174.7633, "Auckland, New Zealand"),
  m("Wellington", "NZ", "australia_nz", -41.2865, 174.7762, "Wellington, New Zealand"),
  // Latin America
  m("Mexico City", "MX", "latin_america", 19.4326, -99.1332, "Mexico City, Mexico"),
  m("Guadalajara", "MX", "latin_america", 20.6597, -103.3496, "Guadalajara, Mexico"),
  m("Monterrey", "MX", "latin_america", 25.6866, -100.3161, "Monterrey, Mexico"),
  m("Bogotá", "CO", "latin_america", 4.711, -74.0721, "Bogotá, Colombia"),
  m("Medellín", "CO", "latin_america", 6.2442, -75.5812, "Medellín, Colombia"),
  m("Lima", "PE", "latin_america", -12.0464, -77.0428, "Lima, Peru"),
  m("Santiago", "CL", "latin_america", -33.4489, -70.6693, "Santiago, Chile"),
  m("Buenos Aires", "AR", "latin_america", -34.6037, -58.3816, "Buenos Aires"),
  m("São Paulo", "BR", "latin_america", -23.5505, -46.6333, "São Paulo"),
  m("Rio de Janeiro", "BR", "latin_america", -22.9068, -43.1729, "Rio de Janeiro, Brazil"),
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
