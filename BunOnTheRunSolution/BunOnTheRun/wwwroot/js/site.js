document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. ІНІЦІАЛІЗАЦІЯ КАРТИ
    // ---------------------------------------------------------
    const defaultLat = 50.4501;
    const defaultLon = 30.5234;

    if (!document.getElementById('map')) return;

    const map = L.map('map').setView([defaultLat, defaultLon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let markers = [];

    // Іконки
    const userIcon = L.icon({
        iconUrl: '/images/user-pin.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });

    const bakeryIcon = new L.Icon.Default();

    // ---------------------------------------------------------
    // 2. ЕЛЕМЕНТИ ТА ЗМІННІ
    // ---------------------------------------------------------
    const searchBtn = document.getElementById('searchBtn');
    const cityInput = document.getElementById('cityInput');
    const addressInput = document.getElementById('addressInput');
    const bakeryList = document.getElementById('bakeryList');
    const resultsTitle = document.getElementById('resultsTitle');
    const suggestionsList = document.getElementById('suggestionsList');
    let debounceTimer;

    // ---------------------------------------------------------
    // 3. АВТОДОПОВНЕННЯ (Photon / OSM)
    // ---------------------------------------------------------
    if (addressInput && suggestionsList) {
        addressInput.addEventListener('input', () => {
            const query = addressInput.value.trim();
            const city = cityInput.value.trim();

            clearTimeout(debounceTimer);
            if (query.length < 2) { suggestionsList.style.display = 'none'; return; }

            debounceTimer = setTimeout(async () => {
                try {
                    const fullQuery = city ? `${city}, ${query}` : query;
                    // Використовуємо Nominatim для підказок (або Photon, якщо змінив URL)
                    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&addressdetails=1&limit=5&accept-language=uk`;

                    const response = await fetch(url);
                    if (!response.ok) return;

                    const data = await response.json();
                    renderSuggestions(data);
                } catch (error) { console.error(error); }
            }, 300);
        });
    }

    function renderSuggestions(data) {
        suggestionsList.innerHTML = '';
        if (data.length === 0) { suggestionsList.style.display = 'none'; return; }

        data.forEach(item => {
            const li = document.createElement('li');
            let displayText = item.address.road || item.address.pedestrian || item.display_name.split(',')[0];
            if (item.address.house_number) displayText += `, ${item.address.house_number}`;

            li.textContent = displayText;
            li.addEventListener('click', () => {
                addressInput.value = displayText;
                suggestionsList.style.display = 'none';
            });
            suggestionsList.appendChild(li);
        });
        suggestionsList.style.display = 'block';
    }

    document.addEventListener('click', (e) => {
        if (addressInput && suggestionsList && !addressInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            suggestionsList.style.display = 'none';
        }
    });

    // ---------------------------------------------------------
    // 4. ПОШУК ТА ВІДОБРАЖЕННЯ (З НОВОЮ ФІЧЕЮ)
    // ---------------------------------------------------------
    async function searchBakeries() {
        const city = cityInput.value;
        const address = addressInput.value;
        if (suggestionsList) suggestionsList.style.display = 'none';

        if (!city || !address) { alert("Введіть місто та вулицю."); return; }

        bakeryList.innerHTML = '<div class="loading">Шукаємо булочки... 🥨</div>';

        // Видаляємо старі маркери
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        try {
            const response = await fetch(`/api/bakery/search?city=${encodeURIComponent(city)}&address=${encodeURIComponent(address)}`);
            if (!response.ok) {
                const errText = await response.text();
                bakeryList.innerHTML = `<div class="error">Помилка: ${errText}</div>`;
                return;
            }
            const data = await response.json();

            resultsTitle.innerText = `Знайдено пекарень: ${data.bakeries.length}`;
            bakeryList.innerHTML = '';

            // Центр і маркер користувача
            const userLocation = [data.searchCenter.lat, data.searchCenter.lon];
            map.setView(userLocation, 15);

            const userMarker = L.marker(userLocation, { icon: userIcon }).addTo(map)
                .bindPopup("<b>Ви тут! 🏠</b>").openPopup();
            markers.push(userMarker);

            if (data.bakeries.length === 0) {
                bakeryList.innerHTML = '<p class="empty-state">Пекарень поруч не знайдено :(</p>'; return;
            }

            data.bakeries.forEach(bakery => {
                // 1. Створюємо маркер
                const marker = L.marker([bakery.latitude, bakery.longitude], { icon: bakeryIcon }).addTo(map);

                // Контент попапу
                let popupContent = `<b>${bakery.name}</b><br>${bakery.address || 'Адреса не вказана'}`;
                if (bakery.openingHours) {
                    const formattedHours = bakery.openingHours.replace(/;/g, '<br>');
                    popupContent += `<div class="opening-hours-popup"><span class="opening-hours-title">🕒 Графік роботи:</span>${formattedHours}</div>`;
                } else {
                    popupContent += `<div class="opening-hours-popup" style="color: #999;">🕒 Графік не вказано</div>`;
                }
                marker.bindPopup(popupContent);
                markers.push(marker);

                // 2. Створюємо картку
                const card = document.createElement('div');
                card.className = 'bakery-card';
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${bakery.latitude},${bakery.longitude}`;

                card.innerHTML = `
                    <div class="icon-box">🥯</div>
                    <div class="card-content">
                        <h3 class="bakery-name">"${bakery.name}"</h3>
                        <a href="${googleMapsUrl}" target="_blank" class="btn-google">Показати на Google карті ↗</a>
                        <div class="distance-info">${Math.round(bakery.distanceMeters)} метрів від вас</div>
                    </div>`;

                // --- НОВА ЛОГІКА КЛІКУ ПО КАРТЦІ ---
                card.addEventListener('click', () => {
                    // Плавно летимо до пекарні
                    map.flyTo([bakery.latitude, bakery.longitude], 17, {
                        animate: true,
                        duration: 1.5
                    });
                    // Відкриваємо попап маркера
                    marker.openPopup();

                    // (Опціонально) Підсвічуємо картку, щоб видно було, що вона обрана
                    document.querySelectorAll('.bakery-card').forEach(c => c.style.borderColor = '#EAD8C0');
                    card.style.borderColor = '#E6A349';
                });

                // Важливо: Клік по кнопці Google Maps не повинен рухати карту на сайті
                const googleBtn = card.querySelector('.btn-google');
                if (googleBtn) {
                    googleBtn.addEventListener('click', (event) => {
                        event.stopPropagation(); // Зупиняємо "спливання" події, щоб батьківська картка не реагувала
                    });
                }

                bakeryList.appendChild(card);
            });

        } catch (error) {
            console.error(error);
            bakeryList.innerHTML = '<div class="error">Помилка з\'єднання.</div>';
        }
    }

    if (searchBtn) searchBtn.addEventListener('click', searchBakeries);
    if (addressInput) addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { if (suggestionsList) suggestionsList.style.display = 'none'; searchBakeries(); }
    });
});