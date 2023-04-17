# kitaboo-downloader

A tool to download your books from Zanichelli into PDFs.

**THIS DOES NOT WORK WITH BOOKS FROM BOOKTAB, FOR THAT PLEASE CHECK https://github.com/Leone25/booktab-downloader**

## Requirements

- [Node](https://nodejs.org/it/) >= 14.0
- Windows 10 or higher (The script hasn't been tested on other platforms, but it may work, you will likely have issues on mac os)
- A modern browser (Chrome, Edge, Firefox ...)

## Installation

1. Download the source code from [here](https://github.com/Leone25/kitaboo-downloader/archive/refs/heads/main.zip) or click the above green button `Code` and click `Download Zip`
2. Extract the zip file in a new folder and open it
3. Open the folder in a terminal
   1. If you are on Windows 11, just right click and press `Open with Windows Terminal`
   2. If you are on Windows 10, hold `shift` on your keyboard and right click on a white space, then press `Open command window here`
4. Type in the terminal:
   ```shell
   npm i
   ```

## How to use

1. Open the folder in a terminal (as described above) and run the script with node typing:

   ```shell
   node .
   ```

2. Open https://my.zanichelli.it in your browser and open the menu of the book you'd like to download
3. Right click on the "Read book" link and click "copy link"
4. Open a new tab and open the dev tools (`f12` works), navigate to the network page in the dev tools and make sure that caching is disabled and that permanent log is enabled
5. Paste the link you have copied in the url bar of the new tab, press enter and wait for the reader to load
6. Back in the network page of the dev tools use the search box to look for a file called `content.opf` and click on it
7. It should now display the full url of the file and some other information
8. From the displayed url copy the `ebookID`, which is a number repeated 2 times in the url, and paste it in the terminal and press enter
9. Scroll down in the file information (back in the network page) and find where it says `Cookie:`, select everything after that (be aware, on firefox you'll need to toggle "Raw" to see the full header, as with long values they get shortened), copy and paste it in the terminal
10. Wait, the book will be downloaded and saved to the script' directory

## Disclaimer

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

I may or may not update this script depending on my needs, but I'm open to pull requests ecc.

## License

This software uses the MIT License
