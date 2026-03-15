export type ConditionCode = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rain' | 'snow' | 'sleet' | 'thunder' | 'fog';

export interface WeatherData {
	condition: string;       // human-readable condition text
	conditionCode: ConditionCode;
	tempHighF: number;
	tempLowF: number;
	city: string;
	isForTomorrow: boolean;
	sunrise: string;  // e.g. "6:32am"
	sunset: string;   // e.g. "7:55pm"
}

// Map WeatherAPI condition codes to our simplified set.
// Full list: https://www.weatherapi.com/docs/weather_conditions.json
function toConditionCode(code: number): ConditionCode {
	if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 'thunder';
	if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) return 'snow';
	if ([1069, 1072, 1168, 1171, 1198, 1201, 1204, 1207, 1249, 1252].includes(code)) return 'sleet';
	if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) return 'rain';
	if ([1135, 1147].includes(code)) return 'fog';
	if ([1006, 1009].includes(code)) return 'cloudy';
	if ([1003].includes(code)) return 'partly-cloudy';
	return 'sunny'; // 1000 and anything else
}

export async function fetchWeather(apiKey: string, city: string): Promise<WeatherData> {
	// Fetch 2-day forecast so we can switch to "tomorrow" after 4 PM Eastern
	const url = `http://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=2`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`WeatherAPI HTTP ${res.status}`);

	const data = (await res.json()) as any;

	// Use UTC-5 (EST) as a reasonable proxy for Portland ME; close enough for today/tomorrow switching
	const nowUtc = Date.now();
	const localHour = new Date(nowUtc - 5 * 3600 * 1000).getUTCHours();
	const dayIdx = localHour >= 16 ? 1 : 0;

	const forecastDay = data.forecast.forecastday[dayIdx];
	const day = forecastDay.day;
	const astro = forecastDay.astro;
	return {
		condition: day.condition.text as string,
		conditionCode: toConditionCode(day.condition.code as number),
		tempHighF: Math.round(day.maxtemp_f as number),
		tempLowF: Math.round(day.mintemp_f as number),
		city,
		isForTomorrow: dayIdx === 1,
		sunrise: formatAstroTime(astro.sunrise as string),
		sunset: formatAstroTime(astro.sunset as string),
	};
}

// Convert WeatherAPI astro time ("06:32 AM") to compact form ("6:32am")
function formatAstroTime(t: string): string {
	const m = t.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
	if (!m) return t;
	const h = parseInt(m[1], 10);
	const suffix = m[3].toLowerCase();
	return `${h}:${m[2]}${suffix}`;
}
