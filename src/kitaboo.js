import fs from "fs";
import path from "path";
import { finished } from "stream/promises";
import { parseStringPromise as parseString } from "xml2js";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import ZipStream from "zip-stream";
import { getBuffer, getJson, getText, requestOk, retry, parseSetCookie, READER_ORIGIN } from "./http.js";
import { decryptFile, decryptEncryptionKey } from "./crypto.js";

PDFDocument.prototype.addSVG = function (svg, x, y, options) {
	return SVGtoPDF(this, svg, x, y, options), this;
};

const READER = "https://webreader.zanichelli.it";
const MICROSERVICES = "https://microservices.kitaboo.eu/v1/zanichelli";
const DISTRIBUTION = "https://zanichelliservices.kitaboo.eu/DistributionServices/services/api/reader/distribution";

const PAGE_FORMATS = [
	{ suffix: "svgz", type: "svg" },
	{ suffix: "png", type: "image" },
	{ suffix: "jpg", type: "image" },
];

export async function downloadKitabooBook(bookReaderUrl) {
	const readerUrl = new URL(bookReaderUrl.hash.substring(1), READER);
	const bookID = readerUrl.searchParams.get("bookID");

	console.log("Exchangin usertoken...");

	const { userToken: usertoken } = await getJson(
		`${MICROSERVICES}/user/123/pc/validateUserToken?usertoken=${encodeURIComponent(
			readerUrl.searchParams.get("usertoken")
		)}`
	);

	if (!usertoken) throw new Error("The reader didn't accept the usertoken, try running the script again");

	console.log("Fetching book details...");

	const bookDetails = await getJson(`${DISTRIBUTION}/123/pc/book/details?bookID=${bookID}`, { headers: { usertoken } });
	const book = bookDetails.bookList[0].book;

	console.log("Requesting access...");

	const downloadBookRequest = await requestOk(
		`${READER}/downloadapi/auth/contentserver/book/123234234/HTML5/${bookID}/downloadBook?state=online`,
		{ headers: { Referer: READER_ORIGIN, usertoken } }
	);

	const downloadBook = await downloadBookRequest.json();

	const reader = {
		ebookID: book.ebookID,
		cookie: parseSetCookie(downloadBookRequest).join("; "),
		// note how jwt = json web token, so what you are saying is json web token token... gg
		jwtToken: downloadBook.jwtToken,
		privateKey: downloadBook.privateKey,
	};

	if (book.assetType == "BOOK") {
		await downloadFixedBook(reader);
	} else if (book.assetType == "EPUB") {
		await downloadLiquidBook(book, reader);
	} else {
		console.log(`Unknown book type (${book.assetType}), please open an issue on github`);
	}
}

function readerHeaders(reader, extraHeaders) {
	return { Referer: READER_ORIGIN, cookie: reader.cookie, ...extraHeaders };
}

async function downloadFixedBook(reader) {
	console.log("Detected standard book, downloading as PDF");

	const opsUrl = (file) => `${READER}/${reader.ebookID}/html5/${reader.ebookID}/OPS/${file}`;

	console.log("Fetching encrypted encryption key...");

	const encryptedEncryptionKey = await getText(opsUrl("enc_resource.key"), {
		headers: readerHeaders(reader, { authorization: reader.jwtToken }),
	});

	console.log("Processing...");

	console.log("Decrypting encryption key...");

	const encryptionKey = decryptEncryptionKey(reader.privateKey, encryptedEncryptionKey);

	console.log("Fetching book content...");

	const content = await parseString(await getText(opsUrl("content.opf"), { headers: readerHeaders(reader) }));

	// mention in content.metadata of render type, could be usefull in the future if other formats get added

	if (content.Error) throw new Error([...content.Error.Code, ...content.Error.Message].join(" "));

	const title = content.package.metadata[0]["dc:title"][0];

	const items = {};

	for (const item of content.package.manifest[0].item) {
		if (["image/svg+xml", "image/png", "image/jpeg"].includes(item.$["media-type"])) items[item.$.id] = item.$.href;
	}

	const doc = new PDFDocument();
	const output = fs.createWriteStream(title.replace(/[^a-z0-9]/gi, "_") + ".pdf");
	doc.pipe(output);

	const spine = content.package.spine[0].itemref;

	for (const [i, itemref] of spine.entries()) {
		const idref = itemref.$.idref;
		console.log(`Downloading ${idref}`);

		const format = PAGE_FORMATS.find(({ suffix }) => items[`images${idref}${suffix}`] !== undefined);

		if (format) {
			const href = items[`images${idref}${format.suffix}`];
			const page = await retry(`Download of ${idref}`, async () =>
				decryptFile(encryptionKey, await getText(opsUrl(href), { headers: readerHeaders(reader) }))
			);

			if (format.type == "svg") {
				doc.addSVG(page.toString("utf8"), 0, 0, { preserveAspectRatio: "xMinYMin meet" });
			} else {
				doc.image(page, 0, 0, { fit: [doc.page.width, doc.page.height], align: "center", valign: "center" });
			}
		} else {
			console.log(`Unable to find suitable format for ${idref}`);
		}

		if (i < spine.length - 1) doc.addPage();
	}

	doc.end();
	await finished(output);

	console.log("Done! You'll find the PDF in the directory of the script");
}

async function downloadLiquidBook(book, reader) {
	console.log("Detected liquid book, downloading as EPUB");

	const archive = new ZipStream({ store: true });
	const output = fs.createWriteStream(book.title.trim().replace(/[^a-z0-9]/gi, "_") + ".epub");
	archive.pipe(output);

	const saveFile = (fileName, content) =>
		new Promise((resolve, reject) => {
			archive.entry(content, { name: fileName }, (err, res) => {
				if (err) reject(err);
				else resolve(res);
			});
		});

	const rootUrl = `${READER}/${reader.ebookID}/fixed_epub_image/${reader.ebookID}/`;

	console.log("Fetching container file");

	const containerFile = await getText(rootUrl + "META-INF/container.xml", { headers: readerHeaders(reader) });
	const parsedContainerFile = await parseString(containerFile);
	const rootFileUrl = parsedContainerFile.container.rootfiles[0].rootfile[0].$["full-path"];

	await saveFile("META-INF/container.xml", containerFile);

	console.log("Fetching root file");

	const rootFile = await getText(rootUrl + rootFileUrl, { headers: readerHeaders(reader) });
	const parsedRootFile = await parseString(rootFile);

	await saveFile(rootFileUrl, rootFile);

	const prefix = path.dirname(rootFileUrl) + "/";
	const entries = parsedRootFile.package.manifest[0].item;

	for (const [i, fileEntry] of entries.entries()) {
		console.log(`Fetching content ${i + 1}/${entries.length}`);

		const href = fileEntry.$["href"];
		const file = await retry(`Download of ${href}`, () =>
			getBuffer(rootUrl + prefix + href, { headers: readerHeaders(reader) })
		);

		await saveFile(prefix + href, file);
	}

	console.log("Finalising");

	archive.finalize();
	await finished(output);

	console.log("Done! You'll find the EPUB in the directory of the script");
}
