import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
// @ts-ignore – wrangler bundles this via "type": "CompiledWasm" rule
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interRegular from './fonts/Inter-Regular.ttf';
import interBold from './fonts/Inter-Bold.ttf';
import weatherIconsFont from './fonts/weathericons-regular-webfont.ttf';
import { fetchWeather, type ConditionCode } from './weather';
import { fetchJoke } from './joke';
import { fetchCalendar } from './calendar';
import { getClothingTip } from './clothingRules';

// ── Dimensions ────────────────────────────────────────────────────────────────

// Must match the Inkplate 5 V2 display (1280×720)
export const IMG_W = 1280;
export const IMG_H = 720;

// Top strip height — left half has date (PNG), right half is blank (device draws clock)
export const TIME_H = 280;
export const TIME_MID_X = IMG_W / 2; // 640 — vertical divider in top strip

// Content area below top strip
const CONTENT_H = IMG_H - TIME_H; // 440
const LEFT_W = 360;               // calendar + countdown column
const WEATHER_W = 430;            // weather panel
const JOKE_W = IMG_W - LEFT_W - WEATHER_W; // 490

// ── WASM init ─────────────────────────────────────────────────────────────────

let wasmReady = false;
async function ensureWasm() {
	if (!wasmReady) {
		await initWasm(resvgWasm);
		wasmReady = true;
	}
}

// ── Weather icons (Weather Icons font) ───────────────────────────────────────
// Codepoints from https://erikflowers.github.io/weather-icons/

const WI_CODEPOINTS: Record<ConditionCode, string> = {
	'sunny':        '\uf00d', // wi-day-sunny
	'partly-cloudy': '\uf002', // wi-day-cloudy
	'cloudy':       '\uf041', // wi-cloud
	'rain':         '\uf019', // wi-rain
	'snow':         '\uf01b', // wi-snow
	'sleet':        '\uf0b5', // wi-sleet
	'thunder':      '\uf01e', // wi-thunderstorm
	'fog':          '\uf014', // wi-fog
};

