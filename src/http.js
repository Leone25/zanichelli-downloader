import fetch from "node-fetch";

// refuses to respond without it
const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

export const READER_ORIGIN = "https://webreader.zanichelli.it/";

const DEFAULT_TIMEOUT = 15000;

// the timeout only covers the connection and the response headers, otherwise a
// big file on a slow connection would get cut off halfway through
export async function request(url, { headers = {}, timeout = DEFAULT_TIMEOUT, ...options } = {}) {
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => abortController.abort(), timeout);
	try {
		return await fetch(url, {
			...options,
			signal: abortController.signal,
			headers: { "User-Agent": USER_AGENT, ...headers },
		});
	} catch (err) {
		if (err.name == "AbortError") throw new Error(`Request to ${url} timed out after ${timeout}ms`);
		throw err;
	} finally {
		clearTimeout(timeoutId);
	}
}

export async function requestOk(url, options) {
	const res = await request(url, options);
	if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);
	return res;
}

export async function getText(url, options) {
	return (await requestOk(url, options)).text();
}

export async function getJson(url, options) {
	return (await requestOk(url, options)).json();
}

export async function getBuffer(url, options) {
	return (await requestOk(url, options)).buffer();
}

// for timeouts and the odd hiccup on the reader's side
export async function retry(description, task, { attempts = 5, delay = 1000 } = {}) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await task();
		} catch (err) {
			if (attempt == attempts) throw new Error(`${description} failed after ${attempts} attempts: ${err.message}`);
			console.log(`${description} failed (${err.message}), retrying...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
}

export function parseSetCookie(res) {
	const setCookie = res.headers.raw()["set-cookie"];
	if (!setCookie) throw new Error("The server didn't return any cookie, you may have been logged out");
	return setCookie.map((cookie) => cookie.split(";")[0]);
}
