const prompt = require('prompt-sync')({sigint: true});
const fetch = require('node-fetch');
const PDFDocument = require('pdf-lib').PDFDocument;
const fs = require('fs');
const { spawnSync } = require('child_process');

inkscapePath = 'D:\\programmi\\Inkscape\\bin\\inkscape.exe';

(async () => {
    if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');
    
    let urlStart = prompt('Input the start of the url: ');
    let urlEnd = prompt('Input end of url (usually ".svgz"): ');
    let numberOfPages = Number(prompt('Input the number of pages: '))+1;
    let cookie = prompt('Input cookies header: ');

    console.log(cookie);

    console.log('Processing...');

    const outputPdf = await PDFDocument.create();

    for (i = 1; i < numberOfPages; i++) {
        console.log(`Downloading ${i}/${numberOfPages-1}`);
        let svg = await fetch(urlStart+('0000'+i).slice(-4)+urlEnd, {headers: {cookie}}).then((res) => res.text());
        fs.writeFileSync('./temp/page'+('0000'+i).slice(-4)+".svg", svg);
        console.log(spawnSync(inkscapePath, [`--export-filename=page${('0000'+i).slice(-4)}.pdf`, 'page'+('0000'+i).slice(-4)+'.svg'], {cwd: __dirname+"/temp/"}).stderr.toString());
        const page = await PDFDocument.load(fs.readFileSync('./temp/page'+('0000'+i).slice(-4)+".pdf"));
        const [firstDonorPage] = await outputPdf.copyPages(page, [0]);
        outputPdf.addPage(firstDonorPage);
    }

    fs.writeFileSync(prompt("Input file name:") + ".pdf", await outputPdf.save(), (e)=>{});

})();