import PromptSync from "prompt-sync";
import fetch from "node-fetch";
import { parseStringPromise as parseString } from "xml2js";
import SVGtoPDF from "svg-to-pdfkit";
import PDFDocument from "pdfkit";
import fs from "fs";
import aesjs from "aes-js";

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
	let ebookID = process.argv[2];
	let token = process.argv[3];
	let encryptionKey = process.argv[4];


	while (!encryptionKey)
		encryptionKey = prompt("Encryption key: ");

	while (!ebookID)
		ebookID = prompt("ebookID: ");
		
	while (!token)
		token = prompt("Cookie: ");


	console.log("Processing...");

	let content = await fetch(`https://webreader.zanichelli.it/${ebookID}/html5/${ebookID}/OPS/content.opf`, { headers: { cookie: token } }).then((res) => res.text()).then(parseString).catch((err) => {
		console.log("Error: ", err);
		process.exit(1);
	});

	// mention in content.metadata of render type, could be usefull in the future if other formats get added

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
					{ headers: { cookie: token }, controller: abortController.signal }
				).then(async (res) => {
					if (res.headers.get('X-Amz-Server-Side-Encryption') === 'AES256')
						return decryptFile(encryptionKey, await res.text());
					return res.arrayBuffer();
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
					{ headers: { cookie: token }, controller: abortController.signal }
				).then(async (res) => {
					if (res.headers.get('X-Amz-Server-Side-Encryption') === 'AES256')
						return decryptFile(encryptionKey, await res.text());
					return res.arrayBuffer();
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
					{ headers: { cookie: token }, controller: abortController.signal }
				).then(async (res) => {
					if (res.headers.get('X-Amz-Server-Side-Encryption') === 'AES256')
						return decryptFile(encryptionKey, await res.body());
					return res.arrayBuffer();
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
