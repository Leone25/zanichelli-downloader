# kitaboo-downloader
A tool to download your books from zanichelli into PDFs.

**THIS DOES NOT WORK WITH BOOKS FROM BOOKTAB, FOR THAT PLEASE CHECK https://github.com/Leone25/booktab-downloader**

## How to use

1. Download this repo, unzip the download, open a terminal, navigate to the extracted files and type:
```shell
npm i
```
***(Optional step)*** This script to work requires to have inkscape(1.0 or more) installed on your machine, if you have not installed inkscape in the defaul folder please edit the script where it says `inkscapePath` to be the path of the `inkscape.exe`(usually found in the bin folder).
2. Run the script with node
```shell
node index.js
```
3. Open you book in the web browser and open the inspect tools (F12 or CTRL + SHIFT + I), and open the "network" tab and enable the `fetch/XHR` filter
4. With the aid of the index go to the last page of the book
5. Look for the request with the pattern `page****.svgz` with the highest number, open it
6. From there copy the beginning of the url of the file, leaving behind everything after the slash. It should look like something like this: `https://webreader.zanichelli.it/ContentServer/mvc/s3view/******/html5/******/OPS/images/` and paste it into the terminal and press enter
7. Type `.svgz` and press enter
8. Input the highest number of the pages you have seen and press enter
9. Scroll down in the request information and where it says `cookie` copy and paste everything in the terminal and press enter
10. Processing will start and the pages will be downloaded one by one and converted to pdf. Make sure to keep the tab where you have the book open active to prevent it from auto logging out, which would stop the downloading process. This process can take up to an hour for a 1k pages book depending on the speed of your machine.
11. Once done the programm will ask for a file name, provide one without any speciall characters nor the file extention
12. Wait for the file to be saved and you are done!
13. I suggest to clear the `temp` folder after you are done as it contains a lot of data that you no longer need

## Disclaimer

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

I may or may not update this script depending on my needs, but I'm open to pull requests ecc.

## License

This software uses the MIT License
