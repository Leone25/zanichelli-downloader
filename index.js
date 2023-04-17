const prompt = require("prompt-sync")({ sigint: true });
const fetch = require("node-fetch");
var parseString = require('xml2js').parseStringPromise;
const SVGtoPDF = require("svg-to-pdfkit");
const PDFDocument = require("pdfkit");
const fs = require("fs");

PDFDocument.prototype.addSVG = function (svg, x, y, options) {
	return SVGtoPDF(this, svg, x, y, options), this;
};

(async () => {
	let ebookID = process.argv[2];
	let token = process.argv[3];

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
		if (item.$['media-type'] == 'image/svg+xml') items[item.$.id] = item.$.href;
	}

	const doc = new PDFDocument();
	doc.pipe(fs.createWriteStream(title.replace(/[^a-z0-9]/gi, '_') + '.pdf'));

	for (let [i, itemref] of content.package.spine[0].itemref.entries()) {
		console.log(`Downloading ${itemref.$.idref}`);
		let svg = null;
		while (!svg) {
			const abortController = new AbortController();
			const promise = fetch(
				`https://webreader.zanichelli.it/${ebookID}/html5/${ebookID}/OPS/${items[`images${itemref.$.idref}svgz`]}`,
				{ headers: { cookie: token }, controller: abortController.signal }
			).then((res) => {
				return res.text();
			});
			const timeoutId = setTimeout(() => controller.abort(), 5000)
			svg = await promise;
			clearTimeout(timeoutId);
		}
		doc.addSVG(svg, 0, 0, { preserveAspectRatio: "xMinYMin meet" });
		if (i < content.package.spine[0].itemref.length - 1) doc.addPage();
	}

	doc.end();
	console.log("Done! You'll find the PDF in the directory of the script");
})();
