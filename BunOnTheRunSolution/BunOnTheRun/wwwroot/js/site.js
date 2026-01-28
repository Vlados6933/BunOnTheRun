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

    // ---------------------------------------------------------
    // ІКОНКИ
    // ---------------------------------------------------------

    // Іконка користувача (Велика)
    const userIcon = L.icon({
        iconUrl: '/images/user-pin.png',
        iconSize: [80, 80],
        iconAnchor: [40, 80],
        popupAnchor: [0, -80]
    });

    // Іконка пекарні (Кастомна)
    const bakeryIcon = L.icon({
        iconUrl: '/images/bakery-pin.png',
        iconSize: [50, 50],
        iconAnchor: [25, 50],
        popupAnchor: [0, -50]
    });

    // ---------------------------------------------------------
    // 2. ЕЛЕМЕНТИ
    // ---------------------------------------------------------
    const searchBtn = document.getElementById('searchBtn');
    const locateBtn = document.getElementById('locateBtn'); // Кнопка геолокації
    const cityInput = document.getElementById('cityInput');
    const addressInput = document.getElementById('addressInput');
    const bakeryList = document.getElementById('bakeryList');
    const resultsTitle = document.getElementById('resultsTitle');
    const suggestionsList = document.getElementById('suggestionsList');
    let debounceTimer;

    // ---------------------------------------------------------
    // 3. ФУНКЦІЯ ГЕОЛОКАЦІЇ (Locate Me)
    // ---------------------------------------------------------
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Ваш браузер не підтримує геолокацію.");
                return;
            }

            // Індикація завантаження
            const originalText = locateBtn.innerHTML;
            locateBtn.innerHTML = '⏳ Шукаємо...';
            locateBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    try {
                        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=uk`;
                        const response = await fetch(url);

                        if (!response.ok) throw new Error("Не вдалося отримати адресу");

                        const data = await response.json();
                        const addr = data.address;

                        const city = addr.city || addr.town || addr.village || addr.county || "";
                        const street = addr.road || addr.pedestrian || addr.suburb || "";
                        const houseNumber = addr.house_number ? `, ${addr.house_number}` : "";

                        if (city) cityInput.value = city;
                        if (street) addressInput.value = street + houseNumber;

                        locateBtn.innerHTML = originalText;
                        locateBtn.disabled = false;

                        searchBakeries();

                    } catch (error) {
                        console.error(error);
                        alert("Не вдалося визначити адресу.");
                        locateBtn.innerHTML = originalText;
                        locateBtn.disabled = false;
                    }
                },
                (error) => {
                    if (error.code === error.PERMISSION_DENIED) {
                        alert("Будь ласка, дозвольте доступ до геолокації.");
                    } else {
                        alert("Помилка отримання геопозиції.");
                    }
                    locateBtn.innerHTML = originalText;
                    locateBtn.disabled = false;
                }
            );
        });
    }

    // ---------------------------------------------------------
    // 4. АВТОДОПОВНЕННЯ АДРЕСИ
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
    // 5. ПОШУК ТА ВІДОБРАЖЕННЯ
    // ---------------------------------------------------------
    async function searchBakeries() {
        const city = cityInput.value;
        const address = addressInput.value;
        if (suggestionsList) suggestionsList.style.display = 'none';

        if (!city || !address) { alert("Введіть місто та вулицю."); return; }

        bakeryList.innerHTML = '<div class="loading">Шукаємо булочки... 🥨</div>';
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

            const userLocation = [data.searchCenter.lat, data.searchCenter.lon];
            map.setView(userLocation, 15);

            const userMarker = L.marker(userLocation, { icon: userIcon }).addTo(map)
                .bindPopup("<b>Ви тут! 🏠</b>").openPopup();
            markers.push(userMarker);

            if (data.bakeries.length === 0) {
                bakeryList.innerHTML = '<p class="empty-state">Пекарень поруч не знайдено :(</p>'; return;
            }

            data.bakeries.forEach(bakery => {
                const marker = L.marker([bakery.latitude, bakery.longitude], { icon: bakeryIcon }).addTo(map);

                let popupContent = `<b>${bakery.name}</b><br>${bakery.address || 'Адреса не вказана'}`;
                if (bakery.openingHours) {
                    const formattedHours = bakery.openingHours.replace(/;/g, '<br>');
                    popupContent += `<div class="opening-hours-popup"><span class="opening-hours-title">🕒 Графік роботи:</span>${formattedHours}</div>`;
                }
                marker.bindPopup(popupContent);
                markers.push(marker);

                const card = document.createElement('div');
                card.className = 'bakery-card';
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${bakery.latitude},${bakery.longitude}`;

                let logoHtml = '<div class="icon-box">🥯</div>';

                if (bakery.website) {
                    try {
                        let safeUrl = bakery.website.trim();
                        if (safeUrl.startsWith('http://')) safeUrl = safeUrl.replace('http://', '');
                        if (safeUrl.startsWith('https://')) safeUrl = safeUrl.replace('https://', '');
                        if (safeUrl.includes('/')) safeUrl = safeUrl.split('/')[0];

                        const logoUrl = `https://www.google.com/s2/favicons?domain=${safeUrl}&sz=128`;

                        logoHtml = `
                            <div class="logo-wrapper">
                                <img src="${logoUrl}" alt="${bakery.name}" 
                                     onerror="this.parentElement.innerHTML='<div class=\\'icon-box\\'>🥯</div>'"> 
                            </div>
                        `;
                    } catch (e) {
                        console.log("Помилка URL:", e);
                    }
                }

                card.innerHTML = `
                    ${logoHtml}
                    <div class="card-content">
                        <h3 class="bakery-name">"${bakery.name}"</h3>
                        <a href="${googleMapsUrl}" target="_blank" class="btn-google">Показати на Google карті ↗</a>
                        <div class="distance-info">${Math.round(bakery.distanceMeters)} метрів від вас</div>
                    </div>`;

                card.addEventListener('click', () => {
                    map.flyTo([bakery.latitude, bakery.longitude], 17, { animate: true, duration: 1.5 });
                    marker.openPopup();
                });

                const googleBtn = card.querySelector('.btn-google');
                if (googleBtn) {
                    googleBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
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