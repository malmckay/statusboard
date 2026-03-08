// Google Calendar client.
// Currently returns stub data. Wire up GOOGLE_CALENDAR_ID + GOOGLE_API_KEY
// in wrangler.json vars and replace the stub below with a real API call.

export interface CalendarData {
	events: string[];       // today's event names, max 6
	countdown: { label: string; days: number } | null;
}

// Tag used to identify the countdown event in the calendar.
// The event title must contain this string (case-insensitive).
const COUNTDOWN_TAG = '#countdown';

export async function fetchCalendar(_env: Env): Promise<CalendarData> {
	// ── Stub ──────────────────────────────────────────────────────────────────
	// Replace this block with a real Google Calendar API call once credentials
	// are configured in wrangler.json.
	return {
		events: ['School', 'Gym', 'Music'],
		countdown: { label: 'vacation', days: 10 },
	};

	// ── Real implementation (future) ──────────────────────────────────────────
	// const calendarId = _env.GOOGLE_CALENDAR_ID;
	// const apiKey     = _env.GOOGLE_API_KEY;
	// const now        = new Date();
	// const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
	// const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);
	//
	// const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
	//   `?key=${apiKey}&singleEvents=true&orderBy=startTime` +
	//   `&timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}&maxResults=50`;
	//
	// const res = await fetch(url);
	// if (!res.ok) throw new Error(`Google Calendar API HTTP ${res.status}`);
	// const data = (await res.json()) as any;
	//
	// const allEvents: string[] = (data.items ?? []).map((e: any) => e.summary as string);
	//
	// // Find countdown event (tagged with COUNTDOWN_TAG)
	// const countdownEvent = allEvents.find(name =>
	//   name.toLowerCase().includes(COUNTDOWN_TAG.toLowerCase())
	// );
	// // ... compute days until that future event ...
	//
	// return {
	//   events: allEvents.filter(n => !n.toLowerCase().includes(COUNTDOWN_TAG)).slice(0, 6),
	//   countdown: countdownEvent ? { label: '...', days: 0 } : null,
	// };
}
