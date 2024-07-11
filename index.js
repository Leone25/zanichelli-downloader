import PromptSync from "prompt-sync";
import fetch from "node-fetch";
import { parseStringPromise as parseString } from "xml2js";
import SVGtoPDF from "svg-to-pdfkit";
import PDFDocument from "pdfkit";
import fs from "fs";
import aesjs from "aes-js";
import forge from "node-forge";
import yargs from "yargs";

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
	.help()
	.alias("help", "h")
	.argv;


const prompt = PromptSync({ sigint: true });

PDFDocument.prototype.addSVG = function (svg, x, y, options) {
	return SVGtoPDF(this, svg, x, y, options), this;
};

async function decryptFile(encryptionKey, encryptedData) {
	const aesCtr = new aesjs.ModeOfOperation.cbc(Buffer.from(encryptionKey, "utf8"), Buffer.from(encryptionKey, "utf8"));
	let decryptedBytes = aesCtr.decrypt(Buffer.from(encryptedData, "base64"));
	for(let i=16;i>0;i--){
		if (decryptedBytes.slice(decryptedBytes.length-i).every(e=>e==i)) {
			decryptedBytes = decryptedBytes.slice(0, decryptedBytes.length-i);
			break;
		}
	}
	const decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
	return decryptedText;
}

