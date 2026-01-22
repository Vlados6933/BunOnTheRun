using System.Text.Json.Serialization;

namespace BunOnTheRun.Models
{
    public class BakeryDto
    {
        public string Name { get; set; } = "Пекарня без названия";
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? Address { get; set; } 
        public double DistanceMeters { get; set; } 
    }

    public class NominatimResult
    {
        [JsonPropertyName("lat")]
        public string Lat { get; set; } = string.Empty;

        [JsonPropertyName("lon")]
        public string Lon { get; set; } = string.Empty;

        [JsonPropertyName("display_name")]
        public string DisplayName { get; set; } = string.Empty;
    }

    public class OverpassResponse
    {
        [JsonPropertyName("elements")]
        public List<OverpassElement> Elements { get; set; } = new();
    }

    public class OverpassElement
    {
        [JsonPropertyName("lat")]
        public double Lat { get; set; }

        [JsonPropertyName("lon")]
        public double Lon { get; set; }

        [JsonPropertyName("tags")]
        public Dictionary<string, string>? Tags { get; set; }
    }
}