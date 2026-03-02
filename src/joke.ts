export async function fetchJoke(): Promise<string> {
	const res = await fetch('https://icanhazdadjoke.com/', {
		headers: { Accept: 'application/json' },
	});
	if (!res.ok) throw new Error(`Joke API HTTP ${res.status}`);
	const data = (await res.json()) as { joke: string };
	return data.joke;
}
