export interface WeatherData {
	condition: string;
	tempHighF: number;
	tempLowF: number;
	city: string;
	isForTomorrow: boolean;
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

	const day = data.forecast.forecastday[dayIdx].day;
	return {
		condition: day.condition.text as string,
		tempHighF: Math.round(day.maxtemp_f as number),
		tempLowF: Math.round(day.mintemp_f as number),
		city,
		isForTomorrow: dayIdx === 1,
	};
}
