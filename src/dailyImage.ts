import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
// @ts-ignore – wrangler bundles this via "type": "CompiledWasm" rule
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interRegular from './fonts/Inter-Regular.ttf';
import interBold from './fonts/Inter-Bold.ttf';
import { fetchWeather } from './weather';
import { fetchJoke } from './joke';

// Image dimensions — must match the Inkplate 5 V2 display (1280×720)
export const IMG_W = 1280;
export const IMG_H = 720;
// The top TIME_H pixels are left blank for the device to draw the clock
export const TIME_H = 280;

let wasmReady = false;

async function ensureWasm() {
	if (!wasmReady) {
		await initWasm(resvgWasm);
		wasmReady = true;
	}
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		if ((current + ' ' + word).trim().length > maxCharsPerLine) {
			if (current) lines.push(current);
			current = word;
		} else {
			current = (current + ' ' + word).trim();
		}
	}
	if (current) lines.push(current);
	return lines;
}

export async function generateDailyImage(env: Env): Promise<Uint8Array> {
	await ensureWasm();

	const [weather, joke] = await Promise.all([
		fetchWeather(env.WEATHER_API_KEY, env.WEATHER_CITY),
		fetchJoke(),
	]);

	const contentH = IMG_H - TIME_H; // 440px for weather + joke
	const halfW = IMG_W / 2; // 640px each side

	// Satori node — plain object, no JSX required
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
				// ── Time placeholder ─────────────────────────────────────
				{
					type: 'div',
					props: {
						style: {
							width: IMG_W,
							height: TIME_H,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxSizing: 'border-box',
						},
						// Leave blank — device renders the clock here
						children: [],
					},
				},
				// ── Horizontal rule ───────────────────────────────────────
				{
					type: 'div',
					props: {
						style: { display: 'flex', width: IMG_W, height: 4, background: 'black' },
						children: [],
					},
				},
				// ── Content row ───────────────────────────────────────────
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexDirection: 'row',
							width: IMG_W,
							height: contentH - 4,
						},
						children: [
							// Weather panel
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										flexDirection: 'column',
										width: halfW,
										padding: '24px 32px',
										borderRight: '3px solid black',
										boxSizing: 'border-box',
									},
									children: [
										{
											type: 'div',
											props: {
												style: {
													fontSize: 29,
													fontWeight: 700,
													marginBottom: 13,
													letterSpacing: 3,
												},
												children: weather.isForTomorrow ? 'TOMORROW' : 'TODAY',
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 42, fontWeight: 700, marginBottom: 10 },
												children: weather.condition,
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 34 },
												children: `High ${weather.tempHighF}°F  ·  Low ${weather.tempLowF}°F`,
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 24, marginTop: 13, color: '#444' },
												children: weather.city,
											},
										},
									],
								},
							},
							// Joke panel
							{
								type: 'div',
								props: {
									style: {
										display: 'flex',
										flexDirection: 'column',
										width: halfW,
										padding: '24px 32px',
										boxSizing: 'border-box',
									},
									children: [
										{
											type: 'div',
											props: {
												style: {
													fontSize: 29,
													fontWeight: 700,
													marginBottom: 13,
													letterSpacing: 3,
												},
												children: 'JOKE OF THE DAY',
											},
										},
										{
											type: 'div',
											props: {
												style: { fontSize: 32, lineHeight: 1.45 },
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
