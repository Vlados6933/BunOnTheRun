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
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "BunOnTheRun-StudentProject/1.0");
        }

        public async Task<(double Lat, double Lon)?> GetCoordinatesAsync(string city, string address)
        {
            var query = $"{city}, {address}";
            var url = $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(query)}&format=json&limit=1";

            try
            {
                var response = await _httpClient.GetAsync(url);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var results = JsonSerializer.Deserialize<List<NominatimResult>>(json);

                if (results != null && results.Any())
                {
                    var lat = double.Parse(results[0].Lat, CultureInfo.InvariantCulture);
                    var lon = double.Parse(results[0].Lon, CultureInfo.InvariantCulture);
                    return (lat, lon);
                }
            }
            catch (Exception ex)
            {

                Console.WriteLine($"Ошибка геокодинга: {ex.Message}");
            }

            return null;
        }

        public async Task<List<BakeryDto>> GetBakeriesAsync(double userLat, double userLon, double radiusMeters = 2000)
        {
            // Запрос оставляем тем же
            var query = $"[out:json];node[\"shop\"=\"bakery\"](around:{radiusMeters},{userLat.ToString(CultureInfo.InvariantCulture)},{userLon.ToString(CultureInfo.InvariantCulture)});out;";
            var url = $"https://overpass-api.de/api/interpreter?data={Uri.EscapeDataString(query)}";

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

                        // 1. Достаем название
                        var name = tags.ContainsKey("name") ? tags["name"] : "Безымянная пекарня";

                        // 2. Достаем адрес (НОВОЕ)
                        string? address = null;
                        if (tags.ContainsKey("addr:street"))
                        {
                            address = tags["addr:street"];
                            if (tags.ContainsKey("addr:housenumber"))
                            {
                                address += $", {tags["addr:housenumber"]}";
                            }
                        }

                        bakeries.Add(new BakeryDto
                        {
                            Name = name,
                            Latitude = item.Lat,
                            Longitude = item.Lon,
                            Address = address, // Теперь тут будет строка или null, если адреса нет
                            DistanceMeters = CalculateDistance(userLat, userLon, item.Lat, item.Lon)
                        });
                    }
                }
                return bakeries;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка поиска мест: {ex.Message}");
                return new List<BakeryDto>();
            }
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