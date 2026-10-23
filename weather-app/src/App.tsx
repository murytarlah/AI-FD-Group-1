import { useState } from 'react'
import './App.css'

type CurrentWeather = {
  temperature_2m: number
  apparent_temperature: number
  relative_humidity_2m: number
  wind_speed_10m: number
  weather_code: number
}

type DailyWeather = {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
}

type ForecastResponse = {
  current: CurrentWeather
  daily: DailyWeather
}

type Location = {
  name: string
  country?: string
  latitude: number
  longitude: number
}

const weatherDescriptions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
}

function describeWeather(code: number) {
  return weatherDescriptions[code] ?? 'Weather unavailable'
}

function App() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState<Location | null>(null)
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function searchWeather(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const city = query.trim()
    if (!city) {
      setError('Enter a city or location to search.')
      return
    }

    setLoading(true)
    setError('')
    setForecast(null)
    setLocation(null)

    try {
      const locationUrl = new URL(
        'https://geocoding-api.open-meteo.com/v1/search',
      )
      locationUrl.searchParams.set('name', city)
      locationUrl.searchParams.set('count', '1')
      locationUrl.searchParams.set('language', 'en')
      locationUrl.searchParams.set('format', 'json')

      const locationResponse = await fetch(locationUrl)
      if (!locationResponse.ok) throw new Error('Could not search for that location.')

      const locationData = await locationResponse.json()
      const result: Location | undefined = locationData.results?.[0]

      if (!result) {
        setError('City not found. Check the spelling and try again.')
        return
      }

      const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
      forecastUrl.searchParams.set('latitude', String(result.latitude))
      forecastUrl.searchParams.set('longitude', String(result.longitude))
      forecastUrl.searchParams.set(
        'current',
        'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
      )
      forecastUrl.searchParams.set(
        'daily',
        'weather_code,temperature_2m_max,temperature_2m_min',
      )
      forecastUrl.searchParams.set('forecast_days', '4')
      forecastUrl.searchParams.set('timezone', 'auto')

      const forecastResponse = await fetch(forecastUrl)
      if (!forecastResponse.ok) throw new Error('Could not load the weather forecast.')

      const forecastData: ForecastResponse = await forecastResponse.json()
      setLocation(result)
      setForecast(forecastData)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const nextThreeDays = forecast?.daily.time.slice(1, 4) ?? []

  return (
    <main className="weather-app">
      <header className="page-header">
        <p className="eyebrow">WEATHER, WHEREVER YOU ARE</p>
        <h1>Local forecast</h1>
        <p className="intro">Search for a city to see its weather today and for the next three days.</p>
      </header>

      <form className="search-form" onSubmit={searchWeather}>
        <label className="sr-only" htmlFor="location-search">
          Search for a city
        </label>
        <input
          id="location-search"
          type="search"
          placeholder="Try London, Tokyo, or New York"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="message" role="status">Loading forecast…</p>}

      {location && forecast && (
        <section className="results" aria-live="polite">
          <article className="current-card">
            <div className="current-heading">
              <div>
                <p className="eyebrow">CURRENT WEATHER</p>
                <h2>
                  {location.name}
                  {location.country ? `, ${location.country}` : ''}
                </h2>
              </div>
              <span className="weather-symbol" aria-hidden="true">
                {forecast.current.weather_code === 0 ? '☀️' : '🌤️'}
              </span>
            </div>

            <p className="condition">
              {describeWeather(forecast.current.weather_code)}
            </p>
            <p className="temperature">
              {Math.round(forecast.current.temperature_2m)}°
            </p>
            <p className="feels-like">
              Feels like {Math.round(forecast.current.apparent_temperature)}°
            </p>

            <div className="weather-details">
              <p>Humidity <strong>{forecast.current.relative_humidity_2m}%</strong></p>
              <p>Wind <strong>{Math.round(forecast.current.wind_speed_10m)} km/h</strong></p>
            </div>
          </article>

          <section className="forecast-section">
            <h2>Next 3 days</h2>
            <div className="forecast-grid">
              {nextThreeDays.map((date, index) => {
                const dayIndex = index + 1
                const day = new Date(`${date}T12:00:00`)

                return (
                  <article className="forecast-card" key={date}>
                    <h3>
                      {day.toLocaleDateString('en', { weekday: 'long' })}
                    </h3>
                    <p className="forecast-condition">
                      {describeWeather(forecast.daily.weather_code[dayIndex])}
                    </p>
                    <p className="forecast-temperatures">
                      <strong>
                        {Math.round(forecast.daily.temperature_2m_max[dayIndex])}°
                      </strong>
                      <span>
                        {Math.round(forecast.daily.temperature_2m_min[dayIndex])}°
                      </span>
                    </p>
                  </article>
                )
              })}
            </div>
          </section>
        </section>
      )}

      <footer>Weather data from Open-Meteo</footer>
    </main>
  )
}

export default App