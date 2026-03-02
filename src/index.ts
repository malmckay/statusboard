import { renderHtml } from './renderHtml';
import { generateDailyImage } from './dailyImage';

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/daily-image') {
			// Cache the generated image for 30 minutes
			const cache = caches.default;
			const cacheKey = new Request(request.url, { method: 'GET' });
			const cached = await cache.match(cacheKey);
			if (cached) return cached;

			try {
				const png = await generateDailyImage(env);
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
		const stmt = env.DB.prepare('SELECT * FROM comments LIMIT 3');
		const { results } = await stmt.all();
		return new Response(renderHtml(JSON.stringify(results, null, 2)), {
			headers: { 'content-type': 'text/html' },
		});
	},
} satisfies ExportedHandler<Env>;
