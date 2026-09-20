import fs from "fs";
import path from "path";
import { parseStringPromise as parseString } from "xml2js";
import PDFMerger from "pdf-merger-js";
import { getJson, request } from "./http.js";
import { ask } from "./prompts.js";

const BOOKTAB = "https://web-booktab.zanichelli.it/api";

export async function downloadBookTabBook(redirectUrl, sessionCookie, isbnOverride) {
	const urlSegments = redirectUrl.split("/");
	let isbn = isbnOverride || urlSegments[urlSegments.length - 1];

	console.log("Accessing booktab...");

	const bookTabSession = await getJson(`${BOOKTAB}/v1/sessions_web`, {
		method: "POST",
		headers: { cookie: sessionCookie },
	});

	const cookie = `${sessionCookie}; booktab_token=${bookTabSession.session}`;

	while (!isbn) isbn = ask("ISBN: ");

	console.log("Fetching book details...");

	const spine = await fetchSpine(isbn, cookie);

	const title = (spine.spine || spine.config.volume[0].settings[0]).volumetitle[0].trim().replace(/[^a-z0-9]/gi, "_");

	console.log("Downloading book...");

	const units = (spine.spine ? spine.spine.unit : spine.config.volume[0].units[0].unit)
		.map((unit) => (unit.$.features == "flash" ? null : unit.$.btbid))
		.filter((unit) => unit != null);

	const pdfMerger = new PDFMerger();

	let isXps = false;

	for (let i = 0; i < units.length; i++) {
		console.log(`Downloading unit ${i + 1} of ${units.length}`);

		const unit = units[i];
		const configRequest = await request(`${BOOKTAB}/v1/resources_web/${isbn}/${unit}/config.xml`, {
			headers: { cookie },
		});

		if (configRequest.status != 200) continue;

		const config = await parseString(await configRequest.text());

		let pdfUrl = config.unit.content[0];

		if (config.unit.filesMap) {
			pdfUrl = config.unit.filesMap[0].entry.find((file) => file.$.key == config.unit.content[0] + ".pdf")._;
		}

		if (isXps) {
			const xpsRequest = await request(
				`${BOOKTAB}/v1/resources_web/${isbn}/${unit}/${config.unit.content[0]}.xod`,
				{ headers: { cookie } }
			);

			if (!xpsRequest.ok) throw new Error(`Unable to download unit ${i + 1} (status ${xpsRequest.status})`);

			await fs.promises.writeFile(path.join("xps_" + title, `${i}_${unit}.xps`), await xpsRequest.buffer());
			continue;
		}

		const pdfRequest = await request(`${BOOKTAB}/v1/resources_web/${isbn}/${unit}/${pdfUrl}.pdf`, {
			headers: { cookie },
		});

		if (pdfRequest.status == 404) {
			isXps = true;
			i = -1; // restart the loop
			console.log("DETECTED XPS FORMAT, DOWNLOADING INDIVIDUAL UNITS...");
			await fs.promises.mkdir("xps_" + title, { recursive: true }); // adding prefix to gitignore
			continue;
		}

		if (!pdfRequest.ok) throw new Error(`Unable to download unit ${i + 1} (status ${pdfRequest.status})`);

		await pdfMerger.add(await pdfRequest.buffer());
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
		await pdfMerger.save(title + ".pdf");
		console.log("Done! You'll find the PDF in the directory of the script");
	}
}

// older books have a volume.xml instead of a spine.xml
async function fetchSpine(isbn, cookie) {
	for (const fileName of ["spine.xml", "volume.xml"]) {
		const url = `${BOOKTAB}/v1/resources_web/${isbn}/${fileName}`;
		const res = await request(url, { headers: { cookie } });

		if (res.status == 404) continue;
		if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);

		return parseString(await res.text());
	}

	throw new Error("Looks like this is not a downloadable book, try another one.");
}
