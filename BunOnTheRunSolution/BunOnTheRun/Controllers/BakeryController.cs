using BunOnTheRun.Services;
using Microsoft.AspNetCore.Mvc;

namespace BunOnTheRun.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BakeryController : ControllerBase
    {
        private readonly IOsmService _osmService;

        public BakeryController(IOsmService osmService)
        {
            _osmService = osmService;
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string city, [FromQuery] string address)
        {
            if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(address))
            {
                return BadRequest("Город и адрес обязательны.");
            }

            var coords = await _osmService.GetCoordinatesAsync(city, address);

            if (coords == null)
            {
                return NotFound("Не удалось найти такой адрес на карте.");
            }

            var bakeries = await _osmService.GetBakeriesAsync(coords.Value.Lat, coords.Value.Lon);

            var result = new
            {
                SearchCenter = new { Lat = coords.Value.Lat, Lon = coords.Value.Lon },
                Bakeries = bakeries
            };

            return Ok(result);
        }
    }
}