# kitaboo-downloader

A tool to download your books from Zanichelli into PDFs.

**THIS DOES NOT WORK WITH BOOKS FROM BOOKTAB, FOR THAT PLEASE CHECK https://github.com/Leone25/booktab-downloader**

## Requirements

- [Node](https://nodejs.org/it/) >= 14.0
- Windows 10 or higher (The script hasn't been tested on other platforms, but it may work.)
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

2. Open https://my.zanichelli.it and open the menu of the book you'd like to download
3. Right click on the "Read book" link and click "copy link"
4. Paste the link in the terminal and press enter
5. Wait, the book will be downloaded and saved to the script' directory

## Disclaimer

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

I may or may not update this script depending on my needs, but I'm open to pull requests ecc.

## License

This software uses the MIT License
