import { renderHtml } from './renderHtml';
import { generateDailyImage } from './dailyImage';

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/daily-image') {
			// Cache the generated image for 30 minutes (canonical key strips query params)
			const cache = caches.default;
			const cacheKey = new Request(`${url.origin}/daily-image`, { method: 'GET' });
			const cached = url.searchParams.get('bust') !== '1' && await cache.match(cacheKey);
			// if (cached) return cached;

			try {
				const dateParam = url.searchParams.get('date');
				const now = dateParam ? new Date(`${dateParam}T12:00:00Z`) : undefined;
				const png = await generateDailyImage(env, now);
				const response = new Response(png, {
					headers: {
						'Content-Type': 'image/png',
						'Cache-Control': 'public, max-age=1800',
					},
				});
				await cache.put(cacheKey, response.clone());
				return response;
			} catch (err) {
				return new Response(`Image generation failed: ${String(err)}`, { status: 500 });
			}
		}

		// Default route: show D1 data
		return new Response(renderHtml('Hi!'), {
			headers: { 'content-type': 'text/html' },
		});
	},
} satisfies ExportedHandler<Env>;
