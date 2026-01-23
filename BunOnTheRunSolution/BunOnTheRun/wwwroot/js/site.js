document.addEventListener('DOMContentLoaded', () => {
    // 1. Ініціалізація карти (центр - Київ за замовчуванням)
    const map = L.map('map').setView([50.4501, 30.5234], 13);

    // Додаємо шар карти OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let markers = []; // Зберігаємо маркери, щоб видаляти старі

    const searchBtn = document.getElementById('searchBtn');
    const cityInput = document.getElementById('cityInput');
    const addressInput = document.getElementById('addressInput');
    const bakeryList = document.getElementById('bakeryList');
    const resultsTitle = document.getElementById('resultsTitle');

    // 2. Функція пошуку
    async function searchBakeries() {
        const city = cityInput.value;
        const address = addressInput.value;

        if (!city || !address) {
            alert("Будь ласка, введіть місто та вулицю.");
            return;
        }

        // Очищаємо список і маркери
        bakeryList.innerHTML = '<div class="loading">Шукаємо найсвіжіші булочки... 🥨</div>';
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        try {
            // Запит до твого Backend API
            const response = await fetch(`/api/bakery/search?city=${encodeURIComponent(city)}&address=${encodeURIComponent(address)}`);

            if (!response.ok) {
                const errorText = await response.text();
                bakeryList.innerHTML = `<div class="error">Помилка: ${errorText}</div>`;
                return;
            }

            const data = await response.json();

            // Оновлюємо заголовок
            resultsTitle.innerText = `Знайдено пекарень: ${data.bakeries.length}`;
            bakeryList.innerHTML = '';

            // Центруємо карту на знайденій адресі
            const userLocation = [data.searchCenter.lat, data.searchCenter.lon];
            map.setView(userLocation, 15);

            // Маркер користувача (червоний)
            const userMarker = L.marker(userLocation).addTo(map)
                .bindPopup("Ви тут! 🏠").openPopup();
            markers.push(userMarker);

            // 3. Вивід пекарень
            if (data.bakeries.length === 0) {
                bakeryList.innerHTML = '<p>На жаль, поруч пекарень не знайдено :(</p>';
                return;
            }

            data.bakeries.forEach(bakery => {
                // Додаємо маркер на карту
                const marker = L.marker([bakery.latitude, bakery.longitude]).addTo(map);
                marker.bindPopup(`<b>${bakery.name}</b><br>${bakery.address || ''}`);
                markers.push(marker);

                // Додаємо картку в список
                const card = document.createElement('div');
                card.className = 'bakery-card';

                // Формуємо посилання на Google Maps
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${bakery.latitude},${bakery.longitude}`;

                card.innerHTML = `
                    <div class="icon-box">🥯</div>
                    <div class="card-content">
                        <h3 class="bakery-name">"${bakery.name}"</h3>
                        <a href="${googleMapsUrl}" target="_blank" class="btn-google">
                            Показати на Google карті ↗
                        </a>
                        <div class="distance-info">${Math.round(bakery.distanceMeters)} метрів від вас</div>
                    </div>
                `;
                bakeryList.appendChild(card);
            });

        } catch (error) {
            console.error(error);
            bakeryList.innerHTML = '<div class="error">Щось пішло не так при з\'єднанні з сервером.</div>';
        }
    }

    // Слухаємо клік по кнопці та Enter в полях
    searchBtn.addEventListener('click', searchBakeries);
    addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBakeries();
    });
});