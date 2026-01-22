using Microsoft.AspNetCore.Mvc;

namespace BunOnTheRun.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
