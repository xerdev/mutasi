const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const app = express();
const port = 3000;

// Multer configuration for file uploads
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });

app.use(express.static('public')); // Serve static files (HTML, CSS, JS)

app.post('/upscale', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No image uploaded.');
        }

        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');
        const dataUri = `data:${req.file.mimetype;base64,${base64Image}`;

        // Puppeteer Code here
        const browser = await puppeteer.launch({ headless: 'new' }); // Launch in headless mode
        const page = await browser.newPage();
        await page.goto('https://www.iloveimg.com/upscale-image');

        // Create the image on the browser
        await page.evaluate((dataUri) => {
          const input = document.querySelector('input[type="file"]');
          const dataTransfer = new DataTransfer();
          const blob = new Blob([dataUri], {
            type: 'image/jpeg', // Update this with the actual mime type
          });
          const file = new File([blob], 'image.jpg', {
            type: 'image/jpeg',
          });

          dataTransfer.items.add(file);
          input.files = dataTransfer.files;

          console.log('test the javascript');
        }, dataUri);

        await page.waitForSelector('#result-container a.download-button', { timeout: 60000 });

        // Extract the download link
        const downloadLink = await page.$eval('#result-container a.download-button', el => el.href);

        console.log('Download Link:', downloadLink);

        await browser.close();

        res.send({ downloadLink: downloadLink }); // Send the download link back to the client

    } catch (error) {
        console.error('Upscaling failed:', error);
        res.status(500).send('Upscaling failed.');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
