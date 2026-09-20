import { getJson, request, requestOk, parseSetCookie } from "./http.js";

const CATALOG = "https://api-catalogo.zanichelli.it/v3";

const WRONG_CREDENTIALS = "Email and/or password are not correct.";

export async function login(username, password) {
	const loginRequest = await request("https://idp.zanichelli.it/v4/login/", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
	});

	if (loginRequest.status == 401) throw new Error(WRONG_CREDENTIALS);
	if (!loginRequest.ok) throw new Error(`Login failed with status ${loginRequest.status}`);

	const { token } = await loginRequest.json();

	if (!token) throw new Error(WRONG_CREDENTIALS);

	const cookie = `token=${token}`;

	const res = await requestOk("https://my.zanichelli.it/?loginMode=myZanichelli", { headers: { cookie } });

	const dashboardCookies = {};
	for (const loginCookie of parseSetCookie(res)) {
		const separator = loginCookie.indexOf("=");
		dashboardCookies[loginCookie.slice(0, separator)] = loginCookie.slice(separator + 1);
	}

	return { cookie, myzToken: dashboardCookies["myz_token"] };
}

export async function fetchUser(myzToken) {
	const user = await getJson(`${CATALOG}/dashboard/user`, { headers: { "myz-token": myzToken } });

	if (typeof user.firstName !== "string" || user.firstName == "unknown") throw new Error(WRONG_CREDENTIALS);

	return user;
} // we don't really care about the response, but apparently it's required to access the book list

/*await fetch('https://api-catalogo.zanichelli.it/v3/dashboard/init', {
	headers: { 'myz-token': dashboardCookies['myz_token'] },
}).then(res => res.text()).then(console.log).catch((err) => {
	console.log("Error: ", err);
	process.exit(1);
});*/ // keeping this, perhaps it's needed in the future

export async function fetchBooks(myzToken) {
	const headers = { "myz-token": myzToken };
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
