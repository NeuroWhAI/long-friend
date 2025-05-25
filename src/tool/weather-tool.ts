import { env } from '@/env';
import { z } from 'zod';
import { Tool } from './tool';

interface WeatherToolInput {
  city: string;
}

export class WeatherTool extends Tool<WeatherToolInput> {
  constructor() {
    super({
      name: 'get_weather',
      description: 'Get the current weather for a specified location.',
      inputSchema: z.object({
        city: z.string().describe('The city and state(optional) in English, e.g. Raleigh,North Carolina'),
      }),
    });
  }

  async execute(input: WeatherToolInput): Promise<string> {
    try {
      const { city } = input;
      const [weather, forecast] = await Promise.all([this.getWeather(city), this.getForecast(city)]);
      const todayWeather = weather.data[0];
      const todayForecast = forecast.data[0];

      const header = `City: ${todayWeather.city_name}`;
      const today = `[${todayForecast.valid_date} (Today)]
Weather: ${todayWeather.weather.description}
Current Temperature: ${todayWeather.temp}
Feels Like: ${todayWeather.app_temp}
Average Temperature: ${todayForecast.temp}
Minimum Temperature: ${todayForecast.min_temp}
Maximum Temperature: ${todayForecast.max_temp}
Humidity: ${todayWeather.rh}%
Wind: ${todayWeather.wind_spd} m/s
Visibility: ${todayWeather.vis} km`;
      const rest = forecast.data
        .slice(1)
        .map(
          (day) =>
            `[${day.valid_date}]
Weather: ${day.weather.description}
Average Temperature: ${day.temp}
Minimum Temperature: ${day.min_temp}
Maximum Temperature: ${day.max_temp}
Humidity: ${day.rh}%
Wind: ${day.wind_spd} m/s
Visibility: ${day.vis} km
Probability of Precipitation: ${day.pop}%`,
        )
        .join('\n\n');

      return `${header}\n\n${today}\n\n${rest}`;
    } catch (err) {
      return `Failed to get weather: ${(err as Error).message}`;
    }
  }

  private async getForecast(city: string): Promise<ForecastApiResponse> {
    const apiKey = env.WEATHER_BIT_API_KEY;
    const url = `https://api.weatherbit.io/v2.0/forecast/daily?key=${apiKey}&city=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    const forecastRes: ForecastApiResponse = await res.json();
    if (!forecastRes.data?.length) {
      throw new Error('No weather forecast found');
    }
    return forecastRes;
  }

  private async getWeather(city: string): Promise<WeatherApiResponse> {
    const apiKey = env.WEATHER_BIT_API_KEY;
    const url = `https://api.weatherbit.io/v2.0/current?key=${apiKey}&city=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    const weatherRes: WeatherApiResponse = await res.json();
    if (!weatherRes.data?.length) {
      throw new Error('No current weather data found');
    }
    return weatherRes;
  }
}

