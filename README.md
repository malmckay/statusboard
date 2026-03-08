# statusboard

Cloudflare Worker + Inkplate 5 V2 e-ink display. The worker generates a 1280×720 PNG every 30 minutes with today's weather and a joke of the day. The device fetches it every 4 hours and overlays the current time, refreshing the clock every minute.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                        3:45 PM                              │
│                   Sunday, Mar 8                             │
│                                                             │
├──────────────────────────┬──────────────────────────────────┤
│ TODAY                    │ JOKE OF THE DAY                  │
│                          │                                  │
│ Partly Cloudy            │ Why don't scientists trust       │
│ High 48°F · Low 31°F     │ atoms? Because they make up      │
│ Portland, ME             │ everything.                      │
└──────────────────────────┴──────────────────────────────────┘
```

## Structure

```
statusboard/
├── src/                  # Cloudflare Worker source
│   ├── index.ts          # Fetch handler + routing
│   ├── dailyImage.ts     # PNG generation (satori → resvg)
│   ├── weather.ts        # WeatherAPI.com client
│   ├── joke.ts           # icanhazdadjoke.com client
│   └── fonts/            # Bundled Inter .ttf files
├── migrations/           # D1 SQL migrations
├── inkplate/             # Arduino sketch (Soldered Inkplate 5 V2)
│   ├── Inkplate5V2_News.ino
│   ├── src/Network.h/.cpp
│   └── Fonts/Inter16pt7b.h
├── wrangler.json
└── Justfile
```

## Worker

**Endpoint:** `GET /daily-image` — returns a 1280×720 grayscale PNG, cached 30 min.

**Layout:** top 280px blank (device draws the clock there), below: weather left / joke right.

**Config** (in `wrangler.json` vars):
| Var | Value |
|-----|-------|
| `WEATHER_API_KEY` | WeatherAPI.com key |
| `WEATHER_CITY` | `Portland,ME` |

```bash
just dev       # seed local D1 + start dev server
just deploy    # apply remote migrations + deploy
just check     # typecheck + dry-run deploy
```

## Inkplate sketch

**Board:** Soldered Inkplate 5 V2 (`Inkplate_Boards:esp32:Inkplate5V2`)

**Required Arduino libraries** (install via Library Manager):
- Inkplate (Soldered)
- ArduinoJson (Benoit Blanchon)

**Configure** at the top of `inkplate/Inkplate5V2_News.ino`:
```cpp
const char *WIFI_SSID  = "...";
const char *WIFI_PASS  = "...";
const char *WORKER_URL = "https://statusboard.<subdomain>.workers.dev/daily-image";
```

```bash
just compile   # compile sketch
just flash     # compile + upload to connected device
just flash PORT=/dev/cu.usbserial-XXXX  # override port
```