(async () => {
	let {username, password} = argv;

	while (!username)
		username = prompt("Username(email): ");

	while (!password)
		password = prompt("Password: ");

	console.log("Logging in...");

	let token = await fetch("https://idp.zanichelli.it/v4/login/", {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
	}).then((res) => res.json()).then((res) => res.token).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	let cookie = `token=${token}`;

	let loginCookies = await fetch("https://my.zanichelli.it/?loginMode=myZanichelli", {
		headers: { cookie },
	}).then((res) => res.headers.raw()['set-cookie'].map((cookie) => cookie.split(';')[0])).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	let dashboardCookies = {};

	for (let loginCookie of loginCookies) {
		let [key, value] = loginCookie.split('=');
		dashboardCookies[key] = value;
	}

	console.log("Fetching available books...");

	/*await fetch('https://api-catalogo.zanichelli.it/v3/dashboard/init', {
		headers: { 'myz-token': dashboardCookies['myz_token'] },
	}).then(res => res.text()).then(console.log).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});*/ // keeping this, perhaps it's needed in the future

	await fetch('https://api-catalogo.zanichelli.it/v3/dashboard/user', {
		headers: { 'myz-token': dashboardCookies['myz_token'] },
	}).then(res => res.json()).then((res) => {
		console.log(`Logged in as: ${res.firstName} ${res.lastName}`)
	}).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	}); // we don't really care about the response, but apparently it's required to access the book list

	let books = {};

	let page = 1;
	let notATeacher = false;

	while (true) {
		let response = await fetch(`https://api-catalogo.zanichelli.it/v3/dashboard/search?sort%5Bfield%5D=year_date&sort%5Bdirection%5D=desc&searchString&pageNumber=${page}&rows=100`, {
			headers: { 'myz-token': dashboardCookies['myz_token'] },
		}).catch((err) => {
			console.log("Error: ", err);
			process.exit(1);
		});
		if (response.status == 403) {
			notATeacher = true;
			break;
		}
		response = await response.json();
		if (response.data.pagination.pages == 0) {
			console.log("No books found");
			process.exit(0);
		}
		for (let license of response.data.licenses) {
			if (license.volume.ereader_url == '') continue;
			books[license.volume.isbn] = {
				title: license.volume.opera.title,
				ereader_url: license.volume.ereader_url,
			}
		}
		if (response.data.pagination.pages == page) break;
		page++;
	}

	if (notATeacher) {
		let request = await fetch('https://api-catalogo.zanichelli.it/v3/dashboard/licenses/real', {
			headers: { 'myz-token': dashboardCookies['myz_token'] },
		}).then((res) => res.json()).catch((err) => {
			console.log("Error: ", err);
			process.exit(1);
		});
		for (let license of request.realLicenses) {
			if (license.volume.ereader_url == '') continue;
			books[license.volume.isbn] = {
				title: license.volume.opera.title,
				ereader_url: license.volume.ereader_url,
			}
		}
	}

	console.log("Available books:");
	console.table(books, ['title']);

	let isbn = argv.isbn;

	while (!isbn)
		isbn = prompt("ISBN: ");
	
	console.log("Obtaining usertoken...");

	let bookReaderUrl = await fetch(books[isbn].ereader_url, {
		headers: { cookie },
		redirect: 'manual',
	}).then((res) => res.headers.get('location')).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	bookReaderUrl = new URL(bookReaderUrl);

	if (bookReaderUrl.host == 'web-booktab.zanichelli.it') {
		console.log("You are trying to download a Booktab book, please check out https://github.com/leone25/booktab-downloader");
		process.exit(2);
	}

	bookReaderUrl = new URL(bookReaderUrl.hash.substring(1), 'https://webreader.zanichelli.it');

	let bookID = bookReaderUrl.searchParams.get('bookID');
	let usertoken = bookReaderUrl.searchParams.get('usertoken');

	console.log("Exchangin usertoken...");

	usertoken = await fetch(`https://microservices.kitaboo.eu/v1/zanichelli/user/123/pc/validateUserToken?usertoken=${encodeURIComponent(usertoken)}`).then(res => res.json()).then(res => res.userToken).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});
	
	console.log("Fetching book details...");

	let bookDetails = await fetch(`https://zanichelliservices.kitaboo.eu/DistributionServices/services/api/reader/distribution/123/pc/book/details?bookID=${bookID}`, {
		headers: { usertoken },
	}).then((res) => res.json()).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	let ebookID = bookDetails.bookList[0].book.ebookID;

	console.log("Obtaining encryption encryption key..."); // yeah, that's not a typo

	let downloadBook = await fetch(`https://webreader.zanichelli.it/downloadapi/auth/contentserver/book/123234234/HTML5/${bookID}/downloadBook?state=online`, {
		headers: { usertoken },
	}).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	let readerCookies = downloadBook.headers.raw()['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ');

	downloadBook = await downloadBook.json();

	let rawPrivateKey = downloadBook.privateKey;
	let jwtToken = downloadBook.jwtToken; // note how jwt = json web token, so what you are saying is json web token token... gg

	console.log("Fetching encrypted encryption key...")

	let encryptedEncryptionKey = await fetch(`https://webreader.zanichelli.it/${ebookID}/html5/${ebookID}/OPS/enc_resource.key`, {
		headers: { authorization: jwtToken, cookie: readerCookies },
	}).then((res) => res.text()).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	console.log("Processing...");
	
	console.log("Decrypting encryption key...");

	let privateKey = "-----BEGIN RSA PRIVATE KEY-----\n";
	privateKey += rawPrivateKey.match(/.{1,64}/g).join('\n');
	privateKey += "\n-----END RSA PRIVATE KEY-----";

	let key = forge.pki.privateKeyFromPem(privateKey);
	let encryptionKey = key.decrypt(forge.util.decode64(encryptedEncryptionKey));

	console.log("Fetching book content...");

	let content = await fetch(`https://webreader.zanichelli.it/${ebookID}/html5/${ebookID}/OPS/content.opf`, { headers: { cookie: readerCookies } }).then((res) => res.text()).then(parseString).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	// mention in content.metadata of render type, could be usefull in the future if other formats get added

	if (content.Error) {
		console.log("Error: ", ...content.Error.Code, ...content.Error.Message);
		process.exit(1);
	}

	let title = content.package.metadata[0]["dc:title"][0];

	let items = {};

	for (let item of content.package.manifest[0].item) {
		if (['image/svg+xml', 'image/png', 'image/jpeg'].includes(item.$['media-type'])) items[item.$.id] = item.$.href;
	}

	const doc = new PDFDocument();
	doc.pipe(fs.createWriteStream(title.replace(/[^a-z0-9]/gi, '_') + '.pdf'));

	for (let [i, itemref] of content.package.spine[0].itemref.entries()) {
		console.log(`Downloading ${itemref.$.idref}`);
		if (items[`images${itemref.$.idref}svgz`] !== undefined) {
			let svg = null;
			while (!svg) {
				const abortController = new AbortController();
				const promise = fetch(
					`https://webreader.zanichelli.it/${ebookID}/html5/${ebookID}/OPS/${items[`images${itemref.$.idref}svgz`]}`,
					{ headers: { cookie: readerCookies }, controller: abortController.signal }
				).then(async (res) => {
					return decryptFile(encryptionKey, await res.text());
				});
				const timeoutId = setTimeout(() => abortController.abort(), 10000);
				svg = await promise;
				clearTimeout(timeoutId);
			}
			doc.addSVG(svg, 0, 0, { preserveAspectRatio: "xMinYMin meet" });
		} else if (items[`images${itemref.$.idref}png`] !== undefined) {
			let png = null;
			while (!png) {
				const abortController = new AbortController();
				const promise = fetch(
					`https://webreader.zanichelli.it/${ebookID}/html5/${ebookID}/OPS/${items[`images${itemref.$.idref}png`]}`,
					{ headers: { cookie: readerCookies }, controller: abortController.signal }
				).then(async (res) => {
					return decryptFile(encryptionKey, await res.text());
				});
				const timeoutId = setTimeout(() => abortController.abort(), 10000);
				png = await promise;
				clearTimeout(timeoutId);
			}
			doc.image(png, 0, 0, {fit: [doc.page.width, doc.page.height], align: 'center', valign: 'center'});
		} else if (items[`images${itemref.$.idref}jpg`] !== undefined) {
			let jpeg = null;
			while (!jpeg) {
				const abortController = new AbortController();
				const promise = fetch(
					`https://webreader.zanichelli.it/${ebookID}/html5/${ebookID}/OPS/${items[`images${itemref.$.idref}jpg`]}`,
					{ headers: { cookie: readerCookies }, controller: abortController.signal }
				).then(async (res) => {
					return decryptFile(encryptionKey, await res.body());
				});
				const timeoutId = setTimeout(() => abortController.abort(), 5000)
				jpeg = await promise;
				clearTimeout(timeoutId);
			}
			doc.image(jpeg, 0, 0, {fit: [doc.page.width, doc.page.height], align: 'center', valign: 'center'});
		} else {
			console.log(`Unable to find suitable format for ${itemref.$.idref}`);
		}
		if (i < content.package.spine[0].itemref.length - 1) doc.addPage();
	}

	doc.end();
	console.log("Done! You'll find the PDF in the directory of the script");
})();
