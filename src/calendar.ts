// Google Calendar client — fetches a private iCal feed and parses it.
// ICAL_URL should be the "Secret address in iCal format" from Google Calendar settings.

import ICAL from 'ical.js';

export interface CalendarEvent {
	summary: string;
	time?: string;  // formatted start time, e.g. "8:00am" — omitted for all-day events
}

export interface CalendarData {
	events: CalendarEvent[];  // today's (or tomorrow's) events, max 6 — all-day first, then by start time
	isForTomorrow: boolean;
	countdown: { label: string; days: number } | null;
}

// Tag used to identify the countdown event in the calendar.
// The event title must contain this string (case-insensitive).
const COUNTDOWN_TAG = '#countdown';

// Maximum recurrence iterations per event when expanding RRULEs.
// 2000 covers ~5.5 years of daily events or ~38 years of weekly events.
const MAX_ITER = 2000;

type YMD = { year: number; month: number; day: number };
type Eastern = YMD & { hour: number; minute: number; isDate: boolean };

// Returns the Nth Sunday of a given month (0-based month) as a UTC Date.
function nthSunday(year: number, month: number, n: number): Date {
	const firstOfMonth = new Date(Date.UTC(year, month, 1));
	const dow = firstOfMonth.getUTCDay(); // 0 = Sunday
	const firstSunday = dow === 0 ? 1 : 8 - dow;
	return new Date(Date.UTC(year, month, firstSunday + (n - 1) * 7));
}

// Returns the Eastern UTC offset in ms for a given UTC timestamp.
// Exported so dailyImage.ts can use the same DST-aware logic.
// EDT (UTC-4) from second Sunday of March 07:00 UTC to first Sunday of November 06:00 UTC.
// EST (UTC-5) otherwise.
export function easternOffsetMs(utc: Date): number {
	const y = utc.getUTCFullYear();
	const dstStart = nthSunday(y, 2, 2);  // 2nd Sunday of March
	dstStart.setUTCHours(7);              // 2am EST = 07:00 UTC
	const dstEnd = nthSunday(y, 10, 1);   // 1st Sunday of November
	dstEnd.setUTCHours(6);               // 2am EDT = 06:00 UTC
	return utc >= dstStart && utc < dstEnd ? 4 * 3600_000 : 5 * 3600_000;
}

// Convert an ICAL.Time to Eastern-local components.
//   • All-day (isDate=true)          → date components as-is, hour/minute = 0
//   • UTC-stamped (DTSTART:...Z)     → convert to Eastern via DST-aware offset
//   • TZID-local (DTSTART;TZID=...)  → ical.js already stores local time in .year/.month/.day/.hour/.minute
function toEastern(t: ICAL.Time): Eastern {
	if (t.isDate) {
		return { year: t.year, month: t.month, day: t.day, hour: 0, minute: 0, isDate: true };
	}
	if (t.zone?.tzid === 'UTC') {
		const utc = t.toJSDate();
		const d = new Date(utc.getTime() - easternOffsetMs(utc));
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

// Returns today's date in Eastern time.
function todayEastern(now: Date): YMD {
	const d = new Date(now.getTime() - easternOffsetMs(now));
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

function setCountdown(days: number, label: string, cur: number): { days: number; label: string } | null {
	if (days < cur) return { days, label: label.replace(/#countdown/gi, '').trim() };
	return null;
}

async function fetchIcalText(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`iCal fetch HTTP ${res.status} for ${url}`);
	return res.text();
}

export async function fetchCalendar(env: Env, now = new Date()): Promise<CalendarData> {
	const urls = [env.ICAL_URL, env.ICAL_URL_2].filter(Boolean);
	const texts = await Promise.all(urls.map(fetchIcalText));
	const comps = texts.map(t => new ICAL.Component(ICAL.parse(t)));
	// After 6:30pm Eastern, show tomorrow's events instead of today's
	const nowEastern = new Date(now.getTime() - easternOffsetMs(now));
	const easternHour = nowEastern.getUTCHours();
	const easternMinute = nowEastern.getUTCMinutes();
	const showTomorrow = easternHour > 18 || (easternHour === 18 && easternMinute >= 30);

	let today = todayEastern(now);
	if (showTomorrow) {
		const d = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
		today = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
	}

	const regularEvents: EventEntry[] = [];
	let countdownDays = Infinity;
	let countdownLabel = '';

	const vevents = comps.flatMap(c => c.getAllSubcomponents('vevent'));
	for (const vevent of vevents) {
		const event = new ICAL.Event(vevent);
		const summary: string = event.summary ?? '';
		const description: string = event.description ?? '';
		const isCountdown = description.toLowerCase().includes(COUNTDOWN_TAG.toLowerCase());

		if (event.isRecurring()) {
			const iter = event.iterator();
			let next: ICAL.Time | null;
			let limit = MAX_ITER;

			while (limit-- > 0 && (next = iter.next())) {
				const e = toEastern(next);

				if (isAfter(e, today)) {
					if (isCountdown) {
						const days = daysUntil(e, today);
						if (days < countdownDays) {
							countdownDays = days;
							countdownLabel = summary.replace(/#countdown/gi, '').trim();
						}
					}
					break;
				}

				if (sameDay(e, today)) {
					regularEvents.push({ summary, isAllDay: e.isDate, hour: e.hour, minute: e.minute });
					if (isCountdown && 0 < countdownDays) {
						countdownDays = 0;
						countdownLabel = summary.replace(/#countdown/gi, '').trim();
					}
					break;
				}
			}
		} else {
			const e = toEastern(event.startDate);

			if (isCountdown) {
				if (sameDay(e, today) && 0 < countdownDays) {
					countdownDays = 0;
					countdownLabel = summary.replace(/#countdown/gi, '').trim();
				} else if (isAfter(e, today)) {
					const days = daysUntil(e, today);
					if (days < countdownDays) {
						countdownDays = days;
						countdownLabel = summary.replace(/#countdown/gi, '').trim();
					}
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

	return {
		events: uniqueEvents.slice(0, 6).map(e => ({
			summary: e.summary,
			time: e.isAllDay ? undefined : formatTime(e.hour, e.minute),
		})),
		isForTomorrow: showTomorrow,
		countdown: countdownDays < Infinity ? { label: countdownLabel, days: countdownDays } : null,
	};
}
