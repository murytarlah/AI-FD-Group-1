import { useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'

type Place = {
  id: number
  name: string
  admin1?: string
  country: string
  country_code?: string
  feature_code?: string
  latitude: number
  longitude: number
  elevation?: number
  population?: number
  timezone?: string
}

type GeocodingResponse = {
  results?: Place[]
}

type Units = {
  temperature: 'celsius' | 'fahrenheit'
  wind: 'kmh' | 'mph'
}

type CurrentWeather = {
  time: string
  temperature_2m: number
  relative_humidity_2m: number
  apparent_temperature: number
  is_day: number
  precipitation: number
  snowfall: number
  weather_code: number
  cloud_cover: number
  pressure_msl: number
  wind_speed_10m: number
  wind_direction_10m: number
  wind_gusts_10m: number
  visibility: number
  dew_point_2m: number
  uv_index: number
}

type HourlyWeather = {
  time: string[]
  temperature_2m: number[]
  precipitation_probability: Array<number | null>
  weather_code: number[]
  is_day: number[]
}

type DailyWeather = {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  apparent_temperature_max: number[]
  apparent_temperature_min: number[]
  sunrise: string[]
  sunset: string[]
  daylight_duration: number[]
  sunshine_duration: number[]
  uv_index_max: number[]
  precipitation_sum: number[]
  snowfall_sum: number[]
  precipitation_hours: number[]
  precipitation_probability_max: Array<number | null>
  wind_speed_10m_max: number[]
  wind_gusts_10m_max: number[]
  wind_direction_10m_dominant: number[]
}

type WeatherResponse = {
  timezone_abbreviation?: string
  current?: CurrentWeather
  hourly?: HourlyWeather
  daily?: DailyWeather
}

type Forecast = {
  timezoneAbbreviation?: string
  units: Units
  current: CurrentWeather
  hourly: HourlyWeather
  daily: DailyWeather
}

type AirQuality = {
  us_aqi: number | null
  european_aqi: number | null
  pm2_5: number | null
  pm10: number | null
  ozone: number | null
  nitrogen_dioxide: number | null
  alder_pollen: number | null
  birch_pollen: number | null
  grass_pollen: number | null
  mugwort_pollen: number | null
  olive_pollen: number | null
  ragweed_pollen: number | null
}

type AirQualityResponse = {
  current?: AirQuality
}

type WeatherTheme = 'idle' | 'sunny' | 'cloudy' | 'rainy' | 'snowy'

type Level = { label: string; tone: 'good' | 'fair' | 'poor' | 'bad' | 'severe' }

const UNITS_STORAGE_KEY = 'weather-units'
const DEFAULT_UNITS: Units = { temperature: 'celsius', wind: 'kmh' }

const POLLEN_TYPES = [
  ['alder_pollen', 'Alder'],
  ['birch_pollen', 'Birch'],
  ['grass_pollen', 'Grass'],
  ['mugwort_pollen', 'Mugwort'],
  ['olive_pollen', 'Olive'],
  ['ragweed_pollen', 'Ragweed'],
] as const

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]

function loadUnits(): Units {
  try {
    const saved = localStorage.getItem(UNITS_STORAGE_KEY)
    return saved ? { ...DEFAULT_UNITS, ...JSON.parse(saved) } : DEFAULT_UNITS
  } catch {
    return DEFAULT_UNITS
  }
}

function saveUnits(units: Units) {
  try {
    localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(units))
  } catch {
    // Units still apply for this visit; they just won't be remembered.
  }
}

function getWeatherSummary(code: number, isDay = true) {
  if (code === 0) return { label: 'Clear sky', icon: isDay ? '☀' : '☾' }
  if (code === 1) return { label: 'Mainly clear', icon: isDay ? '☀' : '☾' }
  if (code === 2) return { label: 'Partly cloudy', icon: '◐' }
  if (code === 3) return { label: 'Overcast', icon: '☁' }
  if (code === 45 || code === 48) return { label: 'Foggy', icon: '≋' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: '☂' }
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: '☂' }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: '❄' }
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: '☂' }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: '❄' }
  if (code >= 95 && code <= 99) {
    return { label: 'Thunderstorm', icon: '⚡' }
  }
  return { label: 'Unknown conditions', icon: '☁' }
}

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

