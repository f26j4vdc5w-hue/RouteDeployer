import type { LucideIcon } from 'lucide-react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react';

export interface WeatherForecast {
  temperature: number;
  weatherCode: number;
  windDirection: number;
  sunset: string;
}

export interface WeatherCondition {
  label: string;
  Icon: LucideIcon;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  date: string,
  meetingTime: string,
  signal: AbortSignal,
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'temperature_2m,weather_code,wind_direction_10m',
    daily: 'sunset',
    timezone: 'auto',
    start_date: date,
    end_date: date,
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Wettervorhersage konnte nicht geladen werden (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.hourly) || !isRecord(payload.daily)) {
    throw new Error('Die Wettervorhersage ist unvollständig.');
  }

  const { time, temperature_2m, weather_code, wind_direction_10m } = payload.hourly;
  const { time: dailyTime, sunset } = payload.daily;
  if (
    !Array.isArray(time) ||
    !Array.isArray(temperature_2m) ||
    !Array.isArray(weather_code) ||
    !Array.isArray(wind_direction_10m) ||
    !Array.isArray(dailyTime) ||
    !Array.isArray(sunset)
  ) {
    throw new Error('Die Wettervorhersage ist unvollständig.');
  }

  const hour = meetingTime.slice(0, 2);
  const hourIndex = time.findIndex(
    (value) => typeof value === 'string' && value.startsWith(`${date}T${hour}:`),
  );
  const dayIndex = dailyTime.findIndex((value) => value === date);
  const temperature = temperature_2m[hourIndex];
  const weatherCode = weather_code[hourIndex];
  const windDirection = wind_direction_10m[hourIndex];
  const sunsetTime = sunset[dayIndex];

  if (
    hourIndex < 0 ||
    dayIndex < 0 ||
    typeof temperature !== 'number' ||
    typeof weatherCode !== 'number' ||
    typeof windDirection !== 'number' ||
    typeof sunsetTime !== 'string'
  ) {
    throw new Error('Für diesen Termin liegen noch keine Wetterdaten vor.');
  }

  return { temperature, weatherCode, windDirection, sunset: sunsetTime };
}

export function weatherCondition(code: number): WeatherCondition {
  if (code === 0) return { label: 'Sonnig', Icon: Sun };
  if (code === 1) return { label: 'Überwiegend sonnig', Icon: CloudSun };
  if (code === 2) return { label: 'Heiter bis wolkig', Icon: CloudSun };
  if (code === 3) return { label: 'Bewölkt', Icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Nebelig', Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: 'Nieselregen', Icon: CloudDrizzle };
  if (code >= 61 && code <= 67) return { label: 'Regen', Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: 'Schnee', Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: 'Regenschauer', Icon: CloudRain };
  if (code === 85 || code === 86) return { label: 'Schneeschauer', Icon: CloudSnow };
  if (code >= 95 && code <= 99) return { label: 'Gewitter', Icon: CloudLightning };
  return { label: 'Wolkig', Icon: Cloud };
}

export function compassDirection(degrees: number): string {
  const directions = [
    'N',
    'NNO',
    'NO',
    'ONO',
    'O',
    'OSO',
    'SO',
    'SSO',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % directions.length;
  return directions[index];
}

export function formatSunset(sunset: string): string {
  const time = sunset.slice(-5);
  return /^\d{2}:\d{2}$/.test(time) ? time : '–';
}
