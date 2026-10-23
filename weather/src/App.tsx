import { useEffect, useState } from 'react'
import './App.css'

type GeocodingResponse = {
  results?: Array<{
    latitude: number
    longitude: number
  }>
}

type WeatherResponse = {
  current?: {
    temperature_2m: number
  }
}

function App() {
  const [temperature, setTemperature] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadWeather() {
      try {
        const locationResponse = await fetch(
          'https://geocoding-api.open-meteo.com/v1/search?name=Lagos&count=1&language=en&format=json',
          { signal: controller.signal },
        )
        if (!locationResponse.ok) {
          throw new Error('Could not find Lagos.')
        }

        const locationData: GeocodingResponse = await locationResponse.json()
        const location = locationData.results?.[0]
        if (!location) {
          throw new Error('Could not find Lagos.')
        }

        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m&temperature_unit=celsius`,
          { signal: controller.signal },
        )
        if (!weatherResponse.ok) {
          throw new Error('Could not load the current weather.')
        }

        const weatherData: WeatherResponse = await weatherResponse.json()
        const currentTemperature = weatherData.current?.temperature_2m
        if (currentTemperature === undefined) {
          throw new Error('The weather response did not include a temperature.')
        }

        setTemperature(currentTemperature)
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Something went wrong while loading the weather.',
        )
      }
    }

    void loadWeather()

    return () => controller.abort()
  }, [])

  return (
    <main className="weather-card">
      <p className="eyebrow">Open-Meteo weather</p>
      <h1>Current temperature in Lagos</h1>
      {error ? (
        <p className="message error" role="alert">
          {error}
        </p>
      ) : temperature === null ? (
        <p className="message" aria-live="polite">
          Loading current temperature...
        </p>
      ) : (
        <p className="temperature" aria-live="polite">
          {temperature.toFixed(1)}°C
        </p>
      )}
    </main>
  )
}

export default App
