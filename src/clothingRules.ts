// Clothing tip rules for Portland, ME.
// Rules are evaluated in order; the first match wins.
// Edit this file to adjust tips to your liking.

export interface ClothingRule {
	// At least one condition must be provided.
	// All provided conditions must match for the rule to fire.
	conditionIncludes?: string; // substring match against WeatherData.condition (case-insensitive)
	maxHighF?: number;          // fires when tempHighF <= this value
	minHighF?: number;          // fires when tempHighF >= this value
	tip: string;
}

export const clothingRules: ClothingRule[] = [
	// ── Precipitation-based (checked first) ──────────────────────────────────
	{ conditionIncludes: 'freezing',                              tip: 'Watch for ice' },
	{ conditionIncludes: 'sleet',                                 tip: 'Watch for ice' },
	{ conditionIncludes: 'blizzard',                              tip: 'Bundle up — blizzard warning' },
	{ conditionIncludes: 'snow',      maxHighF: 25,               tip: 'Bundle up, heavy snow likely' },
	{ conditionIncludes: 'snow',                                  tip: 'Dress warmly, snow expected' },
	{ conditionIncludes: 'rain',      maxHighF: 45,               tip: 'Cold rain — coat and umbrella' },
	{ conditionIncludes: 'rain',                                  tip: 'Bring an umbrella' },
	{ conditionIncludes: 'drizzle',                               tip: 'Bring an umbrella' },
	{ conditionIncludes: 'thunder',                               tip: 'Stormy — stay safe inside' },

	// ── Temperature-based ────────────────────────────────────────────────────
	{ maxHighF: 15,                                               tip: 'Dangerously cold — dress in layers' },
	{ maxHighF: 25,                                               tip: 'Very cold — heavy coat, hat, gloves' },
	{ maxHighF: 35,                                               tip: 'Freezing — wear your warmest coat' },
	{ maxHighF: 45,                                               tip: 'Cold — wear a coat' },
	{ maxHighF: 55,                                               tip: 'Chilly — wear a jacket' },
	{ maxHighF: 65,                                               tip: 'Cool — a light layer is a good idea' },
	{ minHighF: 80,                                               tip: 'Hot day — stay cool and hydrated' },
	{ minHighF: 66,                                               tip: 'Wear shorts!' },

	// ── Fallback ─────────────────────────────────────────────────────────────
	{                                                             tip: 'Dress comfortably' },
];

export function getClothingTip(condition: string, tempHighF: number): string {
	for (const rule of clothingRules) {
		const condMatch =
			rule.conditionIncludes === undefined ||
			condition.toLowerCase().includes(rule.conditionIncludes.toLowerCase());
		const maxMatch = rule.maxHighF === undefined || tempHighF <= rule.maxHighF;
		const minMatch = rule.minHighF === undefined || tempHighF >= rule.minHighF;
		if (condMatch && maxMatch && minMatch) return rule.tip;
	}
	return 'Dress comfortably';
}
