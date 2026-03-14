export interface JokeData {
	setup: string;
	delivery?: string;  // present for two-part jokes; omitted for single-line jokes
}

export async function fetchJoke(): Promise<JokeData> {
	const res = await fetch('https://v2.jokeapi.dev/joke/Pun?blacklistFlags=nsfw,religious,political,racist,sexist,explicit', {
		headers: { Accept: 'application/json' },
	});
	if (!res.ok) throw new Error(`Joke API HTTP ${res.status}`);
	const data = (await res.json()) as { joke?: string; setup?: string; delivery?: string };
	return data.joke
		? { setup: data.joke }
		: { setup: data.setup ?? '', delivery: data.delivery };
}
