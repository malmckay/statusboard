# DONE — statusboard worker

- [x] Install satori and @resvg/resvg-wasm npm packages
- [x] Download Inter-Regular.ttf font to src/fonts/
- [x] Update wrangler.json: add module rules for .ttf, add WEATHER_API_KEY and CITY vars
- [x] Create src/weather.ts — WeatherAPI.com client (fetches high/low/condition)
- [x] Create src/joke.ts — icanhazdadjoke.com client
- [x] Create src/dailyImage.ts — 960×540 PNG generator (satori layout → resvg PNG)
- [x] Update src/index.ts — add /daily-image route
