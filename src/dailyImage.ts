import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
// @ts-ignore – wrangler bundles this via "type": "CompiledWasm" rule
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interRegular from './fonts/Inter-Regular.ttf';
import interBold from './fonts/Inter-Bold.ttf';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Leaf div — always needs display:'flex' to satisfy satori 0.21 validation.
function shape(style: Record<string, any>) {
	return { type: 'div', props: { style: { display: 'flex', ...style }, children: [] } };
}

// ── Weather icons (satori nodes) ─────────────────────────────────────────────
// All icons are drawn in a roughly 80×80 px space.

function iconSun() {
	const cx = 40, cy = 40, r = 18, rays = 8, rayLen = 12, rayGap = 24;
	const rayNodes = Array.from({ length: rays }, (_, i) => {
		const angle = (i * 360) / rays;
		const rad = (angle * Math.PI) / 180;
		const x1 = cx + Math.cos(rad) * rayGap;
		const y1 = cy + Math.sin(rad) * rayGap;
		const x2 = cx + Math.cos(rad) * (rayGap + rayLen);
		const y2 = cy + Math.sin(rad) * (rayGap + rayLen);
		return shape({ position: 'absolute', left: x1, top: y1, width: Math.abs(x2-x1) || 2, height: Math.abs(y2-y1) || 2, background: 'black' });
	});
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: cx-r, top: cy-r, width: r*2, height: r*2, borderRadius: r, background: 'black' }),
				...rayNodes,
			],
		},
	};
}

function iconCloud() {
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: 10, top: 30, width: 50, height: 22, borderRadius: 11, background: 'black' }),
				shape({ position: 'absolute', left: 18, top: 22, width: 26, height: 26, borderRadius: 13, background: 'black' }),
				shape({ position: 'absolute', left: 32, top: 24, width: 22, height: 22, borderRadius: 11, background: 'black' }),
			],
		},
	};
}

function iconPartlyCloud() {
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: 4,  top: 8,  width: 28, height: 28, borderRadius: 14, background: 'black' }),
				shape({ position: 'absolute', left: 14, top: 36, width: 52, height: 20, borderRadius: 10, background: 'black' }),
				shape({ position: 'absolute', left: 22, top: 28, width: 24, height: 24, borderRadius: 12, background: 'black' }),
				shape({ position: 'absolute', left: 38, top: 30, width: 20, height: 20, borderRadius: 10, background: 'black' }),
			],
		},
	};
}

function iconRain() {
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: 8,  top: 8,  width: 54, height: 20, borderRadius: 10, background: 'black' }),
				shape({ position: 'absolute', left: 16, top: 4,  width: 22, height: 22, borderRadius: 11, background: 'black' }),
				shape({ position: 'absolute', left: 32, top: 6,  width: 18, height: 18, borderRadius: 9,  background: 'black' }),
				shape({ position: 'absolute', left: 18, top: 36, width: 4,  height: 14, borderRadius: 2,  background: 'black' }),
				shape({ position: 'absolute', left: 33, top: 40, width: 4,  height: 14, borderRadius: 2,  background: 'black' }),
				shape({ position: 'absolute', left: 48, top: 36, width: 4,  height: 14, borderRadius: 2,  background: 'black' }),
			],
		},
	};
}

function iconSnow() {
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: 8,  top: 8,  width: 54, height: 20, borderRadius: 10, background: 'black' }),
				shape({ position: 'absolute', left: 16, top: 4,  width: 22, height: 22, borderRadius: 11, background: 'black' }),
				shape({ position: 'absolute', left: 32, top: 6,  width: 18, height: 18, borderRadius: 9,  background: 'black' }),
				shape({ position: 'absolute', left: 16, top: 38, width: 7,  height: 7,  borderRadius: 4,  background: 'black' }),
				shape({ position: 'absolute', left: 31, top: 42, width: 7,  height: 7,  borderRadius: 4,  background: 'black' }),
				shape({ position: 'absolute', left: 46, top: 38, width: 7,  height: 7,  borderRadius: 4,  background: 'black' }),
			],
		},
	};
}

