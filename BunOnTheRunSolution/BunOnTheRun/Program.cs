using BunOnTheRun.Services;

namespace BunOnTheRun
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(); 

            builder.Services.AddHttpClient();
            builder.Services.AddScoped<IOsmService, OsmService>();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll",
                    policy =>
                    {
                        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
                    });
            });

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();   
                app.UseSwaggerUI();
            }

            app.UseCors("AllowAll");
            app.MapControllers();

            app.Run();
        }
    }
}