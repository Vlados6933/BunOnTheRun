using BunOnTheRun.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory; // Важно для кэша

namespace BunOnTheRun.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BakeryController : ControllerBase
    {
        private readonly IOsmService _osmService;
        private readonly IMemoryCache _cache; 

        public BakeryController(IOsmService osmService, IMemoryCache cache)
        {
            _osmService = osmService;
            _cache = cache;
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string city, [FromQuery] string address)
        {
            if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(address))
            {
                return BadRequest("Місто та адреса є обов'язковими полями.");
            }

            var cacheKey = $"search_{city.ToLower()}_{address.ToLower()}";

            if (_cache.TryGetValue(cacheKey, out var cachedResult))
            {
                return Ok(cachedResult);
            }

            var coords = await _osmService.GetCoordinatesAsync(city, address);

            if (coords == null)
            {
                return NotFound("Не вдалося знайти таку адресу на карті. Перевірте правильність написання.");
            }

            var bakeries = await _osmService.GetBakeriesAsync(coords.Value.Lat, coords.Value.Lon);

            var result = new
            {
                SearchCenter = new { Lat = coords.Value.Lat, Lon = coords.Value.Lon },
                Bakeries = bakeries,
                Source = "OpenStreetMap" 
            };

            _cache.Set(cacheKey, result, TimeSpan.FromMinutes(10));

            return Ok(result);
        }
    }
}