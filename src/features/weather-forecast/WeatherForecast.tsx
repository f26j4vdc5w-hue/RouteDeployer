import { useEffect, useState } from 'react';
import { Sunset, Wind } from 'lucide-react';
import { formatDayMonth } from '../../shared/format/date';
import {
  compassDirection,
  fetchWeatherForecast,
  formatSunset,
  weatherCondition,
  type WeatherForecast as WeatherData,
} from './weather';

interface Props {
  date: string;
  meetingTime: string;
  place: string;
  latitude: number;
  longitude: number;
}

type ForecastState =
  | { status: 'loading' }
  | { status: 'ready'; data: WeatherData }
  | { status: 'error'; message: string };

export function WeatherForecast({
  date,
  meetingTime,
  place,
  latitude,
  longitude,
}: Props) {
  const [forecast, setForecast] = useState<ForecastState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setForecast({ status: 'loading' });

    fetchWeatherForecast(latitude, longitude, date, meetingTime, controller.signal)
      .then((data) => setForecast({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setForecast({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Die Wettervorhersage konnte nicht geladen werden.',
        });
      });

    return () => controller.abort();
  }, [date, latitude, longitude, meetingTime]);

  const condition =
    forecast.status === 'ready' ? weatherCondition(forecast.data.weatherCode) : undefined;

  return (
    <section className="weather" aria-labelledby="weather-title" aria-live="polite">
      <header className="weather__head">
        <div>
          <h2 id="weather-title">Wetter am {formatDayMonth(date)}</h2>
          <p>{place} · zum Tourstart um {meetingTime} Uhr</p>
        </div>
        {forecast.status === 'ready' && (
          <strong className="weather__temperature">
            {Math.round(forecast.data.temperature)}°C
          </strong>
        )}
      </header>

      {forecast.status === 'loading' && (
        <p className="weather__message">Wettervorhersage wird geladen …</p>
      )}
      {forecast.status === 'error' && (
        <p className="weather__message" role="alert">
          {forecast.message}
        </p>
      )}
      {forecast.status === 'ready' && condition && (
        <div className="weather__facts">
          <div>
            <span className="weather__fact-label">
              <Wind size={15} aria-hidden="true" />
              <span>Wind</span>
            </span>
            <strong>{compassDirection(forecast.data.windDirection)}</strong>
          </div>
          <div>
            <span className="weather__fact-label">
              <Sunset size={15} aria-hidden="true" />
              <span>Sonnenuntergang</span>
            </span>
            <strong>{formatSunset(forecast.data.sunset)} Uhr</strong>
          </div>
          <div className="weather__condition">
            <condition.Icon size={26} aria-hidden="true" />
            <span>{condition.label}</span>
          </div>
        </div>
      )}

      <a
        className="weather__attribution"
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
      >
        Wetterdaten: Open-Meteo
      </a>
    </section>
  );
}