function getUvLevel(uv: number): Level {
  if (uv < 3) return { label: 'Low', tone: 'good' }
  if (uv < 6) return { label: 'Moderate', tone: 'fair' }
  if (uv < 8) return { label: 'High', tone: 'poor' }
  if (uv < 11) return { label: 'Very high', tone: 'bad' }
  return { label: 'Extreme', tone: 'severe' }
}

function getAqiLevel(aqi: number): Level {
  if (aqi <= 50) return { label: 'Good', tone: 'good' }
  if (aqi <= 100) return { label: 'Moderate', tone: 'fair' }
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', tone: 'poor' }
  if (aqi <= 200) return { label: 'Unhealthy', tone: 'bad' }
  return { label: 'Hazardous', tone: 'severe' }
}

function getCompassDirection(degrees: number) {
  return COMPASS_POINTS[Math.round(degrees / 22.5) % 16]
}

function getFlag(countryCode?: string) {
  if (!countryCode || countryCode.length !== 2) return ''
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((letter) => 0x1f1a5 + letter.charCodeAt(0)),
  )
}

// Open-Meteo returns local wall-clock times without an offset, so read the
// minutes straight from the string instead of going through Date.
function getMinutesOfDay(time: string) {
  const [hours, minutes] = time.slice(11, 16).split(':').map(Number)
  return hours * 60 + minutes
}

function formatLocalTime(time: string) {
  return new Date(time).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatHour(time: string) {
  return new Date(time).toLocaleTimeString(undefined, { hour: 'numeric' })
}

function formatDayName(date: string, index: number) {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tomorrow'
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
  })
}

function formatShortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function formatVisibility(meters: number, units: Units) {
  return units.wind === 'mph'
    ? `${(meters / 1609.34).toFixed(1)} mi`
    : `${(meters / 1000).toFixed(1)} km`
}

function getUnitLabels(units: Units) {
  return {
    temperature: units.temperature === 'celsius' ? '°C' : '°F',
    wind: units.wind === 'kmh' ? 'km/h' : 'mph',
  }
}

async function fetchForecast(place: Place, units: Units): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
      'is_day', 'precipitation', 'snowfall', 'weather_code', 'cloud_cover',
      'pressure_msl', 'wind_speed_10m', 'wind_direction_10m',
      'wind_gusts_10m', 'visibility', 'dew_point_2m', 'uv_index',
    ].join(','),
    hourly: [
      'temperature_2m', 'precipitation_probability', 'weather_code', 'is_day',
    ].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'apparent_temperature_max', 'apparent_temperature_min', 'sunrise',
      'sunset', 'daylight_duration', 'sunshine_duration', 'uv_index_max',
      'precipitation_sum', 'snowfall_sum', 'precipitation_hours',
      'precipitation_probability_max', 'wind_speed_10m_max',
      'wind_gusts_10m_max', 'wind_direction_10m_dominant',
    ].join(','),
    forecast_days: '16',
    temperature_unit: units.temperature,
    wind_speed_unit: units.wind,
    timezone: 'auto',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) {
    throw new Error('Could not load the weather.')
  }

  const data: WeatherResponse = await response.json()
  if (!data.current || !data.hourly || !data.daily || !data.daily.time.length) {
    throw new Error('Weather was not available for this location.')
  }

  return {
    timezoneAbbreviation: data.timezone_abbreviation,
    units,
    current: data.current,
    hourly: data.hourly,
    daily: data.daily,
  }
}

