using System.Globalization;
using System.Text.Json;
using BunOnTheRun.Models;

namespace BunOnTheRun.Services
{
    public interface IOsmService
    {
        Task<(double Lat, double Lon)?> GetCoordinatesAsync(string city, string address);
        Task<List<BakeryDto>> GetBakeriesAsync(double lat, double lon, double radiusMeters = 2000);
    }

    public class OsmService : IOsmService
    {
        private readonly HttpClient _httpClient;

        public OsmService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            // Photon не такий вибагливий до заголовків, але хорошим тоном є залишити User-Agent
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "BunOnTheRun-StudentProject/1.0");
        }

        public async Task<(double Lat, double Lon)?> GetCoordinatesAsync(string city, string address)
        {
            var query = $"{city}, {address}";
            
            // Використовуємо API Photon. Він розумний і часто виправляє одруківки.
            // limit=1 означає, що нам потрібен тільки один (найкращий) результат.
            var url = $"https://photon.komoot.io/api/?q={Uri.EscapeDataString(query)}&limit=1";

            try
            {
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                
                // Photon повертає GeoJSON. Парсимо його "на льоту" без створення зайвих класів.
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                
                if (root.TryGetProperty("features", out var features) && features.GetArrayLength() > 0)
                {
                    var firstFeature = features[0];
                    var geometry = firstFeature.GetProperty("geometry");
                    var coordinates = geometry.GetProperty("coordinates");

                    // Увага! GeoJSON повертає координати в порядку [Longitude, Latitude] (Довгота, Широта)
                    double lon = coordinates[0].GetDouble();
                    double lat = coordinates[1].GetDouble();

                    return (lat, lon);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting coordinates via Photon: {ex.Message}");
            }
            return null;
        }

        public async Task<List<BakeryDto>> GetBakeriesAsync(double userLat, double userLon, double radiusMeters = 1000) 
        {
            // Для пошуку об'єктів (пекарень) Overpass API залишається найкращим інструментом
            var query = $"[out:json][timeout:10];node[\"shop\"=\"bakery\"](around:{radiusMeters},{userLat.ToString(CultureInfo.InvariantCulture)},{userLon.ToString(CultureInfo.InvariantCulture)});out;";
            var url = $"https://overpass.kumi.systems/api/interpreter?data={Uri.EscapeDataString(query)}";

            try
            {
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<OverpassResponse>(json);

                var bakeries = new List<BakeryDto>();

                if (data?.Elements != null)
                {
                    foreach (var item in data.Elements)
                    {
                        var tags = item.Tags ?? new Dictionary<string, string>();

                        // 1. Назва
                        string name = "Пекарня без назви";
                        if (tags.ContainsKey("name:uk")) name = tags["name:uk"];
                        else if (tags.ContainsKey("name")) name = tags["name"];

                        // 2. Розумний пошук адреси (перевіряємо кілька полів)
                        string? address = null;
                        
                        if (tags.ContainsKey("addr:street")) // Стандартна вулиця
                        {
                            address = tags["addr:street"];
                            if (tags.ContainsKey("addr:housenumber"))
                                address += $", {tags["addr:housenumber"]}";
                        }
                        else if (tags.ContainsKey("addr:place")) // Місце/Площа
                        {
                            address = tags["addr:place"];
                            if (tags.ContainsKey("addr:housenumber"))
                                address += $", {tags["addr:housenumber"]}";
                        }
                        else if (tags.ContainsKey("addr:full")) // Повна адреса одним рядком
                        {
                            address = tags["addr:full"];
                        }

                        // 3. Графік роботи
                        string? openingHours = null;
                        if (tags.ContainsKey("opening_hours"))
                        {
                            openingHours = LocalizeOpeningHours(tags["opening_hours"]);
                        }

                        bakeries.Add(new BakeryDto
                        {
                            Name = name,
                            Latitude = item.Lat,
                            Longitude = item.Lon,
                            Address = address,
                            OpeningHours = openingHours,
                            DistanceMeters = CalculateDistance(userLat, userLon, item.Lat, item.Lon)
                        });
                    }
                }
                
                return bakeries.OrderBy(b => b.DistanceMeters).ToList();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting bakeries: {ex.Message}");
                return new List<BakeryDto>();
            }
        }

        private string LocalizeOpeningHours(string rawHours)
        {
            if (string.IsNullOrWhiteSpace(rawHours)) return null;

            return rawHours
                .Replace("Mo", "Пн")
                .Replace("Tu", "Вт")
                .Replace("We", "Ср")
                .Replace("Th", "Чт")
                .Replace("Fr", "Пт")
                .Replace("Sa", "Сб")
                .Replace("Su", "Нд")
                .Replace("PH", "Свята")
                .Replace("off", "Вихідний")
                .Replace("24/7", "Цілодобово");
        }

        private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
        {
            var R = 6371e3; 
            var phi1 = lat1 * Math.PI / 180;
            var phi2 = lat2 * Math.PI / 180;
            var deltaPhi = (lat2 - lat1) * Math.PI / 180;
            var deltaLambda = (lon2 - lon1) * Math.PI / 180;

            var a = Math.Sin(deltaPhi / 2) * Math.Sin(deltaPhi / 2) +
                    Math.Cos(phi1) * Math.Cos(phi2) *
                    Math.Sin(deltaLambda / 2) * Math.Sin(deltaLambda / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }
    }
}