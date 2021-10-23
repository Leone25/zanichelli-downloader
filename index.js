const prompt = require("prompt-sync")({ sigint: true });
const fetch = require("node-fetch");
const SVGtoPDF = require("svg-to-pdfkit");
const PDFDocument = require("pdfkit");
const fs = require("fs");

PDFDocument.prototype.addSVG = function (svg, x, y, options) {
  return SVGtoPDF(this, svg, x, y, options), this;
};

(async () => {
  const date = new Date().toISOString().replace(/:/g, "-").split(".")[0];
  let url, cookie;

  do url = prompt("Input the url: ");
  while (!url);

  url = url.split("page");
  const urlStart = url[0] + "page";
  const numberOfPages = parseInt(url[1].split(".")[0]);
  const urlEnd = "." + url[1].split(".")[1];
  console.log(urlStart, numberOfPages, urlEnd);

  do cookie = prompt("Input cookies header: ");
  while (!cookie);
  cookie = cookie.slice(cookie.indexOf("kitaboo")); // remove everything before cookie value

  const fileName = (prompt("Input pdf file name: ") || date) + ".pdf";

  console.log("Processing...");

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(fileName));

  for (i = 1; i < numberOfPages + 1; i++) {
    console.log(`Downloading ${i}/${numberOfPages}`);
    const svg = await fetch(urlStart + `0000${i}`.slice(-4) + urlEnd, {
      headers: { cookie },
    }).then((res) => res.text());
    doc.addSVG(svg, 0, 0, { preserveAspectRatio: "xMinYMin meet" });
    doc.addPage();
  }

  doc.end();
  console.log("Done! You'll find the PDF in the directory of the script");
})();
