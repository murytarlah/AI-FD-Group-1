import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'

type GeocodingResponse = {
  results?: Array<{
    name: string
    admin1?: string
    country: string
    latitude: number
    longitude: number
  }>
}

type Location = {
  name: string
  state?: string
  country: string
  time: string
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  weatherCode: number
  forecast: DailyForecast[]
}

type WeatherResponse = {
  current?: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    weather_code: number
  }
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weather_code: number[]
  }
}

type DailyForecast = {
  date: string
  maximum: number
  minimum: number
  weatherCode: number
}

function getWeatherSummary(code: number) {
  if (code === 0) return { label: 'Clear sky', icon: '☀' }
  if (code === 1) return { label: 'Mainly clear', icon: '☀' }
  if (code === 2) return { label: 'Partly cloudy', icon: '◐' }
  if (code === 3) return { label: 'Overcast', icon: '☁' }
  if (code === 45 || code === 48) return { label: 'Foggy', icon: '≋' }
  if (code >= 51 && code <= 67) return { label: 'Rainy', icon: '☂' }
  if (code >= 71 && code <= 77) return { label: 'Snowy', icon: '❄' }
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: '☂' }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: '❄' }
  if (code >= 95 && code <= 99) {
    return { label: 'Thunderstorm', icon: '⚡' }
  }
  return { label: 'Unknown conditions', icon: '☁' }
}

type WeatherTheme = 'idle' | 'sunny' | 'cloudy' | 'rainy' | 'snowy'

function getWeatherTheme(code: number): WeatherTheme {
  if (
    code >= 51 && code <= 67 ||
    code >= 80 && code <= 82 ||
    code >= 95 && code <= 99
  ) {
    return 'rainy'
  }
  if (code >= 71 && code <= 77 || code >= 85 && code <= 86) {
    return 'snowy'
  }
  if (code <= 2) {
    return 'sunny'
  }
  return 'cloudy'
}

// Particle layouts are fixed so the scene doesn't reshuffle on every render.
const RAIN_DROPS = Array.from({ length: 70 }, (_, index) => ({
  x: (index * 37) % 100,
  delay: -((index * 0.27) % 1.5),
  duration: 0.55 + ((index * 7) % 6) * 0.08,
  length: 3 + ((index * 3) % 4),
}))

const SNOW_FLAKES = Array.from({ length: 60 }, (_, index) => ({
  x: (index * 53) % 100,
  delay: -((index * 1.7) % 12),
  duration: 8 + ((index * 5) % 7),
  size: 0.2 + ((index * 3) % 4) * 0.1,
  drift: (index % 2 ? 1 : -1) * (1 + (index % 3)),
}))

const CLOUDS = Array.from({ length: 6 }, (_, index) => ({
  y: 4 + index * 8,
  delay: -index * 14,
  duration: 55 + ((index * 13) % 35),
  scale: 0.8 + ((index * 2) % 5) * 0.15,
}))

