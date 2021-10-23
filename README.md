# kitaboo-downloader

A tool to download your books from zanichelli into PDFs.

**THIS DOES NOT WORK WITH BOOKS FROM BOOKTAB, FOR THAT PLEASE CHECK https://github.com/Leone25/booktab-downloader**

## How to use

1. Download this repo, unzip the download, open a terminal, navigate to the extracted files and type:

```shell
npm i
```

**_(Optional step, required on Linux or mac)_** This script to work requires to have inkscape(1.0 or more) installed on your machine, if you don't have inkscape installed please do it now, and if you have not installed inkscape in the defaul folder please edit the script where it says `inkscapePath` to be the path of the `inkscape.exe`(usually found in the bin folder).

2. Run the script with node

```shell
node .
```

**_It is recommended to use Firefox as browser, because Chromium often doesn't work_**

3. Open your book in the web browser and open the inspect tools (F12 or CTRL + SHIFT + I), and go to the "network" tab and enable the `XHR` filter and make sure that `disable cache` is enabled
4. With the aid of the index in the bottom right corner go to the last page of the book
5. Look for the request with the pattern `page****.svgz` with the highest number, open it
6. From there copy the url of the file. It should look like something like this: `https://webreader.zanichelli.it/ContentServer/mvc/s3view/******/html5/******/OPS/images/page****.****` and paste it into the terminal and press enter
7. Scroll down in the request information and enable the raw checkbox on the right
8. Where it says `cookie` copy and paste everything in the terminal (yes the crazzy repeating text is normal :L) and press enter
9. The programm will ask for a file name, provide one without any special characters nor the file extention
10. Processing will start and the pages will be downloaded one by one and converted to pdf. Make sure to keep the tab where you have the book open active to prevent it from auto logging out, which would stop the downloading process. This process can take up to an hour for a 1k pages book depending on the speed of your machine.
11. Wait for the file to be saved and you are done!

## Disclaimer

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

I may or may not update this script depending on my needs, but I'm open to pull requests ecc.

## License

This software uses the MIT License