interface ForecastData {
  valid_date: string; // Local date the forecast is valid for (YYYY-MM-DD)
  ts: number; // Forecast period start unix timestamp (UTC)
  wind_gust_spd: number; // Wind gust speed (m/s)
  wind_spd: number; // Wind speed (m/s)
  wind_dir: number; // Wind direction (degrees)
  wind_cdir: string; // Abbreviated wind direction
  wind_cdir_full: string; // Verbal wind direction
  temp: number; // Average Temperature (Celsius)
  max_temp: number; // Maximum Temperature (Celsius)
  min_temp: number; // Minimum Temperature (Celsius)
  high_temp: number; // High Temperature "Day-time High" (Celsius)
  low_temp: number; // Low Temperature "Night-time Low" (Celsius)
  app_max_temp: number; // Apparent/"Feels Like" temperature at max_temp time (Celsius)
  app_min_temp: number; // Apparent/"Feels Like" temperature at min_temp time (Celsius)
  pop: number; // Probability of Precipitation (%)
  precip: number; // Accumulated liquid equivalent precipitation (mm)
  snow: number; // Accumulated snowfall (mm)
  snow_depth: number; // Snow Depth (mm)
  pres: number; // Average pressure (mb)
  slp: number; // Average sea level pressure (mb)
  dewpt: number; // Average dew point (Celsius)
  rh: number; // Average relative humidity (%)
  weather: {
    icon: string; // Weather icon code
    code: string; // Weather code
    description: string; // Text weather description
  };
  clouds_low: number; // Low-level cloud coverage (%)
  clouds_mid: number; // Mid-level cloud coverage (%)
  clouds_hi: number; // High-level cloud coverage (%)
  clouds: number; // Average total cloud coverage (%)
  vis: number; // Visibility (KM)
  max_dhi: number; // [DEPRECATED] Maximum direct component of solar radiation (W/m^2)
  uv: number; // Maximum UV Index (0-11+)
  moon_phase: number; // Moon phase illumination fraction (0-1)
  moon_phase_lunation: number; // Moon lunation fraction (0 = New moon, 0.50 = Full Moon, 0.75 = Last quarter moon)
  moonrise_ts: number; // Moonrise time unix timestamp (UTC)
  moonset_ts: number; // Moonset time unix timestamp (UTC)
  sunrise_ts: number; // Sunrise time unix timestamp (UTC)
  sunset_ts: number; // Sunset time unix timestamp (UTC)
}

interface ForecastApiResponse {
  data: ForecastData[]; // Array of weather data for each day
  city_name: string; // Nearest city name
  lon: string; // Longitude (Degrees)
  timezone: string; // Local IANA Timezone
  lat: string; // Latitude (Degrees)
  country_code: string; // Country abbreviation
  state_code: string; // State abbreviation/code
}

interface WeatherData {
  wind_cdir: string; // Abbreviated wind direction
  rh: number; // Relative humidity (%)
  pod: string; // Part of the day (d = day / n = night)
  lon: number; // Longitude (Degrees)
  pres: number; // Pressure (mb)
  timezone: string; // Local IANA Timezone
  ob_time: string; // Last observation time (YYYY-MM-DD HH:MM)
  country_code: string; // Country abbreviation
  clouds: number; // Cloud coverage (%)
  vis: number; // Visibility (default KM)
  wind_spd: number; // Wind speed (Default m/s)
  gust: number; // Wind gust speed (Default m/s)
  wind_cdir_full: string; // Verbal wind direction
  app_temp: number; // Apparent/"Feels Like" temperature (default Celsius)
  state_code: string; // State abbreviation/code
  ts: number; // Last observation time (Unix timestamp)
  h_angle: number; // [DEPRECATED] Solar hour angle (degrees)
  dewpt: number; // Dew point (default Celsius)
  weather: {
    icon: string; // Weather icon code
    code: number; // Weather code
    description: string; // Text weather description
  };
  uv: number; // UV Index (0-11+)
  aqi: number; // Air Quality Index [US - EPA standard 0 - +500]
  station: string; // [DEPRECATED] Nearest reporting station ID
  sources: string[]; // List of data sources used in response
  wind_dir: number; // Wind direction (degrees)
  elev_angle: number; // Solar elevation angle (degrees)
  datetime: string; // [DEPRECATED] Current cycle hour (YYYY-MM-DD:HH)
  precip: number; // Liquid equivalent precipitation rate (default mm/hr)
  ghi: number; // Global horizontal solar irradiance (W/m^2) [Clear Sky]
  dni: number; // Direct normal solar irradiance (W/m^2) [Clear Sky]
  dhi: number; // Diffuse horizontal solar irradiance (W/m^2) [Clear Sky]
  solar_rad: number; // Estimated Solar Radiation (W/m^2)
  city_name: string; // City name
  sunrise: string; // Sunrise time UTC (HH:MM)
  sunset: string; // Sunset time UTC (HH:MM)
  temp: number; // Temperature (default Celsius)
  lat: number; // Latitude (Degrees)
  slp: number; // Sea level pressure (mb)
}

interface WeatherApiResponse {
  data: WeatherData[];
  count: number;
}
