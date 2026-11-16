"use strict";

/* Weather Dashboard — live data only, from Open-Meteo (free, no API key).
   Geocoding API for city search, Forecast API for current + 7-day forecast.
   No weather figures are hardcoded; if the API is unreachable, the page says so. */

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const suggestionsEl = document.getElementById("suggestions");
const statusEl = document.getElementById("status");
const currentEl = document.getElementById("current");
const forecastSection = document.getElementById("forecast-section");
const forecastEl = document.getElementById("forecast");

/* WMO weather codes → [description, icon] */
const WMO = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Depositing rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Dense drizzle", "🌦️"],
  56: ["Light freezing drizzle", "🌦️"],
  57: ["Dense freezing drizzle", "🌦️"],
  61: ["Slight rain", "🌧️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Light freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Slight snow", "❄️"],
  73: ["Snow", "❄️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Slight rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Violent rain showers", "🌧️"],
  85: ["Slight snow showers", "❄️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with slight hail", "⛈️"],
  99: ["Thunderstorm with heavy hail", "⛈️"],
};

function describe(code) {
  return WMO[code] || ["—", "🌡️"];
}

function compass(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", !!isError);
}

function showLoading(msg) {
  setStatus(msg || "Loading…");
  currentEl.hidden = true;
  forecastSection.hidden = true;
}

async function geocode(query) {
  const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  return data.results || [];
}

async function loadWeather(place) {
  showLoading(`Loading weather for ${place.name}…`);
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "7",
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error("Forecast request failed");
  const data = await res.json();
  if (data.error) throw new Error(data.reason || "Forecast request failed");
  render(place, data);
  try {
    localStorage.setItem("weather-last-place", JSON.stringify(place));
  } catch (e) {
    /* storage unavailable — the app still works, it just won't remember */
  }
}

function render(place, data) {
  const cur = data.current;
  const [cond, icon] = describe(cur.weather_code);

  /* cur.time is wall-clock time at the location (e.g. "2026-11-16T11:30").
     Display it as-is instead of re-interpreting it in the browser's timezone. */
  const [datePart, timePart] = cur.time.split("T");
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(datePart + "T00:00:00Z"));
  const [hh, mm] = timePart.split(":");
  const hour12 = ((+hh + 11) % 12) + 1;
  const ampm = +hh >= 12 ? "PM" : "AM";
  const localTime = `${dayLabel}, ${hour12}:${mm} ${ampm}`;

  document.getElementById("location-name").textContent =
    [place.name, place.admin1, place.country].filter(Boolean).join(", ");
  document.getElementById("location-meta").textContent = `Local time: ${localTime}`;
  document.getElementById("current-icon").textContent = icon;
  document.getElementById("current-temp").textContent = Math.round(cur.temperature_2m);
  document.getElementById("current-condition").textContent = cond;
  document.getElementById("feels-like").textContent = `${Math.round(cur.apparent_temperature)}°F`;
  document.getElementById("humidity").textContent = `${cur.relative_humidity_2m}%`;
  document.getElementById("wind").textContent =
    `${Math.round(cur.wind_speed_10m)} mph ${compass(cur.wind_direction_10m)}`;
  const todayPrecip = data.daily.precipitation_probability_max[0];
  document.getElementById("precip").textContent =
    todayPrecip != null ? `${todayPrecip}%` : "—";

  forecastEl.innerHTML = "";
  data.daily.time.forEach((dateStr, i) => {
    const [dCond, dIcon] = describe(data.daily.weather_code[i]);
    /* dateStr is the location's local date; weekday from the date itself (UTC). */
    const dayName = i === 0 ? "Today" : new Intl.DateTimeFormat("en-US", {
      weekday: "short", timeZone: "UTC",
    }).format(new Date(dateStr + "T00:00:00Z"));
    const precip = data.daily.precipitation_probability_max[i];
    const card = document.createElement("article");
    card.className = "forecast-card";
    card.innerHTML = `
      <p class="forecast-day">${dayName}</p>
      <p class="forecast-icon" aria-hidden="true">${dIcon}</p>
      <p class="forecast-cond">${dCond}</p>
      <p class="forecast-temps"><span class="high">${Math.round(data.daily.temperature_2m_max[i])}°</span> / <span class="low">${Math.round(data.daily.temperature_2m_min[i])}°</span></p>
      <p class="forecast-precip">${precip != null ? "💧 " + precip + "%" : ""}</p>`;
    forecastEl.appendChild(card);
  });

  setStatus("");
  currentEl.hidden = false;
  forecastSection.hidden = false;
}

function loadErrorMessage(err) {
  if (/limit/i.test(err && err.message ? err.message : "")) {
    return "Open-Meteo's daily request limit was reached from this connection — please try again later.";
  }
  return "Could not load weather — check your connection and try again.";
}

async function selectPlace(place) {
  try {
    await loadWeather(place);
  } catch (err) {
    setStatus(loadErrorMessage(err), true);
  }
}

async function showSuggestions(query) {
  try {
    const results = await geocode(query);
    suggestionsEl.innerHTML = "";
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "suggestion-empty";
      li.textContent = `No places found for “${query}”.`;
      suggestionsEl.appendChild(li);
    } else {
      results.forEach((r) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "suggestion";
        btn.textContent = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
        btn.addEventListener("click", () => {
          suggestionsEl.hidden = true;
          suggestionsEl.innerHTML = "";
          input.value = r.name;
          selectPlace(r);
        });
        li.appendChild(btn);
        suggestionsEl.appendChild(li);
      });
    }
    suggestionsEl.hidden = false;
  } catch (err) {
    /* Suggestions are a convenience; a failed lookup just hides them. */
    suggestionsEl.hidden = true;
  }
}

let searchTimer = null;
input.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = input.value.trim();
  if (q.length < 2) {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
    return;
  }
  searchTimer = setTimeout(() => showSuggestions(q), 300);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  suggestionsEl.hidden = true;
  showLoading("Searching…");
  try {
    const results = await geocode(q);
    if (!results.length) {
      setStatus("City not found — try another name.", true);
      return;
    }
    await selectPlace(results[0]);
  } catch (err) {
    setStatus(loadErrorMessage(err), true);
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-section")) {
    suggestionsEl.hidden = true;
  }
});

/* Initial load: last searched city if remembered, otherwise New York. */
let initial = null;
try {
  initial = JSON.parse(localStorage.getItem("weather-last-place") || "null");
} catch (e) {
  initial = null;
}
if (!initial || typeof initial.latitude !== "number" || typeof initial.longitude !== "number") {
  initial = {
    name: "New York",
    admin1: "New York",
    country: "United States",
    latitude: 40.71427,
    longitude: -74.00597,
  };
}
input.value = initial.name;
selectPlace(initial);