function weatherIcon(code: ConditionCode) {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				fontFamily: 'weathericons',
				fontSize: 80,
				lineHeight: 1,
				color: 'black',
			},
			children: WI_CODEPOINTS[code],
		},
	};
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function divider(vertical: boolean, length: number, thickness = 3) {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				width:  vertical ? thickness : length,
				height: vertical ? length    : thickness,
				background: 'black',
				flexShrink: 0,
			},
			children: [],
		},
	};
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateDailyImage(env: Env, now = new Date()): Promise<Uint8Array> {
	await ensureWasm();

	const [weather, joke, calendar] = await Promise.all([
		fetchWeather(env.WEATHER_API_KEY, env.WEATHER_CITY),
		fetchJoke(),
		fetchCalendar(env, now),
	]);

	const clothingTip = getClothingTip(weather.condition, weather.tempHighF);

	// ── Date string for top-left ──────────────────────────────────────────────
	const kDay   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
	const kMonth = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
	// Use Eastern time (UTC-5 proxy, good enough for date display)
	const nowEastern = new Date(now.getTime() - 5 * 3600 * 1000);
	const dayName   = kDay[nowEastern.getUTCDay()];
	const monthName = kMonth[nowEastern.getUTCMonth()];
	const monthNum  = nowEastern.getUTCMonth() + 1;
	const dayNum    = nowEastern.getUTCDate();

	// ── Node tree ─────────────────────────────────────────────────────────────
	const node = {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				flexDirection: 'column',
				width: IMG_W,
				height: IMG_H,
				background: 'white',
				color: 'black',
				fontFamily: 'Inter',
			},
			children: [

				// ════════════════════════════════════════════════════════════════
				// TOP STRIP — date left | blank right (device draws clock)
				// ════════════════════════════════════════════════════════════════
				{
					type: 'div',
					props: {
						style: { display: 'flex', flexDirection: 'row', width: IMG_W, height: TIME_H },
						children: [
							// Date panel (left half)
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										flexDirection: 'column',
										justifyContent: 'center',
										width: TIME_MID_X,
										height: TIME_H,
										padding: '0 48px',
										boxSizing: 'border-box',
									},
									children: [
										{
											type: 'div',
											props: {
												style: { display: 'flex', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
												children: [
													{
														type: 'div',
														props: {
															style: { fontSize: 36, fontWeight: 700, letterSpacing: 6, color: '#555' },
															children: dayName,
														},
													},
													{
														type: 'div',
														props: {
															style: { fontSize: 36, fontWeight: 700, color: '#555' },
															children: `${monthNum}/${dayNum}`,
														},
													},
												],
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 96, fontWeight: 700, lineHeight: 1, marginTop: 4 },
												children: `${monthName} ${dayNum}`,
											},
										},
									],
								},
							},
							// Vertical divider
							divider(true, TIME_H),
							// Right half — blank for device clock
							{
								type: 'div',
								props: {
									style: { display: 'flex', width: TIME_MID_X - 3, height: TIME_H },
									children: [],
								},
							},
						],
					},
				},

				// Horizontal rule
				divider(false, IMG_W),

				// ════════════════════════════════════════════════════════════════
				// CONTENT ROW
				// ════════════════════════════════════════════════════════════════
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexDirection: 'row',
							width: IMG_W,
							height: CONTENT_H - 3,
						},
						children: [

							// ── Left column: calendar + countdown ────────────────
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										flexDirection: 'column',
										width: LEFT_W,
										height: CONTENT_H - 3,
										boxSizing: 'border-box',
									},
									children: [
										// Calendar header
										{
											type: 'div',
											props: {
												style: {
													display: 'flex',
													flexDirection: 'column',
													flex: 1,
													padding: '20px 24px 16px',
													boxSizing: 'border-box',
												},
												children: [
													{
														type: 'div',
														props: {
															style: { fontSize: 22, fontWeight: 700, letterSpacing: 3, marginBottom: 14 },
															children: 'TODAY',
														},
													},
													// Event list
													...calendar.events.map(({ summary, time }) => ({
														type: 'div',
														props: {
															style: {
																display: 'flex',
																flexDirection: 'row',
																alignItems: 'center',
																marginBottom: 10,
															},
															children: [
																{
																	type: 'div',
																	props: {
																		style: { fontSize: 18, color: '#555', width: 72, flexShrink: 0 },
																		children: time ?? 'today',
																	},
																},
																{
																	type: 'div',
																	props: {
																		style: { fontSize: 26, lineHeight: 1.3 },
																		children: summary,
																	},
																},
															],
														},
													})),
												],
											},
										},
										// Horizontal divider between calendar and countdown
										divider(false, LEFT_W),
										// Countdown
										...(calendar.countdown ? [{
											type: 'div',
											props: {
												style: {
													display: 'flex',
													flexDirection: 'column',
													justifyContent: 'center',
													padding: '16px 24px',
													boxSizing: 'border-box',
												},
												children: calendar.countdown.days === 0 ? [
													{
														type: 'div',
														props: {
															style: { fontSize: 48, fontWeight: 700, lineHeight: 1.2 },
															children: calendar.countdown.label,
														},
													},
												] : [
													{
														type: 'div',
														props: {
															style: { fontSize: 36, fontWeight: 700 },
															children: `${calendar.countdown.days} days until`,
														},
													},
													{
														type: 'div',
														props: {
															style: { fontSize: 32, color: '#555', marginTop: 2 },
															children: `${calendar.countdown.label}`,
														},
													},
												],
											},
										}] : []),
									],
								},
							},

							// Vertical divider
							divider(true, CONTENT_H - 3),

							// ── Weather panel ─────────────────────────────────────
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										flexDirection: 'column',
										justifyContent: 'flex-start',
										alignItems: 'flex-start',
										width: WEATHER_W,
										padding: '24px 32px',
										boxSizing: 'border-box',
									},
									children: [
										{
											type: 'div',
											props: {
												style: { fontSize: 22, fontWeight: 700, letterSpacing: 3, marginBottom: 16 },
												children: weather.isForTomorrow ? 'TOMORROW' : 'TODAY',
											},
										},
										// Icon + condition row
										{
											type: 'div',
											props: {
												style: {
													display: 'flex',
													flexDirection: 'row',
													alignItems: 'center',
													marginBottom: 14,
												},
												children: [
													weatherIcon(weather.conditionCode),
													{
														type: 'div',
														props: {
															style: { fontSize: 32, fontWeight: 700, marginLeft: 16 },
															children: weather.condition,
														},
													},
												],
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 28, marginBottom: 10 },
												children: `High ${weather.tempHighF}°F · Low ${weather.tempLowF}°F`,
											},
										},
										{
											type: 'div',
											props: {
												style: {
													fontSize: 24,
													fontWeight: 700,
													marginBottom: 8,
												},
												children: clothingTip,
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 18, color: '#555' },
												children: weather.city,
											},
										},
									],
								},
							},

							// Vertical divider
							divider(true, CONTENT_H - 3),

							// ── Joke panel ────────────────────────────────────────
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										flexDirection: 'column',
										width: JOKE_W,
										padding: '24px 32px',
										boxSizing: 'border-box',
									},
									children: [
										{
											type: 'div',
											props: {
												style: { fontSize: 22, fontWeight: 700, letterSpacing: 3, marginBottom: 16 },
												children: 'JOKE OF THE DAY',
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 36, lineHeight: 1.5 },
												children: joke.setup,
											},
										},
										...(joke.delivery ? [{
											type: 'div',
											props: {
												style: { fontSize: 36, fontWeight: 700, lineHeight: 1.5, marginTop: 12 },
												children: joke.delivery,
											},
										}] : []),
									],
								},
							},
						],
					},
				},
			],
		},
	};

	const svg = await satori(node as any, {
		width: IMG_W,
		height: IMG_H,
		fonts: [
			{ name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
			{ name: 'Inter', data: interBold, weight: 700, style: 'normal' },
			{ name: 'weathericons', data: weatherIconsFont, weight: 400, style: 'normal' },
		],
	});

	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: IMG_W } });
	return resvg.render().asPng();
}
