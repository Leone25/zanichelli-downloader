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
  let url = process.argv[2];

  while (!url)
    url = prompt("Input the url: ");
  

  console.log("Processing...");

  let redirectUrl = await fetch(url, {redirect: "manual"}).then((res)=>{
    if (res.status == 302) return new URL(res.headers.get("location").replace('#', ''));
    console.log("Error: bad url - " + res.status);
    process.exit(1);
  }).catch((err) => {
    console.log("Error: ", err);
    process.exit(1);
  });

  let bookId = redirectUrl.searchParams.get("bookID");
  let usertoken = redirectUrl.searchParams.get("usertoken");

  if (!bookId || !usertoken) {
    console.log("Error: Invalid url");
    process.exit(1);
  }

  let clientID = await fetch('https://webreader.zanichelli.it/reader/replica_5.0/zanichelli_reader/config.js').then(res=>res.text()).then(res=>{
    return Function('"use strict";' + res + ';return CONFIG.ClientId')();
  }).catch((err) => {
    console.log("Error: ", err);
    process.exit(1);
  });

  let newUserToken = await fetch(`https://zanichelliservices.kitaboo.eu/DistributionServices/services/api/reader/user/123/pc/validateUserToken?usertoken=${usertoken}&clientID=${clientID}`).then(res => res.json()).then(res => res.userToken).catch((err) => {
    console.log("Error: ", err);
    process.exit(1);
  });

  let details = await fetch(`https://zanichelliservices.kitaboo.eu/DistributionServices/services/api/reader/distribution/123/pc/book/details?bookID=${bookId}`, {headers:{usertoken: newUserToken}}).then((res) => res.json()).catch((err) => {
    console.log("Error: ", err);
    process.exit(1);
  });

  let {title, ebookID} = details.bookList[0].book;

  let authorization = await fetch(`https://webreader.zanichelli.it/ContentServer/mvc/authenticatesp?packageId=${ebookID}&ut=${newUserToken}&ds=y`).then(async (res) => {
    return res.headers.get("authorization"); // possible to get other cookies that might be needed
  }).catch((err) => {
    console.log("Error: ", err);
    process.exit(1);
  });

  let cookies = await fetch(`https://webreader.zanichelli.it/ContentServer/mvc/getSessionForBook?bookId=${ebookID}`, {headers:{authorization}}).then((res) => {
    return res.headers.raw()['set-cookie'].map(c=>c.split(';')[0]).join(';');
    //return res.headers.get("set-cookie");
  }).catch((err) => {
    console.log("Error: ", err);
    process.exit(1);
  });

  let content = await fetch(`https://webreader.zanichelli.it/ContentServer/mvc/s3view/${ebookID}/html5/${ebookID}/OPS/content.opf`, {headers:{cookie: cookies}}).then((res) => res.text()).then(parseString).catch((err) => {
    console.log("Error: ", err);
    process.exit(1);
  });

  // mention in content.metadata of render type, could be usefull in the future if other formats get added

  let items = {};

  for (let item of content.package.manifest[0].item) {
    if (item.$['media-type'] == 'image/svg+xml') items[item.$.id] = item.$.href;
  }

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(title.replace(':', '') + '.pdf'));

  for (let [i ,itemref] of content.package.spine[0].itemref.entries()) {
    console.log(`Downloading ${itemref.$.idref}`);
    let svg = null;
    while (!svg) {
      const abortController = new AbortController();
      const promise = fetch(
        `https://webreader.zanichelli.it/ContentServer/mvc/s3view/${ebookID}/html5/${ebookID}/OPS/${items[`images${itemref.$.idref}svgz`]}`,
        {headers:{cookie: cookies}, controller: abortController.signal}
      ).then((res) => {
        return res.text();
      });
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      svg = await promise;
      clearTimeout(timeoutId);
    }
    doc.addSVG(svg, 0, 0, { preserveAspectRatio: "xMinYMin meet" });
    if (i < content.package.spine[0].itemref.length-1) doc.addPage();
  }

  doc.end();
  console.log("Done! You'll find the PDF in the directory of the script");
})();