async function fetchAirQuality(place: Place): Promise<AirQuality | null> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: [
      'us_aqi', 'european_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide',
      ...POLLEN_TYPES.map(([key]) => key),
    ].join(','),
    timezone: 'auto',
  })

  const response = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`,
  )
  if (!response.ok) return null

  const data: AirQualityResponse = await response.json()
  return data.current ?? null
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

const STARS = Array.from({ length: 50 }, (_, index) => ({
  x: (index * 41) % 100,
  y: (index * 23) % 70,
  size: 1 + (index % 3),
  delay: -((index * 0.7) % 4),
}))

function WeatherScene({
  theme,
  isNight,
}: {
  theme: WeatherTheme
  isNight: boolean
}) {
  return (
    <div
      className={`weather-scene scene-${theme}${isNight ? ' is-night' : ''}`}
      aria-hidden="true"
    >
      {theme === 'sunny' && !isNight && (
        <>
          <div className="sun-glow" />
          <div className="sun-rays" />
          <div className="sun" />
        </>
      )}
      {theme === 'sunny' && isNight && (
        <>
          {STARS.map((star, index) => (
            <span
              key={index}
              className="star"
              style={
                {
                  '--x': `${star.x}%`,
                  '--y': `${star.y}%`,
                  '--size': `${star.size}px`,
                  '--delay': `${star.delay}s`,
                } as CSSProperties
              }
            />
          ))}
          <div className="moon-glow" />
          <div className="moon" />
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

function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="toggle" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function LevelBadge({ level }: { level: Level }) {
  return <span className={`level level-${level.tone}`}>{level.label}</span>
}

function WindArrow({ degrees }: { degrees: number }) {
  // Wind direction is where it blows from, so the arrow points downwind.
  return (
    <span
      className="wind-arrow"
      style={{ transform: `rotate(${degrees}deg)` }}
      aria-hidden="true"
    >
      ↓
    </span>
  )
}

function CurrentPanel({ place, forecast }: { place: Place; forecast: Forecast }) {
  const { current, units } = forecast
  const labels = getUnitLabels(units)
  const weather = getWeatherSummary(current.weather_code, current.is_day === 1)
  const uvLevel = getUvLevel(current.uv_index)
  const meta = [
    place.elevation !== undefined &&
      `${Math.round(place.elevation).toLocaleString()} m elevation`,
    place.population &&
      `Pop. ${new Intl.NumberFormat(undefined, { notation: 'compact' }).format(place.population)}`,
    place.timezone,
  ].filter(Boolean)

  return (
    <section className="panel current-panel" aria-live="polite">
      <div className="location-name">
        <h2>
          {getFlag(place.country_code)} {place.name}
        </h2>
        <p>{[place.admin1, place.country].filter(Boolean).join(', ')}</p>
        {meta.length > 0 && <p className="location-meta">{meta.join(' · ')}</p>}
      </div>
      <div className="weather-summary">
        <span className="weather-icon" role="img" aria-label={weather.label}>
          {weather.icon}
        </span>
        <div>
          <p className="temperature">
            {current.temperature_2m.toFixed(1)}
            {labels.temperature}
          </p>
          <p className="condition">{weather.label}</p>
        </div>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Feels like</dt>
          <dd>{current.apparent_temperature.toFixed(1)}{labels.temperature}</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{current.relative_humidity_2m}%</dd>
        </div>
        <div>
          <dt>Dew point</dt>
          <dd>{current.dew_point_2m.toFixed(1)}{labels.temperature}</dd>
        </div>
        <div>
          <dt>Cloud cover</dt>
          <dd>{current.cloud_cover}%</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            <WindArrow degrees={current.wind_direction_10m} />{' '}
            {current.wind_speed_10m.toFixed(1)} {labels.wind}{' '}
            {getCompassDirection(current.wind_direction_10m)}
          </dd>
        </div>
        <div>
          <dt>Gusts</dt>
          <dd>{current.wind_gusts_10m.toFixed(1)} {labels.wind}</dd>
        </div>
        <div>
          <dt>Pressure</dt>
          <dd>{Math.round(current.pressure_msl)} hPa</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{formatVisibility(current.visibility, units)}</dd>
        </div>
        <div>
          <dt>UV index</dt>
          <dd>
            {current.uv_index.toFixed(1)} <LevelBadge level={uvLevel} />
          </dd>
        </div>
        <div>
          <dt>Precipitation</dt>
          <dd>
            {current.snowfall > 0
              ? `${current.snowfall.toFixed(1)} cm snow`
              : `${current.precipitation.toFixed(1)} mm`}
          </dd>
        </div>
        <div>
          <dt>Local time</dt>
          <dd>
            {formatLocalTime(current.time)}{' '}
            {forecast.timezoneAbbreviation && (
              <small>{forecast.timezoneAbbreviation}</small>
            )}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function DayPanel({ forecast, dayIndex }: { forecast: Forecast; dayIndex: number }) {
  const { daily, current } = forecast
  const labels = getUnitLabels(forecast.units)
  const date = daily.time[dayIndex]
  const sunrise = daily.sunrise[dayIndex]
  const sunset = daily.sunset[dayIndex]
  const rainChance = daily.precipitation_probability_max[dayIndex]
  const snowfall = daily.snowfall_sum[dayIndex]
  const windDirection = daily.wind_direction_10m_dominant[dayIndex]
  const uvMax = daily.uv_index_max[dayIndex]

  const sunriseMinutes = getMinutesOfDay(sunrise)
  const daylightMinutes = getMinutesOfDay(sunset) - sunriseMinutes
  const sunProgress =
    dayIndex === 0 && daylightMinutes > 0
      ? Math.min(
          1,
          Math.max(0, (getMinutesOfDay(current.time) - sunriseMinutes) / daylightMinutes),
        )
      : null

  return (
    <section className="panel day-panel" aria-labelledby="day-panel-title">
      <h2 id="day-panel-title" className="panel-title">
        {formatDayName(date, dayIndex)} · {formatShortDate(date)}
      </h2>
      <div className="sun-track">
        <div className="sun-track-bar">
          {sunProgress !== null && (
            <span
              className="sun-track-marker"
              style={{ left: `${sunProgress * 100}%` }}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="sun-track-labels">
          <span>☀↑ {formatLocalTime(sunrise)}</span>
          <span>☀↓ {formatLocalTime(sunset)}</span>
        </div>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Daylight</dt>
          <dd>{formatDuration(daily.daylight_duration[dayIndex])}</dd>
        </div>
        <div>
          <dt>Sunshine</dt>
          <dd>{formatDuration(daily.sunshine_duration[dayIndex])}</dd>
        </div>
        <div>
          <dt>Max UV index</dt>
          <dd>
            {uvMax.toFixed(1)} <LevelBadge level={getUvLevel(uvMax)} />
          </dd>
        </div>
        <div>
          <dt>Feels like</dt>
          <dd>
            {Math.round(daily.apparent_temperature_max[dayIndex])}° /{' '}
            {Math.round(daily.apparent_temperature_min[dayIndex])}
            {labels.temperature}
          </dd>
        </div>
        <div>
          <dt>Chance of rain</dt>
          <dd>{rainChance === null ? '—' : `${rainChance}%`}</dd>
        </div>
        <div>
          <dt>Precipitation</dt>
          <dd>
            {daily.precipitation_sum[dayIndex].toFixed(1)} mm over{' '}
            {daily.precipitation_hours[dayIndex]}h
          </dd>
        </div>
        {snowfall > 0 && (
          <div>
            <dt>Snowfall</dt>
            <dd>{snowfall.toFixed(1)} cm</dd>
          </div>
        )}
        <div>
          <dt>Max wind</dt>
          <dd>
            <WindArrow degrees={windDirection} />{' '}
            {Math.round(daily.wind_speed_10m_max[dayIndex])} {labels.wind}{' '}
            {getCompassDirection(windDirection)}
          </dd>
        </div>
        <div>
          <dt>Max gusts</dt>
          <dd>
            {Math.round(daily.wind_gusts_10m_max[dayIndex])} {labels.wind}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function AirQualityPanel({ airQuality }: { airQuality: AirQuality | null }) {
  if (!airQuality || airQuality.us_aqi === null) {
    return (
      <section className="panel" aria-labelledby="air-title">
        <h2 id="air-title" className="panel-title">Air quality</h2>
        <p className="panel-empty">Air quality data isn't available here.</p>
      </section>
    )
  }

  const pollen = POLLEN_TYPES.filter(([key]) => airQuality[key] !== null)
  const pollutants = [
    ['PM2.5', airQuality.pm2_5],
    ['PM10', airQuality.pm10],
    ['Ozone', airQuality.ozone],
    ['NO₂', airQuality.nitrogen_dioxide],
  ] as const

  return (
    <section className="panel air-panel" aria-labelledby="air-title">
      <h2 id="air-title" className="panel-title">Air quality</h2>
      <div className="aqi">
        <p className="aqi-value">{airQuality.us_aqi}</p>
        <div>
          <LevelBadge level={getAqiLevel(airQuality.us_aqi)} />
          <p className="aqi-scale">
            US AQI
            {airQuality.european_aqi !== null &&
              ` · European AQI ${airQuality.european_aqi}`}
          </p>
        </div>
      </div>
      <dl className="detail-list">
        {pollutants.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === null ? '—' : `${value.toFixed(1)} μg/m³`}</dd>
          </div>
        ))}
      </dl>
      {pollen.length > 0 ? (
        <dl className="detail-list pollen-list">
          {pollen.map(([key, label]) => (
            <div key={key}>
              <dt>{label} pollen</dt>
              <dd>{airQuality[key]?.toFixed(1)} grains/m³</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="panel-note">Pollen counts are only available in Europe.</p>
      )}
    </section>
  )
}

function HourlyForecast({ forecast }: { forecast: Forecast }) {
  const { hourly, current } = forecast
  const currentHour = `${current.time.slice(0, 13)}:00`
  const start = Math.max(0, hourly.time.indexOf(currentHour))
  const hours = hourly.time.slice(start, start + 24).map((time, offset) => {
    const index = start + offset
    return {
      time,
      temperature: hourly.temperature_2m[index],
      rainChance: hourly.precipitation_probability[index],
      weather: getWeatherSummary(hourly.weather_code[index], hourly.is_day[index] === 1),
    }
  })

  return (
    <section className="forecast" aria-labelledby="hourly-title">
      <h2 id="hourly-title" className="section-title">NEXT 24 HOURS</h2>
      <div className="scroller">
        {hours.map((hour, index) => (
          <article key={hour.time} className="hour-card">
            <p className="hour-time">{index === 0 ? 'Now' : formatHour(hour.time)}</p>
            <span className="hour-icon" role="img" aria-label={hour.weather.label}>
              {hour.weather.icon}
            </span>
            <p className="hour-temperature">{Math.round(hour.temperature)}°</p>
            <p className="rain-chance" aria-label="Chance of rain">
              {hour.rainChance === null ? '—' : `${hour.rainChance}%`}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function DailyForecast({
  forecast,
  selectedDay,
  onSelectDay,
}: {
  forecast: Forecast
  selectedDay: number
  onSelectDay: (index: number) => void
}) {
  const { daily } = forecast

  return (
    <section className="forecast" aria-labelledby="daily-title">
      <h2 id="daily-title" className="section-title">
        {daily.time.length}-DAY FORECAST
      </h2>
      <div className="scroller">
        {daily.time.map((date, index) => {
          const weather = getWeatherSummary(daily.weather_code[index])
          const rainChance = daily.precipitation_probability_max[index]
          return (
            <button
              key={date}
              type="button"
              className="day-card"
              aria-pressed={index === selectedDay}
              onClick={() => onSelectDay(index)}
            >
              <span className="day-name">{formatDayName(date, index)}</span>
              <span className="day-date">{formatShortDate(date)}</span>
              <span className="day-icon" role="img" aria-label={weather.label}>
                {weather.icon}
              </span>
              <span className="day-temperatures">
                <span className="day-high">
                  {Math.round(daily.temperature_2m_max[index])}°
                </span>
                <span className="day-low">
                  {Math.round(daily.temperature_2m_min[index])}°
                </span>
              </span>
              <span className="rain-chance" aria-label="Chance of rain">
                {rainChance === null ? '—' : `${rainChance}%`}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const [units, setUnits] = useState<Units>(loadUnits)
  const [places, setPlaces] = useState<Place[]>([])
  const [place, setPlace] = useState<Place | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null)
  const [selectedDay, setSelectedDay] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only the latest request may update the screen, so quick unit or city
  // switches can't be overwritten by a slower, older response.
  const requestId = useRef(0)

  function clearResults() {
    setPlaces([])
    setPlace(null)
    setForecast(null)
    setAirQuality(null)
  }

  async function loadWeather(nextPlace: Place, nextUnits: Units) {
    const id = ++requestId.current
    setIsLoading(true)
    setError(null)

    try {
      const [nextForecast, nextAirQuality] = await Promise.all([
        fetchForecast(nextPlace, nextUnits),
        fetchAirQuality(nextPlace).catch(() => null),
      ])
      if (id !== requestId.current) return
      setPlace(nextPlace)
      setForecast(nextForecast)
      setAirQuality(nextAirQuality)
    } catch (loadError) {
      if (id !== requestId.current) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Something went wrong while loading the weather.',
      )
    } finally {
      if (id === requestId.current) setIsLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const searchTerm = query.trim()
    if (!searchTerm) {
      setError('Enter a city name.')
      clearResults()
      return
    }

    const id = ++requestId.current
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=10&language=en&format=json`,
      )
      if (!response.ok) {
        throw new Error('Could not search for that city.')
      }

      const data: GeocodingResponse = await response.json()
      // Prefer towns and cities over airports, dams and other landmarks.
      const allResults = data.results ?? []
      const settlements = allResults.filter((result) =>
        result.feature_code?.startsWith('PPL'),
      )
      const results = settlements.length ? settlements : allResults
      if (!results.length) {
        throw new Error('City not found.')
      }
      if (id !== requestId.current) return

      setPlaces(results.slice(0, 5))
      setSelectedDay(0)
      await loadWeather(results[0], units)
    } catch (searchError) {
      if (id !== requestId.current) return
      clearResults()
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Something went wrong while searching.',
      )
      setIsLoading(false)
    }
  }

  function handleSelectPlace(nextPlace: Place) {
    setSelectedDay(0)
    void loadWeather(nextPlace, units)
  }

  function handleUnitsChange(nextUnits: Units) {
    setUnits(nextUnits)
    saveUnits(nextUnits)
    if (place) void loadWeather(place, nextUnits)
  }

  const weatherTheme: WeatherTheme = forecast
    ? getWeatherTheme(forecast.current.weather_code)
    : 'idle'
  const isNight = forecast ? forecast.current.is_day === 0 : false

  return (
    <div className="weather-page">
      <WeatherScene
        key={`${weatherTheme}-${isNight}`}
        theme={weatherTheme}
        isNight={isNight}
      />
      <main className="weather-card">
        <header className="app-header">
          <div className="app-title">
            <p className="app-kicker">LIVE WEATHER FORECAST</p>
            <h1>What's the weather like?</h1>
            <p className="app-subtitle">
              Current conditions, hourly and 16-day forecasts, and air quality
              for any city.
            </p>
          </div>
          <div className="app-controls">
            <div className="unit-toggles">
              <SegmentedToggle
                label="Temperature unit"
                value={units.temperature}
                options={[
                  { value: 'celsius', label: '°C' },
                  { value: 'fahrenheit', label: '°F' },
                ]}
                onChange={(temperature) => handleUnitsChange({ ...units, temperature })}
              />
              <SegmentedToggle
                label="Wind speed unit"
                value={units.wind}
                options={[
                  { value: 'kmh', label: 'km/h' },
                  { value: 'mph', label: 'mph' },
                ]}
                onChange={(wind) => handleUnitsChange({ ...units, wind })}
              />
            </div>
            <form className="search-form" onSubmit={handleSubmit}>
              <label htmlFor="city">Search location</label>
              <div className="search-controls">
                <input
                  id="city"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. Lagos"
                />
                <button type="submit" disabled={isLoading} aria-label="Search city">
                  <span aria-hidden="true">→</span>
                  {isLoading ? 'Loading...' : 'Search'}
                </button>
              </div>
            </form>
          </div>
        </header>
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {places.length > 1 && (
          <div className="place-options" role="group" aria-label="Matching places">
            <span>Matches:</span>
            {places.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === place?.id}
                onClick={() => handleSelectPlace(option)}
              >
                {getFlag(option.country_code)} {option.name}
                <small>
                  {[option.admin1, option.country].filter(Boolean).join(', ')}
                </small>
              </button>
            ))}
          </div>
        )}
        {place && forecast && (
          <div className={`results${isLoading ? ' is-loading' : ''}`}>
            <div className="panel-grid">
              <CurrentPanel place={place} forecast={forecast} />
              <DayPanel forecast={forecast} dayIndex={selectedDay} />
              <AirQualityPanel airQuality={airQuality} />
            </div>
            <div className="forecast-grid">
              <HourlyForecast forecast={forecast} />
              <DailyForecast
                forecast={forecast}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
