/*
    Inkplate5V2_News — statusboard display
    Fetches a pre-rendered 1280×720 PNG from the statusboard Cloudflare Worker every 4 hours.
    The PNG contains date (top-left), calendar, weather, and joke.
    The top-right quadrant is left blank; the device draws the clock there every minute.

    Required libraries (install via Arduino Library Manager):
      - Inkplate (Soldered)
      - ArduinoJson (Benoit Blanchon)

    Board: Soldered Inkplate5 V2
*/

#ifndef ARDUINO_INKPLATE5V2
#error "Select 'Soldered Inkplate5 V2' in the Arduino IDE board menu."
#endif

// ---------- CONFIGURE HERE ----------
const char *WIFI_SSID       = "Otters";
const char *WIFI_PASS       = "AndKevin";

// URL of the Cloudflare Worker /daily-image endpoint.
// Run `npx wrangler deploy` in ~/Development/statusboard; the deployed URL
// appears in the output. Replace the placeholder below with that URL.
const char *WORKER_URL = "https://statusboard.mal-mckay.workers.dev/daily-image";

// Layout constants — must match TIME_H and TIME_MID_X in src/dailyImage.ts
const int TIME_AREA_H  = 280;  // height of the top strip
const int TIME_AREA_MX = 640;  // x where the clock half begins (right half is blank in PNG)
// ------------------------------------

#include "Inkplate.h"
#include "src/Network.h"

// 4 hours in milliseconds
#define IMAGE_REFRESH_INTERVAL_MS ((uint32_t)4 * 60 * 60 * 1000)
// 1 minute in milliseconds
#define CLOCK_REFRESH_INTERVAL_MS ((uint32_t)15 * 1000)

Inkplate inkplate(INKPLATE_1BIT);
Network  network;

// Tracks when we last fetched the background image
unsigned long lastImageFetch = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns the day-of-month of the Nth weekday in a given UTC month/year.
// wday: 0=Sun..6=Sat, n: 1=first, 2=second, -1=last
static int nthWeekday(int year, int month, int wday, int n)
{
    struct tm t = {};
    t.tm_year = year - 1900;
    t.tm_mon  = month - 1;
    t.tm_mday = 1;
    mktime(&t);
    int first = (wday - t.tm_wday + 7) % 7 + 1; // day-of-month of first occurrence
    return first + (n - 1) * 7;
}

// Returns the US Eastern UTC offset in seconds: -4*3600 (EDT) or -5*3600 (EST).
// DST: second Sunday in March 02:00 EST → first Sunday in November 02:00 EDT.
static int easternOffsetSeconds(time_t utc)
{
    struct tm t;
    gmtime_r(&utc, &t);
    int year = t.tm_year + 1900;

    // Spring forward: 2nd Sunday in March at 07:00 UTC (= 02:00 EST)
    // Fall back:      1st Sunday in November at 06:00 UTC (= 02:00 EDT)
    int dstStartDay = nthWeekday(year, 3, 0, 2);
    int dstEndDay   = nthWeekday(year, 11, 0, 1);

    int mon  = t.tm_mon + 1; // 1-12
    int mday = t.tm_mday;
    int hour = t.tm_hour;

    bool inDst = false;
    if (mon > 3 && mon < 11)
        inDst = true;
    else if (mon == 3)
        inDst = (mday > dstStartDay) || (mday == dstStartDay && hour >= 7);
    else if (mon == 11)
        inDst = (mday < dstEndDay) || (mday == dstEndDay && hour < 6);
    return inDst ? -4 * 3600 : -5 * 3600;
}

// Returns local Eastern epoch via NTP.
time_t localEpoch()
{
    time_t nowSec;
    inkplate.getNTPEpoch(&nowSec);
    // Spin until NTP has synced
    unsigned long t = millis();
    while (nowSec < (time_t)(8 * 3600 * 2) && millis() - t < 10000UL)
    {
        delay(200);
        nowSec = time(nullptr);
    }
    return nowSec + (time_t)easternOffsetSeconds(nowSec);
}

