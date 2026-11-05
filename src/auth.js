import { getJson, request } from "./http.js";

const CATALOG = "https://api-catalogo.zanichelli.it/v3";

export async function login(username, password) {
	const loginRequest = await request("https://idp.zanichelli.it/v4/login/", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
	});

	if (loginRequest.status == 401) {
		console.log("Error: Email and/or password are not correct.");
		process.exit(1);
	}
	if (!loginRequest.ok) throw new Error(`Login failed with status ${loginRequest.status}`);

	const { token } = await loginRequest.json();

	if (!token) {
		console.log("Error: Email and/or password are not correct.");
		process.exit(1);
	}

	// The catalog now accepts the IDP session cookie directly. The home page
	// no longer exchanges it for a myz_token cookie.
	return { cookie: `token=${token}` };
}

export async function fetchUser(cookie) {
	const user = await getJson(`${CATALOG}/dashboard/user`, { headers: { cookie } });

	if (typeof user.firstName !== "string" || user.firstName == "unknown") {
		console.log("Error: Email and/or password are not correct.");
		process.exit(1);
	}

	return user;
} // we don't really care about the response, but apparently it's required to access the book list

export async function fetchBooks(cookie) {
	const headers = { cookie };
	const books = {};

	for (let page = 1; ; page++) {
		const res = await request(
			`${CATALOG}/dashboard/search?sort%5Bfield%5D=year_date&sort%5Bdirection%5D=desc&searchString&pageNumber=${page}&rows=100`,
			{ headers }
		);
		if (res.status == 403) break;
		if (!res.ok) throw new Error(`Unable to fetch the book list (status ${res.status})`);

		const { data } = await res.json();
		addLicenses(books, data.licenses);
		if (data.pagination.pages == 0 || data.pagination.pages == page) break;
	}

	const realLicenses = await request(`${CATALOG}/dashboard/licenses/real`, { headers });
	if (realLicenses.ok) addLicenses(books, (await realLicenses.json()).realLicenses);

	return books;
}

function addLicenses(books, licenses) {
	for (const license of licenses || []) {
		if (license.volume.ereader_url == "") continue;
		books[license.volume.isbn] = {
			title: license.volume.opera.title,
			ereader_url: license.volume.ereader_url,
			isbns: license.volume.isbns,
		};
	}
}
