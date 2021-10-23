# kitaboo-downloader

A tool to download your books from Zanichelli into PDFs.

**THIS DOES NOT WORK WITH BOOKS FROM BOOKTAB, FOR THAT PLEASE CHECK https://github.com/Leone25/booktab-downloader**

## Requirements

- [Node](https://nodejs.org/it/) >= 14.0
- Windows 10 or higher (The script hasn't been tested on other platforms, but it may work.)
- Firefox _(Chromium-based browser won't work: Chrome, Brave, MS Edge, Opera)_

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

2. Open your book in the web browser and open the inspect tools (`F12` or `CTRL + SHIFT + I`), and go to the `network` tab and enable the `XHR` filter and make sure that `disable cache` is enabled  
   **You mustn't close the browser until the script have finished**
3. With the aid of the index go to the last page of the book
4. Look for the request with the pattern `page****.svgz` (where `****` are numbers) and click on the one which has the **highest number**.
5. A menu will be opened, make sure `header` tab is selected and copy the url of the file.  
   It should look like something like this: `https://webreader.zanichelli.it/ContentServer/mvc/s3view/******/html5/******/OPS/images/page****.****`  
   Paste it into the terminal and press enter
6. Scroll down in the request information and enable the `raw` checkbox on the right
7. Where it says `cookie` copy **the whole value** and paste it in the terminal (yes the crazzy repeating text is normal :L) and press enter
8. The programm will ask for a file name, provide one without any special characters nor the file extention
9. Processing will start and the pages will be downloaded one by one and converted to a unique pdf.  
   This process can take a lot of time for large books depending on the speed of your machine and your network.
10. Wait for the file to be saved and you are done!

## Disclaimer

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

I may or may not update this script depending on my needs, but I'm open to pull requests ecc.

## License

This software uses the MIT License