// Clears the clock area (top-right half) and draws the current time.
// The date is rendered by the worker in the top-left half — do not touch it.
void drawTimeOverlay()
{
    // Clear only the right half of the top strip
    int clockW = inkplate.width() - TIME_AREA_MX;
    inkplate.fillRect(TIME_AREA_MX, 0, clockW, TIME_AREA_H, WHITE);

    time_t now = localEpoch();
    struct tm t;
    gmtime_r(&now, &t);

    // ── Time: large h:mm + half-size AM/PM top-aligned to the right ──────────
    int hour12 = t.tm_hour % 12;
    if (hour12 == 0) hour12 = 12;
    const char *ampm = (t.tm_hour < 12) ? "AM" : "PM";
    char timeStr[8];
    sprintf(timeStr, "%d:%02d", hour12, t.tm_min);

    int16_t bx1, by1, bx2, by2;
    uint16_t bw1, bh1, bw2, bh2;

    inkplate.setFont(nullptr);
    inkplate.setTextColor(BLACK, WHITE);

    inkplate.setTextSize(16);
    inkplate.getTextBounds(timeStr, 0, 0, &bx1, &by1, &bw1, &bh1);

    inkplate.setTextSize(8);
    inkplate.getTextBounds(ampm, 0, 0, &bx2, &by2, &bw2, &bh2);

    const int ampmGap = 4;
    int totalW = (int)bw1 + ampmGap + (int)bw2;

    // Top-left of the time bounding box, centred in the clock area
    int startX = TIME_AREA_MX + (clockW - totalW) / 2;
    int topY   = (TIME_AREA_H - (int)bh1) / 2;

    // Draw large h:mm
    inkplate.setTextSize(16);
    inkplate.setCursor(startX - bx1, topY - by1);
    inkplate.print(timeStr);

    // Draw AM/PM at half size, top-aligned with the time string
    inkplate.setTextSize(8);
    inkplate.setCursor(startX + (int)bw1 + ampmGap - bx2, topY - by2);
    inkplate.print(ampm);
}

// Fetches the background PNG from the worker and loads it into the frame buffer.
// Returns true on success.
bool fetchAndDrawBackground()
{
    network.ensureConnected();

    Serial.print(F("Fetching image from "));
    Serial.println(WORKER_URL);

    // drawPngFromWeb draws the PNG into the Inkplate frame buffer.
    // Parameters: url, x, y, dither, invert
    bool ok = inkplate.drawPngFromWeb(WORKER_URL, 0, 0, true, false);
    if (!ok)
    {
        Serial.println(F("drawPngFromWeb failed"));
    }
    return ok;
}

// ── Arduino entry points ─────────────────────────────────────────────────────

void setup()
{
    Serial.begin(115200);
    Serial.println(F("Inkplate5V2 statusboard starting..."));

    inkplate.begin();
    inkplate.setTextWrap(false);
    inkplate.setRotation(0); // Landscape: 960 wide × 540 tall

    // Use partial updates with a full refresh every 60 partial updates
    inkplate.setFullUpdateThreshold(60);

    // Connect to WiFi and sync NTP
    network.begin(WIFI_SSID, WIFI_PASS, -5); // UTC offset only used for NTP init; DST handled in localEpoch()

    // First full render
    if (fetchAndDrawBackground())
    {
        lastImageFetch = millis();
        drawTimeOverlay();
        inkplate.display(); // full refresh
    }
    else
    {
        inkplate.clearDisplay();
        inkplate.setFont(nullptr);
        inkplate.setTextSize(2);
        inkplate.setTextColor(BLACK, WHITE);
        inkplate.setCursor(20, 20);
        inkplate.println(F("Failed to fetch image from worker."));
        inkplate.println(F("Check WORKER_URL and WiFi."));
        inkplate.display();
    }
}

void loop()
{
    delay(CLOCK_REFRESH_INTERVAL_MS);

    unsigned long now = millis();

    // Every 4 hours: re-fetch the background image (weather + joke may have changed)
    bool newBackground = false;
    if (now - lastImageFetch >= IMAGE_REFRESH_INTERVAL_MS)
    {
        newBackground = fetchAndDrawBackground();
        if (newBackground) lastImageFetch = now;
    }

    // Always redraw the time overlay (every minute)
    drawTimeOverlay();

    if (newBackground)
        inkplate.display();    // full refresh after new background
    else
        inkplate.partialUpdate(); // fast update for clock-only change
}