function iconSleet() {
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: 8,  top: 8,  width: 54, height: 20, borderRadius: 10, background: 'black' }),
				shape({ position: 'absolute', left: 16, top: 4,  width: 22, height: 22, borderRadius: 11, background: 'black' }),
				shape({ position: 'absolute', left: 32, top: 6,  width: 18, height: 18, borderRadius: 9,  background: 'black' }),
				shape({ position: 'absolute', left: 16, top: 37, width: 4,  height: 12, borderRadius: 2,  background: 'black' }),
				shape({ position: 'absolute', left: 31, top: 41, width: 7,  height: 7,  borderRadius: 4,  background: 'black' }),
				shape({ position: 'absolute', left: 47, top: 37, width: 4,  height: 12, borderRadius: 2,  background: 'black' }),
			],
		},
	};
}

function iconThunder() {
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: 8,  top: 4,  width: 54, height: 20, borderRadius: 10, background: 'black' }),
				shape({ position: 'absolute', left: 16, top: 0,  width: 22, height: 22, borderRadius: 11, background: 'black' }),
				shape({ position: 'absolute', left: 32, top: 2,  width: 18, height: 18, borderRadius: 9,  background: 'black' }),
				shape({ position: 'absolute', left: 34, top: 28, width: 14, height: 4,  background: 'black', transform: 'rotate(30deg)' }),
				shape({ position: 'absolute', left: 28, top: 40, width: 14, height: 4,  background: 'black', transform: 'rotate(30deg)' }),
			],
		},
	};
}

function iconFog() {
	return {
		type: 'div',
		props: {
			style: { position: 'relative', width: 80, height: 80, display: 'flex' },
			children: [
				shape({ position: 'absolute', left: 8,  top: 20, width: 58, height: 7, borderRadius: 4, background: 'black' }),
				shape({ position: 'absolute', left: 16, top: 36, width: 48, height: 7, borderRadius: 4, background: 'black' }),
				shape({ position: 'absolute', left: 8,  top: 52, width: 58, height: 7, borderRadius: 4, background: 'black' }),
			],
		},
	};
}

function weatherIcon(code: ConditionCode) {
	switch (code) {
		case 'sunny':        return iconSun();
		case 'partly-cloudy': return iconPartlyCloud();
		case 'cloudy':       return iconCloud();
		case 'rain':         return iconRain();
		case 'snow':         return iconSnow();
		case 'sleet':        return iconSleet();
		case 'thunder':      return iconThunder();
		case 'fog':          return iconFog();
	}
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

export async function generateDailyImage(env: Env): Promise<Uint8Array> {
	await ensureWasm();

	const [weather, joke, calendar] = await Promise.all([
		fetchWeather(env.WEATHER_API_KEY, env.WEATHER_CITY),
		fetchJoke(),
		fetchCalendar(env),
	]);

	const clothingTip = getClothingTip(weather.condition, weather.tempHighF);

	// ── Date string for top-left ──────────────────────────────────────────────
	const kDay   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
	const kMonth = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
	// Use Eastern time (UTC-5 proxy, good enough for date display)
	const nowEastern = new Date(Date.now() - 5 * 3600 * 1000);
	const dayName   = kDay[nowEastern.getUTCDay()];
	const monthName = kMonth[nowEastern.getUTCMonth()];
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
												style: { fontSize: 36, fontWeight: 700, letterSpacing: 6, color: '#555' },
												children: dayName,
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
													...calendar.events.map(name => ({
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
																		style: {
																			display: 'flex',
																			width: 8,
																			height: 8,
																			borderRadius: 4,
																			background: 'black',
																			marginRight: 12,
																			flexShrink: 0,
																			marginTop: 2,
																		},
																		children: [],
																	},
																},
																{
																	type: 'div',
																	props: {
																		style: { fontSize: 28, lineHeight: 1.3 },
																		children: name,
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
												children: [
													{
														type: 'div',
														props: {
															style: { fontSize: 36, fontWeight: 700 },
															children: `${calendar.countdown.days}`,
														},
													},
													{
														type: 'div',
														props: {
															style: { fontSize: 20, color: '#555', marginTop: 2 },
															children: `days til ${calendar.countdown.label}`,
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
										justifyContent: 'center',
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
												style: { fontSize: 28, lineHeight: 1.5 },
												children: joke,
											},
										},
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
		],
	});

	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: IMG_W } });
	return resvg.render().asPng();
}