function WeatherScene({ theme }: { theme: WeatherTheme }) {
  return (
    <div className={`weather-scene scene-${theme}`} aria-hidden="true">
      {theme === 'sunny' && (
        <>
          <div className="sun-glow" />
          <div className="sun-rays" />
          <div className="sun" />
        </>
      )}
      {(theme === 'cloudy' || theme === 'rainy') &&
        CLOUDS.map((cloud, index) => (
          <span
            key={index}
            className="cloud"
            style={
              {
                '--y': `${cloud.y}%`,
                '--delay': `${cloud.delay}s`,
                '--duration': `${cloud.duration}s`,
                '--scale': cloud.scale,
              } as CSSProperties
            }
          />
        ))}
      {theme === 'rainy' &&
        RAIN_DROPS.map((drop, index) => (
          <span
            key={index}
            className="raindrop"
            style={
              {
                '--x': `${drop.x}%`,
                '--delay': `${drop.delay}s`,
                '--duration': `${drop.duration}s`,
                '--length': `${drop.length}rem`,
              } as CSSProperties
            }
          />
        ))}
      {theme === 'snowy' &&
        SNOW_FLAKES.map((flake, index) => (
          <span
            key={index}
            className="snowflake"
            style={
              {
                '--x': `${flake.x}%`,
                '--delay': `${flake.delay}s`,
                '--duration': `${flake.duration}s`,
                '--size': `${flake.size}rem`,
                '--drift': `${flake.drift}rem`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  )
}

function formatLocalTime(time: string) {
  return new Date(time).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function DailyForecastCard({ day }: { day: DailyForecast }) {
  const weather = getWeatherSummary(day.weatherCode)
  const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: 'short' },
  )
  const date = new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <article className="forecast-day">
      <p className="forecast-weekday">{weekday}</p>
      <p className="forecast-date">{date}</p>
      <span className="forecast-icon" role="img" aria-label={weather.label}>
        {weather.icon}
      </span>
      <p className="forecast-temperatures" aria-label="High and low temperature">
        <span className="forecast-high">{day.maximum.toFixed(1)}°</span>
        <span className="forecast-low">{day.minimum.toFixed(1)}°</span>
      </p>
    </article>
  )
}

function App() {
  const [city, setCity] = useState('')
  const [location, setLocation] = useState<Location | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const searchTerm = city.trim()
    if (!searchTerm) {
      setError('Enter a city name.')
      setLocation(null)
      return
    }

    setIsSearching(true)
    setError(null)
    setLocation(null)

    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`,
      )
      if (!response.ok) {
        throw new Error('Could not search for that city.')
      }

      const data: GeocodingResponse = await response.json()
      const result = data.results?.[0]
      if (!result) {
        throw new Error('City not found.')
      }

      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=3&temperature_unit=celsius&timezone=auto`,
      )
      if (!weatherResponse.ok) {
        throw new Error('Could not load the temperature.')
      }

      const weatherData: WeatherResponse = await weatherResponse.json()
      const temperature = weatherData.current?.temperature_2m
      const current = weatherData.current
      const daily = weatherData.daily
      if (
        !current ||
        temperature === undefined ||
        !daily ||
        daily.time.length < 3 ||
        daily.temperature_2m_max.length < 3 ||
        daily.temperature_2m_min.length < 3 ||
        daily.weather_code.length < 3
      ) {
        throw new Error('Temperature was not available.')
      }

      setLocation({
        name: result.name,
        state: result.admin1,
        country: result.country,
        time: current.time,
        temperature,
        feelsLike: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        weatherCode: current.weather_code,
        forecast: daily.time.slice(0, 3).map((date, index) => ({
          date,
          maximum: daily.temperature_2m_max[index],
          minimum: daily.temperature_2m_min[index],
          weatherCode: daily.weather_code[index],
        })),
      })
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Something went wrong while searching.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  const currentWeather = location
    ? getWeatherSummary(location.weatherCode)
    : null
  const weatherTheme: WeatherTheme = location
    ? getWeatherTheme(location.weatherCode)
    : 'idle'

  return (
    <div className="weather-page">
      <WeatherScene key={weatherTheme} theme={weatherTheme} />
      <main className="weather-card">
        <header className="app-header">
          <p className="app-kicker">LIVE WEATHER FORECAST</p>
          <h1>What's the weather like?</h1>
          <p className="app-subtitle">
            Search any city for current conditions and a 3-day forecast.
          </p>
        </header>
        <form className="search-form" onSubmit={handleSubmit}>
          <label htmlFor="city">Search location</label>
          <div className="search-controls">
            <input
              id="city"
              type="search"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Lagos"
            />
            <button type="submit" disabled={isSearching} aria-label="Search city">
              <span aria-hidden="true">→</span>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {location && (
          <div className="result" aria-live="polite">
            <p className="location-name">
              <span>{location.name}</span>
              <small>
                {[location.state, location.country].filter(Boolean).join(', ')}
              </small>
            </p>
            <div className="weather-summary">
              <span
                className="weather-icon"
                role="img"
                aria-label={currentWeather?.label}
              >
                {currentWeather?.icon}
              </span>
              <div>
                <p className="temperature">{location.temperature.toFixed(1)}°C</p>
                <p className="condition">{currentWeather?.label}</p>
              </div>
            </div>
            <div className="weather-details">
              <p>Local time: {formatLocalTime(location.time)}</p>
              <p>Feels like: {location.feelsLike.toFixed(1)}°C</p>
              <p>Humidity: {location.humidity}%</p>
              <p>Wind: {location.windSpeed.toFixed(1)} km/h</p>
            </div>
          </div>
        )}
        {location && (
          <section className="forecast" aria-labelledby="forecast-title">
            <h2 id="forecast-title">NEXT 3 DAYS</h2>
            <div className="forecast-list">
              {location.forecast.map((day) => (
                <DailyForecastCard key={day.date} day={day} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
