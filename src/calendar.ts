// Google Calendar client — fetches a private iCal feed and parses it.
// ICAL_URL should be the "Secret address in iCal format" from Google Calendar settings.

import ICAL from 'ical.js';

export interface CalendarEvent {
	summary: string;
	time?: string;  // formatted start time, e.g. "8:00am" — omitted for all-day events
}

export interface CalendarData {
	events: CalendarEvent[];  // today's events, max 6 — all-day first, then by start time
	countdown: { label: string; days: number } | null;
}

// Tag used to identify the countdown event in the calendar.
// The event title must contain this string (case-insensitive).
const COUNTDOWN_TAG = '#countdown';

// Maximum recurrence iterations per event when expanding RRULEs.
// 2000 covers ~5.5 years of daily events or ~38 years of weekly events.
const MAX_ITER = 2000;

// Eastern UTC offset in ms (UTC-5 proxy — close enough for date/time display).
const EASTERN_OFFSET_MS = 5 * 3600 * 1000;

type YMD = { year: number; month: number; day: number };
type Eastern = YMD & { hour: number; minute: number; isDate: boolean };

// Convert an ICAL.Time to Eastern-local components.
//   • All-day (isDate=true)          → date components as-is, hour/minute = 0
//   • UTC-stamped (DTSTART:...Z)     → subtract Eastern offset via toJSDate()
//   • TZID-local (DTSTART;TZID=...)  → ical.js already stores local time in .year/.month/.day/.hour/.minute
function toEastern(t: ICAL.Time): Eastern {
	if (t.isDate) {
		return { year: t.year, month: t.month, day: t.day, hour: 0, minute: 0, isDate: true };
	}
	if (t.zone?.tzid === 'UTC') {
		const d = new Date(t.toJSDate().getTime() - EASTERN_OFFSET_MS);
		return {
			year: d.getUTCFullYear(),
			month: d.getUTCMonth() + 1,
			day: d.getUTCDate(),
			hour: d.getUTCHours(),
			minute: d.getUTCMinutes(),
			isDate: false,
		};
	}
	// TZID-local: ical.js stores the wall-clock time directly.
	return { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, isDate: false };
}

// Returns today's date in Eastern time (UTC-5 proxy).
function todayEastern(now: Date): YMD {
	const d = new Date(now.getTime() - EASTERN_OFFSET_MS);
	return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function sameDay(a: YMD, b: YMD) {
	return a.year === b.year && a.month === b.month && a.day === b.day;
}

function isAfter(a: YMD, b: YMD) {
	if (a.year !== b.year) return a.year > b.year;
	if (a.month !== b.month) return a.month > b.month;
	return a.day > b.day;
}

function daysUntil(future: YMD, today: YMD): number {
	const a = Date.UTC(today.year, today.month - 1, today.day);
	const b = Date.UTC(future.year, future.month - 1, future.day);
	return Math.round((b - a) / 86_400_000);
}

function formatTime(hour: number, minute: number): string {
	const h = hour % 12 || 12;
	const m = minute.toString().padStart(2, '0');
	return `${h}:${m}${hour < 12 ? 'am' : 'pm'}`;
}

type EventEntry = { summary: string; isAllDay: boolean; hour: number; minute: number };

function sortKey(e: EventEntry): number {
	return e.isAllDay ? -1 : e.hour * 60 + e.minute;
}

export async function fetchCalendar(env: Env, now = new Date()): Promise<CalendarData> {
	const res = await fetch(env.ICAL_URL);
	if (!res.ok) throw new Error(`iCal fetch HTTP ${res.status}`);
	const text = await res.text();

	const comp = new ICAL.Component(ICAL.parse(text));
	const today = todayEastern(now);

	// console.error('[calendar] today =', JSON.stringify(today));

	const regularEvents: EventEntry[] = [];
	let countdownDays = Infinity;
	let countdownLabel = '';

	for (const vevent of comp.getAllSubcomponents('vevent')) {
		const event = new ICAL.Event(vevent);
		const summary: string = event.summary ?? '';
		const description: string = event.description ?? '';
		const isCountdown = description.toLowerCase().includes(COUNTDOWN_TAG.toLowerCase());

		if (event.isRecurring()) {
			// Iterate from DTSTART; break once we pass today.
			const iter = event.iterator();
			let next: ICAL.Time | null;
			let limit = MAX_ITER;

			while (limit-- > 0 && (next = iter.next())) {
				const e = toEastern(next);

				if (isAfter(e, today)) {
					if (isCountdown) {
						const days = daysUntil(e, today);
						if (days > 0 && days < countdownDays) {
							countdownDays = days;
							countdownLabel = summary.replace(/#countdown/gi, '').trim();
						}
					}
					break;
				}

				if (sameDay(e, today)) {
					// console.error('[calendar] recurring match:', summary, JSON.stringify(e));
					regularEvents.push({ summary, isAllDay: e.isDate, hour: e.hour, minute: e.minute });
					break;
				}
			}
		} else {
			const e = toEastern(event.startDate);
			// console.error('[calendar] single event:', summary, JSON.stringify(e));

			if (isCountdown && isAfter(e, today)) {
				const days = daysUntil(e, today);
				if (days < countdownDays) {
					countdownDays = days;
					countdownLabel = summary.replace(/#countdown/gi, '').trim();
				}
			}
			if (sameDay(e, today)) {
				regularEvents.push({ summary, isAllDay: e.isDate, hour: e.hour, minute: e.minute });
			}
		}
	}

	const seen = new Set<string>();
	const uniqueEvents = regularEvents.filter(e => !seen.has(e.summary) && seen.add(e.summary));
	uniqueEvents.sort((a, b) => sortKey(a) - sortKey(b));

	// console.error('[calendar] result:', JSON.stringify({ uniqueEvents, countdownDays, countdownLabel }));

	return {
		events: uniqueEvents.slice(0, 6).map(e => ({
			summary: e.summary,
			time: e.isAllDay ? undefined : formatTime(e.hour, e.minute),
		})),
		countdown: countdownDays < Infinity ? { label: countdownLabel, days: countdownDays } : null,
	};
}
