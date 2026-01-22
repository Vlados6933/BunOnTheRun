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
        private readonly IMemoryCache _cache; // Внедряем кэш

        public BakeryController(IOsmService osmService, IMemoryCache cache)
        {
            _osmService = osmService;
            _cache = cache;
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string city, [FromQuery] string address)
        {
            // 1. Валидация на украинском
            if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(address))
            {
                return BadRequest("Місто та адреса є обов'язковими полями.");
            }

            // 2. Формируем уникальный ключ для кэша (например: "search_Київ_Хрещатик")
            var cacheKey = $"search_{city.ToLower()}_{address.ToLower()}";

            // 3. ПРОВЕРКА КЭША: Если данные есть в памяти, отдаем их сразу!
            if (_cache.TryGetValue(cacheKey, out var cachedResult))
            {
                return Ok(cachedResult);
            }

            // --- Если в кэше пусто, делаем реальный запрос ---

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
                Source = "OpenStreetMap" // Метка, откуда данные
            };

            // 4. СОХРАНЯЕМ В КЭШ (на 10 минут)
            _cache.Set(cacheKey, result, TimeSpan.FromMinutes(10));

            return Ok(result);
        }
    }
}