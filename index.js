import PromptSync from "prompt-sync";
import fetch from "node-fetch";
import { parseStringPromise as parseString } from "xml2js";
import SVGtoPDF from "svg-to-pdfkit";
import PDFDocument from "pdfkit";
import PDFMerger from "pdf-merger-js";
import fs from "fs";
import path from "path";
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
	.option("booktab-isbn", {
		alias: "b",
		type: "string",
		description: "Overwrite the booktab ISBN (which is different from the normal ISBN)",
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

async function downloadKitabooBook(bookReaderUrl) {
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
}

async function downloadBookTabBook(redirectUrl, cookie) { // bookReaderUrl, 
	//let idOpera = bookReaderUrl.searchParams.get('idOpera');
	let isbn = redirectUrl.split('/');
	isbn = argv["booktab-isbn"] || isbn[isbn.length - 1];

	console.log("Accessing booktab...");

	let bookTabSession = await fetch('https://web-booktab.zanichelli.it/api/v1/sessions_web', {
		method: 'POST',
		headers: { cookie },
	}).then((res) => res.json()).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	cookie += `; booktab_token=${bookTabSession.session}`;

	/*console.log("Fetching available books...");

	let bookTabBooks = await fetch('https://web-booktab.zanichelli.it/api/v5/metadata', {
		headers: { cookie },
	}).then((res) => res.json()).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	let candidates = bookTabBooks.books.filter((book) => book.idBookZ == idOpera);

	console.log("Available books:"); // why is there a second list of books? I don't know, no idea, it just goes to show how shitty zanichelli's software is
	console.table(candidates, ['title', 'idBookZ', 'isbn']);*/ // probably no longer needed


	while (!isbn)
		isbn = prompt("ISBN: ");

	console.log("Fetching book details...");

	let spine = await fetch(`https://web-booktab.zanichelli.it/api/v1/resources_web/${isbn}/spine.xml`, {
		headers: { cookie },
	}).then(async (res) => {
		if (res.status == 404) {
			return fetch(`https://web-booktab.zanichelli.it/api/v1/resources_web/${isbn}/volume.xml`, {
				headers: { cookie },
			}).then((res) => {
				if (res.status == 404) {
					console.log('Looks like this is not a downloadable book, try another one.');
					process.exit(1);
				}
				return res.text()
			});
		}
		return res.text();
	}).then(parseString).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	const title = (spine.spine || spine.config.volume[0].settings[0]).volumetitle[0].trim().replace(/[^a-z0-9]/gi, '_');

	console.log("Downloading book...");

	const units = (spine.spine ? spine.spine.unit : spine.config.volume[0].units[0].unit).map((unit) => {
		if (unit.$.features == 'flash') return null;
		return unit.$.btbid;
	}).filter((unit) => unit != null);

	let pdfMerger = new PDFMerger();

	let isXps = false;

	for(let i = 0; i < units.length; i++) {
		console.log(`Downloading unit ${i + 1} of ${units.length}`)
		const unit = units[i];
		let config = await fetch(`https://web-booktab.zanichelli.it/api/v1/resources_web/${isbn}/${unit}/config.xml`, {
			headers: { cookie },
		}).catch((err) => {
			console.log("Error: ", err);
			process.exit(1);
		});

		if (config.status != 200) continue;

		config = await config.text().then(parseString);

		let pdfUrl = config.unit.content[0];

		if (config.unit.filesMap) {
			pdfUrl = config.unit.filesMap[0].entry.find((file) => file.$.key == config.unit.content[0] + '.pdf')._;
		}

		if (isXps) {
			let xps = await fetch(`https://web-booktab.zanichelli.it/api/v1/resources_web/${isbn}/${unit}/${config.unit.content[0]}.xod`, {
				headers: { cookie },
			}).then((res) => res.buffer()).catch((err) => {
				console.log("Error: ", err);
				process.exit(1);
			});

			await fs.promises.writeFile(path.join("xps_" + title, `${i}_${unit}.xps`), xps);
			continue;
		}

		let pdf = await fetch(`https://web-booktab.zanichelli.it/api/v1/resources_web/${isbn}/${unit}/${pdfUrl}.pdf`, {
			headers: { cookie },
		}).catch((err) => {
			console.log("Error: ", err);
			process.exit(1);
		});

		if (pdf.status == 404) {
			isXps = true;
			i--;
			console.log("DETECTED XPS FORMAT, DOWNLOADING INDIVIDUAL UNITS...");
			await fs.promises.mkdir("xps_" + title, { recursive: true }); // adding prefix to gitignore
			continue;
		}

		pdf = await pdf.buffer();
		await pdfMerger.add(pdf);
	}

	if (isXps) {
		console.log("Done! You'll find the XPS files in the directory of the script");
		console.log("Instructions:");
		console.log("1. A folder with the name of the book will be created, containing all the units in XPS format");
		console.log("2. Navigate to https://xpstopdf.com/ and convert the XPS files to PDF format");
		console.log("3. Merge the PDF files using https://www.ilovepdf.com/merge_pdf");
		console.log("If anyone would like to contribute a script to automate this process, feel free to do so");
	} else {
		console.log("Saving...");
		await pdfMerger.save(title + '.pdf');
		console.log("Done! You'll find the PDF in the directory of the script");
	}
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
				isbns: license.volume.isbns,
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
				isbns: license.volume.isbns
			}
		}
	}

	console.log("Available books:");
	console.table(books, ['title']);

	let isbn = argv.isbn;

	while (!isbn)
		isbn = prompt("ISBN: ");
	
	console.log("Detecting reader...");

	let bookReaderUrl = await fetch(books[isbn].ereader_url, {
		headers: { cookie },
		redirect: 'manual',
	}).then((res) => res.headers.get('location')).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	bookReaderUrl = new URL(bookReaderUrl);

	if (bookReaderUrl.host == 'web-booktab.zanichelli.it') {
		console.log("BookTab book detected");
		await downloadBookTabBook(books[isbn].ereader_url, cookie);
	} else {
		console.log("Kitaboo book detected");
		await downloadKitabooBook(bookReaderUrl);
	}
})();
