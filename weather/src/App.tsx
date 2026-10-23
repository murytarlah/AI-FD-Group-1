import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type GeocodingResponse = {
  results?: Array<{
    admin1?: string
    country: string
    latitude: number
    longitude: number
  }>
}

type Location = {
  state?: string
  country: string
  temperature: number
  forecast: DailyForecast[]
}

type WeatherResponse = {
  current?: {
    temperature_2m: number
  }
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
}

type DailyForecast = {
  date: string
  maximum: number
  minimum: number
}

function DailyForecastCard({ day }: { day: DailyForecast }) {
  const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: 'short' },
  )

  return (
    <article className="forecast-day">
      <p className="forecast-weekday">{weekday}</p>
      <p className="forecast-temperatures">
        <span>{day.maximum.toFixed(1)}°</span>
        <span>{day.minimum.toFixed(1)}°</span>
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
        `https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min&forecast_days=3&temperature_unit=celsius&timezone=auto`,
      )
      if (!weatherResponse.ok) {
        throw new Error('Could not load the temperature.')
      }

      const weatherData: WeatherResponse = await weatherResponse.json()
      const temperature = weatherData.current?.temperature_2m
      const daily = weatherData.daily
      if (
        temperature === undefined ||
        !daily ||
        daily.time.length < 3 ||
        daily.temperature_2m_max.length < 3 ||
        daily.temperature_2m_min.length < 3
      ) {
        throw new Error('Temperature was not available.')
      }

      setLocation({
        state: result.admin1,
        country: result.country,
        temperature,
        forecast: daily.time.slice(0, 3).map((date, index) => ({
          date,
          maximum: daily.temperature_2m_max[index],
          minimum: daily.temperature_2m_min[index],
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

  return (
    <main className="weather-card">
      <h1>Find a city</h1>
      <form className="search-form" onSubmit={handleSubmit}>
        <label htmlFor="city">City name</label>
        <div className="search-controls">
          <input
            id="city"
            type="search"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Lagos"
          />
          <button type="submit" disabled={isSearching}>
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
          <p>
            {[location.state, location.country].filter(Boolean).join(', ')}
          </p>
          <p className="temperature">{location.temperature.toFixed(1)}°C</p>
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
  )
}

export default App
