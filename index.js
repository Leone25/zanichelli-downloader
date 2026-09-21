import yargs from "yargs";
import { login, fetchUser, fetchBooks } from "./src/auth.js";
import { request } from "./src/http.js";
import { downloadKitabooBook } from "./src/kitaboo.js";
import { downloadBookTabBook } from "./src/booktab.js";
import { ask } from "./src/prompts.js";

const argv = yargs(process.argv.slice(2))
	.option("username", {
		alias: "u",
		type: "string",
		description: "Username(email)",
	})
	.option("password", {
		alias: "p",
		type: "string",
		description: "Password",
	})
	.option("isbn", {
		alias: "i",
		type: "string",
		description: "ISBN",
	})
	.option("booktab-isbn", {
		alias: "b",
		type: "string",
		description: "Overwrite the booktab ISBN (which is different from the normal ISBN)",
	})
	.help()
	.alias("help", "h")
	.argv;

async function main() {
	const username = argv.username || ask("Username(email): ");
	const password = argv.password || ask("Password: ");

	console.log("Logging in...");

	const { cookie, myzToken } = await login(username, password);

	const user = await fetchUser(myzToken);
	console.log(`Logged in as: ${user.firstName} ${user.lastName}`);

	console.log("Fetching available books...");

	const books = await fetchBooks(myzToken);

	if (Object.keys(books).length == 0) {
		console.log("No books found");
		return;
	}

	console.log("Available books:");
	console.table(books, ["title"]);

	let isbn = argv.isbn;

	while (!books[isbn]) {
		if (isbn) console.log(`No book with ISBN ${isbn} in the list above, try another one.`);
		isbn = ask("ISBN: ");
	}

	console.log("Detecting reader...");

	const redirect = await request(books[isbn].ereader_url, { headers: { cookie }, redirect: "manual" });
	const location = redirect.headers.get("location");

	if (!location) throw new Error("The reader didn't redirect anywhere, the book may not be downloadable");

	if (new URL(location).host == "web-booktab.zanichelli.it") {
		console.log("BookTab book detected");
		await downloadBookTabBook(books[isbn].ereader_url, cookie, argv["booktab-isbn"]);
	} else {
		console.log("Kitaboo book detected");
		await downloadKitabooBook(new URL(location));
	}
}

main();
