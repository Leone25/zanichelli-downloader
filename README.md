# kitaboo-downloader

A tool to download your books from Zanichelli into PDFs.

# **THIS ONLY WORKS WITH BOOKS THAT HAVE THE RED `LaZ Ebook` LABEL NEXT TO THE "READ BOOK ONLINE" BUTTON, THE BOOKS THAT DON'T HAVE IT ARE BOOKTAB BOOKS, FOR THOSE PLEASE CHECK https://github.com/Leone25/booktab-downloader**

## Requirements

- [Node](https://nodejs.org/it/) >= 14.0
- Windows 10 or higher (The script hasn't been tested on other platforms, but it may work, you will likely have issues on mac os)
- A chromium based browser, do **NOT** use Firefox, it will not work

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

1. Open the folder of the script in a terminal (same way as installation) and run the script with node typing:

   ```shell
   node .
   ```
2. In your browser, open https://my.zanichelli.it in your browser and open the menu of the book you'd like to download and open the web reader
3. Open the dev tools (`f12` works), navigate to the network page in the dev tools and make sure that caching is disabled and that permanent log is enabled, then refresh the page
4. Find the `content.opf` (there is a filter bar on the top that you can use to search) file in the network tab and click on it
5. From the url, copy the number that is repeated twice and paste it in the terminal and press enter
6. Scroll down in the request information, and find where it says `Cookie`, copy the value and paste it in the terminal and press enter (it is normal that it gets pasted multiple times, don't worry about it, it's entered correctly)
7. Find the file `downloadBook` (if there are two, choose the one that has `HTML5` in it's path) and click on it, and in the sub menu, open the `Preview` tab
8. Find the line that says `privateKey` and copy the value (Right click on text > `Copy value`) and paste it in the terminal and press enter
9. Find the file `enc_resource.key` and click on it, then click on the `Preview` tab
10. Select everything, copy it and paste it in the terminal and press enter
11. Wait, the book will be downloaded and saved to the script' directory

NOTE: You will have to do again all the steps if you want to download another book, the encryption key is different for every book and every time you open the book

## Disclaimer

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

I may or may not update this script depending on my needs, but I'm open to pull requests ecc.

## License

This software uses the MIT License
