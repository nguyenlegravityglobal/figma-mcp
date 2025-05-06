import express from 'express';
import { fetchFigmaDesign } from './index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use('/figma-downloader', express.static(path.join(__dirname, 'figma-downloader')));

// Function to clear the figma-downloader directory
function clearDownloadDirectory() {
    const downloadDir = path.join(__dirname, 'figma-downloader');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir);
        return;
    }
    
    // Clear all files in the directory
    const files = fs.readdirSync(downloadDir);
    for (const file of files) {
        fs.unlinkSync(path.join(downloadDir, file));
    }
}

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle Figma design requests
app.post('/figmaDesign', async (req, res) => {
    try {
        const { desktopUrl, mobileUrl } = req.body;
        if (!desktopUrl || !mobileUrl) {
            return res.status(400).json({ error: 'Both desktop and mobile URLs are required' });
        }

        // Clear the download directory before processing new files
        clearDownloadDirectory();

        // Process desktop design
        const desktopResult = await fetchFigmaDesign(desktopUrl, true, "desktop");
        
        // Process mobile design
        const mobileResult = await fetchFigmaDesign(mobileUrl, true, "mobile");

        res.json({
            desktop: {
                design: desktopResult.design,
                image: desktopResult.image
            },
            mobile: {
                design: mobileResult.design,
                image: mobileResult.image
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download the entire figma-downloader directory
app.get('/download-figma-files', (req, res) => {
    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    res.attachment('figma-files.zip');
    archive.pipe(res);

    const downloadDir = path.join(__dirname, 'figma-downloader');
    archive.directory(downloadDir, false);

    archive.finalize();
});

// Start the server
const PORT = 3457;
app.listen(PORT, () => {
    console.log(`Web server is running on port ${PORT}`);
}); 