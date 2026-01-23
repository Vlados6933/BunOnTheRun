# Етап 1: Збірка (Build)
# Використовуємо SDK образ для компіляції проекту
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Копіюємо файл проекту та відновлюємо залежності
COPY ["BunOnTheRun/BunOnTheRun.csproj", "BunOnTheRun/"]
RUN dotnet restore "BunOnTheRun/BunOnTheRun.csproj"

# Копіюємо решту файлів і збираємо проект
COPY . .
WORKDIR "/src/BunOnTheRun"
RUN dotnet publish "BunOnTheRun.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Етап 2: Запуск (Runtime)
# Використовуємо легкий Runtime образ для запуску
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Відкриваємо порт 8080 (стандартний для нових .NET образів)
EXPOSE 8080

# Копіюємо скомпільовані файли з етапу build
COPY --from=build /app/publish .

# Задаємо точку входу
ENTRYPOINT ["dotnet", "BunOnTheRun.dll"]
