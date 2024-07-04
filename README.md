# kitaboo-downloader

A tool to download your books from Zanichelli into PDFs.

# **THIS ONLY WORKS WITH BOOKS THAT HAVE THE RED `LaZ Ebook` LABEL NEXT TO THE "READ BOOK ONLINE" BUTTON, THE BOOKS THAT DON'T HAVE IT ARE BOOKTAB BOOKS, FOR THOSE PLEASE CHECK https://github.com/Leone25/booktab-downloader**

## Requirements

- [Node](https://nodejs.org/it/) >= 14.0
- Windows 10 or higher (The script hasn't been tested on other platforms, but it may work, you will likely have issues on mac os)
- A modern browser (Chrome, Firefox, Edge, etc.)

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
2. Enter your zanichelli username(email) and password
3. Wait for the list of books to load
4. Enter the isbn of the book you want to download
5. Wait, the book will be downloaded and saved to the script' directory

NOTE: You will get logged out from your account while the script is running. Do NOT login in a browser at it will break the script while it's running.

## Disclaimer

Remember that you are responsible for what you are doing on the internet and even tho this script exists it might not be legal in your country to create personal backups of books.

I may or may not update this script depending on my needs, but I'm open to pull requests ecc.

## License

This software uses the MIT License
