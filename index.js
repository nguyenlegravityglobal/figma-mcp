import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { transformFigmaJson } from "./utils/transformFigmaJson.js";
import { findColorItems } from "./utils/findColorItems.js";
import { extractTypoItems } from "./utils/extract_figma_data.js";
import dotenv from "dotenv";
import { Buffer } from "buffer";
// Import playwright for browser automation
import { chromium } from "playwright";
// Import image comparison libraries
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import sharp from "sharp";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create figma-downloader directory if it doesn't exist
const downloadDir = path.join(__dirname, "figma-downloader");
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

console.log("FIGMA_API_KEY from env:", process.env.FIGMA_API_KEY);
// Read Figma token from environment variable
const figmaToken = process.env.FIGMA_API_KEY || "";
console.log("Figma API token loaded:", figmaToken ? "✅" : "❌");

// Create an MCP server
const server = new McpServer({
  name: "Gravity Global Figma",
  version: "1.0.0",
});

// Helper function to extract file ID and node ID from Figma URL
export function extractFigmaInfo(url) {
  console.log("Processing URL:", url);
  const result = { fileId: "", nodeId: "" };

  // Extract file ID from various Figma URL formats
  const fileMatchPatterns = [
    /figma\.com\/file\/([^\/\?]+)/, // Regular file URL
    /figma\.com\/design\/([^\/\?]+)/, // Design URL
  ];

  for (const pattern of fileMatchPatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      result.fileId = match[1];
      break;
    }
  }

  // If no match, assume it's already a file ID
  if (!result.fileId && url) {
    result.fileId = url;
  }

  // Extract node ID from URL query parameter
  const nodeMatch = url.match(/node-id=([^&]+)/);
  if (nodeMatch && nodeMatch[1]) {
    // URL-decode the node ID
    result.nodeId = decodeURIComponent(nodeMatch[1]);
  }

  console.log("Extracted Figma info:", result);
  return result;
}

export async function fetchFigmaDesign(
  figmaUrl,
  download = false,
  viewport = "desktop"
) {
  // Extract file ID and node ID from URL
  const { fileId, nodeId } = extractFigmaInfo(figmaUrl);

  if (!fileId) {
    throw new Error("Could not extract a valid Figma file ID from the URL.");
  }

  // Construct the API URL for design data
  const apiUrl = nodeId
    ? `https://api.figma.com/v1/files/${fileId}/nodes?ids=${nodeId}`
    : `https://api.figma.com/v1/files/${fileId}`;

  console.log(`Fetching Figma design from: ${apiUrl}`);

  // Fetch the design data from Figma
  const response = await fetch(apiUrl, {
    headers: {
      "X-Figma-Token": figmaToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.statusText}`);
  }

  const data = await response.json();
  const transformedData = transformFigmaJson(data);

  // Get the design image URL
  const imageApiUrl = nodeId
    ? `https://api.figma.com/v1/images/${fileId}?ids=${nodeId.replace(
        "-",
        ":"
      )}&format=png`
    : `https://api.figma.com/v1/images/${fileId}?format=png`;

  const imageResponse = await fetch(imageApiUrl, {
    headers: {
      "X-Figma-Token": figmaToken,
    },
  });

  if (!imageResponse.ok) {
    throw new Error(
      `Figma API error when fetching image: ${imageResponse.statusText}`
    );
  }

  const imageData = await imageResponse.json();
  const imageKey = nodeId ? nodeId.replace("-", ":") : fileId;
  const imageUrl = imageData.images[imageKey];

  if (download) {
    // Save JSON file
    const jsonPath = path.join(downloadDir, `${viewport}-design.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null));

    // Download and save image
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok)
        throw new Error("Failed to download image from Figma CDN");
      const arrayBuffer = await imgRes.arrayBuffer();
      const imagePath = path.join(downloadDir, `${viewport}-image.png`);
      fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
    }

    return {
      success: true,
      jsonPath,
      imagePath: imageUrl
        ? path.join(downloadDir, `${viewport}-image.png`)
        : null,
      image: imageUrl
        ? await fetch(imageUrl)
            .then((res) => res.arrayBuffer())
            .then((buffer) => Buffer.from(buffer).toString("base64"))
        : null,
      design: transformedData,
    };
  }

  // Download the image and convert to base64
  let base64Image = null;
  let mimeType = "image/png";
  if (imageUrl) {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Failed to download image from Figma CDN");
    const arrayBuffer = await imgRes.arrayBuffer();
    base64Image = Buffer.from(arrayBuffer).toString("base64");
  }

  return {
    design: transformedData,
    image: base64Image,
    mimeType,
  };
}

export async function compareHtmlWithDesign(htmlFilePath, designImagePath) {
  try {
    // Check if files exist
    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`HTML file not found: ${htmlFilePath}`);
    }
    if (!fs.existsSync(designImagePath)) {
      throw new Error(`Design image not found: ${designImagePath}`);
    }

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Set viewport size
    await page.setViewportSize({ width: 1440, height: 1080 });

    // Navigate to HTML file
    const htmlUrl = `file://${path.resolve(htmlFilePath)}`;
    await page.goto(htmlUrl);

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Take screenshot of the body section
    const bodyElement = await page.locator("body");
    const screenshotBuffer = await bodyElement.screenshot({
      type: "png",
      fullPage: true,
    });

    // Close browser
    await browser.close();

    // Convert screenshot to base64
    const screenshotBase64 = screenshotBuffer.toString("base64");

    // Read design image and convert to base64
    const designImageBuffer = fs.readFileSync(designImagePath);
    const designImageBase64 = designImageBuffer.toString("base64");

    // Get image dimensions for comparison
    const screenshotPath = path.join(downloadDir, "html-screenshot.png");
    fs.writeFileSync(screenshotPath, screenshotBuffer);

    return {
      success: true,
      htmlScreenshot: screenshotBase64,
      designImage: designImageBase64,
      screenshotPath,
      designImagePath,
      comparison: {
        message:
          "Screenshots captured successfully. Visual comparison can be done manually or with additional image processing tools.",
        htmlFile: htmlFilePath,
        designFile: designImagePath,
        screenshotFile: screenshotPath,
      },
    };
  } catch (error) {
    throw new Error(`Error comparing HTML with design: ${error.message}`);
  }
}

export async function compareHtmlWithDesignAdvanced(htmlFilePath, designImagePath, options = {}) {
  try {
    // Check if HTML file exists
    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`HTML file not found: ${htmlFilePath}`);
    }

    let designImageBuffer;
    let designMetadata;
    
    // Handle different design image sources
    if (!fs.existsSync(designImagePath)) {
      throw new Error(`Design image not found: ${designImagePath}`);
    }
    
    // Regular file path
    designImageBuffer = fs.readFileSync(designImagePath);
    designMetadata = await sharp(designImageBuffer).metadata();
    
    // Default options with viewport based on design image
    const defaultOptions = {
      viewport: { 
        width: designMetadata.width || 1440, 
        height: designMetadata.height || 1080 
      },
      selector: 'body', // CSS selector for the element to screenshot
      fullPage: true,
      waitForSelector: null, // Optional selector to wait for before screenshot
      delay: 1000 // Delay in ms before taking screenshot
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Override viewport if not explicitly provided in options
    if (!options.viewport) {
      config.viewport = {
        width: designMetadata.width || 1440,
        height: designMetadata.height || 1080
      };
    }

    // Launch browser
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set viewport size based on design image dimensions
    await page.setViewportSize(config.viewport);
    
    // Navigate to HTML file
    const htmlUrl = `file://${path.resolve(htmlFilePath)}`;
    await page.goto(htmlUrl);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for specific selector if provided
    if (config.waitForSelector) {
      await page.waitForSelector(config.waitForSelector);
    }
    
    // Add delay if specified
    if (config.delay > 0) {
      await page.waitForTimeout(config.delay);
    }
    
    // Take screenshot of the specified element
    const element = await page.locator(config.selector);
    const screenshotBuffer = await element.screenshot({ 
      type: 'png',
      fullPage: config.fullPage 
    });
    
    // Get page metrics for analysis
    const pageMetrics = await page.evaluate(() => {
      const body = document.body;
      const rect = body.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        scrollWidth: body.scrollWidth,
        scrollHeight: body.scrollHeight,
        title: document.title,
        url: window.location.href
      };
    });
    
    // Close browser
    await browser.close();
    
    // Convert screenshot to base64
    const screenshotBase64 = screenshotBuffer.toString('base64');
    
    // Convert design image to base64
    const designImageBase64 = designImageBuffer.toString('base64');
    
    // Save screenshot with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(downloadDir, `html-screenshot-${timestamp}.png`);
    fs.writeFileSync(screenshotPath, screenshotBuffer);
    
    // Basic image analysis
    const screenshotStats = fs.statSync(screenshotPath);
    const designStats = fs.statSync(designImagePath);
    
    // Perform actual image comparison with layout focus
    const imageComparison = await compareImages(screenshotPath, designImagePath, null, {
      layoutFocused: true,
      ignoreColors: true,
      threshold: 0.15 // Slightly higher threshold for layout comparison
    });
    
    return {
      success: true,
      htmlScreenshot: screenshotBase64,
      designImage: designImageBase64,
      screenshotPath,
      designImagePath,
      pageMetrics,
      imageComparison,
      designImageDimensions: {
        width: designMetadata.width,
        height: designMetadata.height,
        format: designMetadata.format
      },
      analysis: {
        screenshotSize: screenshotStats.size,
        designSize: designStats.size,
        viewport: config.viewport,
        selector: config.selector,
        timestamp: new Date().toISOString(),
        similarity: imageComparison.similarity,
        diffPixels: imageComparison.diffPixels,
        totalPixels: imageComparison.totalPixels
      },
      comparison: {
        message: `Advanced comparison completed. Viewport: ${config.viewport.width}x${config.viewport.height}px (based on design image). Similarity: ${imageComparison.similarity}% (${imageComparison.diffPixels} different pixels out of ${imageComparison.totalPixels})`,
        htmlFile: htmlFilePath,
        designFile: designImagePath,
        screenshotFile: screenshotPath,
        diffFile: imageComparison.diffImagePath,
        recommendations: [
          "🔍 SPACING: Verify all margins and padding between elements match design exactly",
          "📏 Check line-height, letter-spacing, and word-spacing for text elements", 
          "📐 Ensure gap properties in flexbox/grid layouts are accurate",
          "🔤 FONT FAMILY: Confirm font-family declarations are exactly as specified in design",
          "📝 Verify font-weight, font-style, and font-variant match design requirements",
          "🎯 Check web font loading and fallback fonts are properly configured",
          "📦 CONTAINER: Validate container width, max-width, and min-width settings",
          "🏗️ Ensure container padding, margin, and positioning are pixel-perfect",
          "📱 Verify responsive container behavior matches design breakpoints",
          "📐 CONTENT WIDTH: Check main content area width - often incorrectly sized",
          "🖼️ IMAGE SIZING: Verify all images have correct width, height, and object-fit properties",
          "📏 IMAGE ASPECT RATIO: Ensure images maintain correct aspect ratio from design",
          "🎯 CONTENT MAX-WIDTH: Validate content wrapper max-width matches design specifications",
          "📦 IMAGE CONTAINER: Check image container dimensions and overflow settings",
          `Viewport automatically set to ${config.viewport.width}x${config.viewport.height}px based on design image dimensions`,
          `Similarity score: ${imageComparison.similarity}% - ${imageComparison.similarity >= 95 ? 'Excellent match!' : imageComparison.similarity >= 85 ? 'Good match' : imageComparison.similarity >= 70 ? 'Moderate differences' : 'Significant differences detected'}`
        ]
      }
    };
    
  } catch (error) {
    throw new Error(`Error in advanced HTML-design comparison: ${error.message}`);
  }
}

export async function compareImages(
  image1Path,
  image2Path,
  outputDiffPath = null,
  options = {}
) {
  try {
    // Default options for layout-focused comparison
    const defaultOptions = {
      threshold: 0.1,
      includeAA: false,
      alpha: 0.2,
      diffColor: [255, 0, 0], // Red for differences
      diffColorAlt: [0, 255, 0], // Green for alternative differences
      layoutFocused: false, // Focus on layout changes only
      ignoreColors: false, // Convert to grayscale to ignore color differences
      ignoreAntialiasing: true, // Ignore antialiasing differences
    };

    const config = { ...defaultOptions, ...options };

    // Read both images
    const img1Buffer = fs.readFileSync(image1Path);
    const img2Buffer = fs.readFileSync(image2Path);

    // Get image metadata
    const img1Metadata = await sharp(img1Buffer).metadata();
    const img2Metadata = await sharp(img2Buffer).metadata();

    // Resize images to same dimensions if needed
    const targetWidth = Math.max(img1Metadata.width, img2Metadata.width);
    const targetHeight = Math.max(img1Metadata.height, img2Metadata.height);

    let img1Processing = sharp(img1Buffer).resize(targetWidth, targetHeight, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });

    let img2Processing = sharp(img2Buffer).resize(targetWidth, targetHeight, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });

    // Apply layout-focused processing
    if (config.layoutFocused || config.ignoreColors) {
      // Convert to grayscale to focus on structure rather than colors
      img1Processing = img1Processing.grayscale();
      img2Processing = img2Processing.grayscale();
    }

    // Convert to PNG format
    const img1Resized = await img1Processing.png().toBuffer();
    const img2Resized = await img2Processing.png().toBuffer();

    // Parse PNG data
    const png1 = PNG.sync.read(img1Resized);
    const png2 = PNG.sync.read(img2Resized);

    // Create diff image
    const diff = new PNG({ width: targetWidth, height: targetHeight });

    // Compare pixels with layout-focused settings
    const pixelmatchOptions = {
      threshold: config.layoutFocused ? 0.2 : config.threshold, // Higher threshold for layout focus
      alpha: config.alpha,
      diffColor: config.diffColor,
      diffColorAlt: config.diffColorAlt,
      includeAA: config.ignoreAntialiasing ? false : config.includeAA,
    };

    const numDiffPixels = pixelmatch(
      png1.data,
      png2.data,
      diff.data,
      targetWidth,
      targetHeight,
      pixelmatchOptions
    );

    // Calculate similarity percentage
    const totalPixels = targetWidth * targetHeight;
    const similarityPercentage = (
      ((totalPixels - numDiffPixels) / totalPixels) *
      100
    ).toFixed(2);

    // Save diff image
    const diffPath =
      outputDiffPath || path.join(downloadDir, `diff-${Date.now()}.png`);
    const diffBuffer = PNG.sync.write(diff);
    fs.writeFileSync(diffPath, diffBuffer);

    // Analyze layout-specific differences
    const layoutAnalysis = {
      focusMode: config.layoutFocused
        ? "Layout-focused (ignoring colors)"
        : "Standard comparison",
      structuralChanges:
        numDiffPixels > totalPixels * 0.05
          ? "Significant structural differences detected"
          : "Minor or no structural changes",
      recommendations: [],
    };

    // Add layout-specific recommendations
    if (config.layoutFocused) {
      layoutAnalysis.recommendations.push(
        "🔍 SPACING PRIORITY: Focus on margin, padding, and gap properties between all elements",
        "📏 Verify line-height, letter-spacing consistency across all text elements",
        "🔤 FONT FAMILY ACCURACY: Ensure exact font-family matches, including fallbacks",
        "📦 CONTAINER PRECISION: Check container width, max-width, padding, and positioning",
        "📐 CONTENT WIDTH CRITICAL: Main content area width is commonly incorrect - measure carefully",
        "🖼️ IMAGE DIMENSIONS: Check all image width/height - often overlooked and causes layout shifts",
        "📏 IMAGE ASPECT RATIO: Verify images maintain design proportions with correct object-fit",
        "🎯 CONTENT MAX-WIDTH: Content wrapper max-width must match design exactly",
        "📐 Element spacing must be pixel-perfect - use browser dev tools to measure",
        "🎯 Typography rendering differences often indicate font loading issues"
      );
    }

    // Content area issues
    const totalDiff = numDiffPixels / totalPixels;
    const issues = [];

    // Content area issues
    if (totalDiff > 0.7) {
      issues.push({
        type: "content",
        category: "main-content",
        severity: "major",
        description: "Major differences in main content area",
        location: "center content",
        suggestion:
          "Review main content layout, typography, spacing, or container width",
      });
    }

    // Content width issues (wide horizontal differences)
    if (totalDiff > 0.4 && (totalDiff > 0.3 || totalDiff > 0.3)) {
      issues.push({
        type: "content-width",
        category: "content-sizing",
        severity: "major",
        description: "Content width appears incorrect - common oversight",
        location: "main content area",
        suggestion:
          "Check content container width, max-width, and padding. Measure against design specifications",
      });
    }

    // Image sizing issues (scattered differences in content area)
    const contentScattered = totalDiff;
    const scatteredRatio = contentScattered;
    if (
      contentScattered > 0.5 &&
      scatteredRatio > 0.005 &&
      scatteredRatio < 0.03
    ) {
      issues.push({
        type: "image-sizing",
        category: "image-dimensions",
        severity: "moderate",
        description: "Possible image sizing or aspect ratio issues",
        location: "content images",
        suggestion:
          "Verify image width, height, object-fit, and aspect-ratio properties. Check for layout shifts caused by incorrect image dimensions",
      });
    }

    return {
      success: true,
      similarity: parseFloat(similarityPercentage),
      diffPixels: numDiffPixels,
      totalPixels,
      diffImagePath: diffPath,
      diffImageBase64: diffBuffer.toString("base64"),
      dimensions: {
        width: targetWidth,
        height: targetHeight,
      },
      layoutAnalysis,
      analysis: {
        image1: {
          path: image1Path,
          originalSize: `${img1Metadata.width}x${img1Metadata.height}`,
          format: img1Metadata.format,
        },
        image2: {
          path: image2Path,
          originalSize: `${img2Metadata.width}x${img2Metadata.height}`,
          format: img2Metadata.format,
        },
      },
      issues,
    };
  } catch (error) {
    throw new Error(`Error comparing images: ${error.message}`);
  }
}

// Helper function to generate workflow suggestions
export function generateWorkflowSuggestions(figmaUrl, hasImage = false, designImagePath = null) {
  const designFileName = figmaUrl.split('/').pop().split('?')[0] || 'design';
  
  return `
🔄 **COMPLETE DEVELOPMENT WORKFLOW:**

**Current Step**: ✅ Figma design data retrieved ${hasImage ? '+ Design image available' : ''}

**Next Steps**:

1. **🏗️ Build HTML Structure**:
   - Create: \`./${designFileName}.html\`
   - Implement layout based on design data above

2. **🎨 Implement CSS Styling** - Focus on these priorities:
   - 🔍 **SPACING**: Exact margins, padding, gaps
   - 🔤 **FONT FAMILY**: Precise font declarations
   - 📦 **CONTAINER**: Accurate width, max-width, positioning  
   - 📐 **CONTENT WIDTH**: Main content area dimensions
   - 🖼️ **IMAGE SIZING**: Correct image dimensions and aspect ratios

3. **✅ VERIFY IMPLEMENTATION** - ${hasImage ? 'Design image ready for comparison!' : 'Export design image first, then:'} 

${hasImage && designImagePath ? `
🎯 **READY TO COMPARE**: Use this exact command after building HTML:

\`\`\`javascript
{
  "tool": "compareHtmlWithDesignAdvanced",
  "arguments": {
    "htmlFilePath": "./${designFileName}.html",
    "designImagePath": "${designImagePath}"
  }
}
\`\`\`
` : hasImage ? `
🎯 **READY TO COMPARE**: Use this exact command after building HTML:

\`\`\`javascript
{
  "tool": "compareHtmlWithDesignAdvanced",
  "arguments": {
    "htmlFilePath": "./${designFileName}.html",
    "designImagePath": "figma-design-image" // Will use the Figma image automatically
  }
}
\`\`\`
` : `
📁 **First**: Export design as PNG from Figma, save as \`./${designFileName}.png\`

\`\`\`javascript
{
  "tool": "compareHtmlWithDesignAdvanced", 
  "arguments": {
    "htmlFilePath": "./${designFileName}.html",
    "designImagePath": "./${designFileName}.png"
  }
}
\`\`\`
`}

**Benefits of Verification**:
✅ Auto viewport sizing based on design image dimensions
✅ Pixel-perfect comparison with similarity scoring
✅ Detailed analysis of spacing, font, container issues
✅ Priority-ordered fix recommendations
✅ Focus on commonly missed issues (content width, image sizing)

4. **🔧 Fix & Re-verify**:
   - Address issues by priority (Major → Moderate → Minor)
   - Re-run comparison after each fix
   - Iterate until 95%+ similarity achieved

💡 **Pro Tips**:
- Use browser dev tools to measure exact pixels
- Test responsive behavior at design breakpoints
- Check font loading before taking screenshots
${hasImage ? '- Design image from Figma will be used automatically for accurate comparison' : '- Save design image at actual implementation size'}`;
}

// Add Figma JSON design fetch tool
server.tool(
  "figmaDesign",
  {
    figmaUrl: z.string().describe("Figma URL or file ID"),
  },
  async (params) => {
    try {
      if (!figmaToken) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Figma token not found. Please set the FIGMA_API_KEY environment variable.",
            },
          ],
        };
      }

      // Fetch the Figma design data and image
      const result = await fetchFigmaDesign(params.figmaUrl);
      
      let designImagePath = null;
      
      // Save design image if available
      if (result.image) {
        const designFileName = params.figmaUrl.split('/').pop().split('?')[0] || 'design';
        designImagePath = path.join(downloadDir, `${designFileName}-design.png`);
        
        // Convert base64 to buffer and save
        const imageBuffer = Buffer.from(result.image, 'base64');
        fs.writeFileSync(designImagePath, imageBuffer);
      }
      
      const content = [
        { 
          type: "text", 
          text: `📋 Figma Design Data Retrieved Successfully:

${JSON.stringify(result.design, null, 2)}
${designImagePath ? `
🖼️ **Design Image Saved**: ${designImagePath}
📐 **Ready for Comparison**: Design image automatically saved and ready to use!
` : ''}
${generateWorkflowSuggestions(params.figmaUrl, !!result.image, designImagePath)}`
        }
      ];

      // Add design image if available
      if (result.image) {
        content.push({
          type: "image",
          data: result.image,
          mimeType: result.mimeType,
        });
      }

      return { content };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching Figma design: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Add HTML vs Design comparison tool
server.tool(
  "compareHtmlDesign",
  {
    htmlFilePath: z.string().describe("Path to the HTML file to screenshot"),
    designImagePath: z
      .string()
      .describe("Path to the design image file to compare with"),
  },
  async (params) => {
    try {
      // Compare HTML with design image
      const result = await compareHtmlWithDesign(
        params.htmlFilePath,
        params.designImagePath
      );

      const content = [
        {
          type: "text",
          text: `HTML vs Design Comparison Results:
          
HTML File: ${result.comparison.htmlFile}
Design File: ${result.comparison.designFile}
Screenshot saved to: ${result.comparison.screenshotFile}

${result.comparison.message}

You can now visually compare the HTML screenshot with the design image.`,
        },
      ];

      // Add both images to the response for visual comparison
      if (result.htmlScreenshot) {
        content.push({
          type: "image",
          data: result.htmlScreenshot,
          mimeType: "image/png",
        });
      }

      if (result.designImage) {
        content.push({
          type: "image",
          data: result.designImage,
          mimeType: "image/png",
        });
      }

      return { content };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error comparing HTML with design: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Add Advanced HTML vs Design comparison tool
server.tool(
  "compareHtmlDesignAdvanced",
  {
    htmlFilePath: z.string().describe("Path to the HTML file to screenshot"),
    designImagePath: z
      .string()
      .describe("Path to the design image file to compare with"),
    viewportWidth: z
      .number()
      .optional()
      .describe("Browser viewport width (default: 1440)"),
    viewportHeight: z
      .number()
      .optional()
      .describe("Browser viewport height (default: 1080)"),
    selector: z
      .string()
      .optional()
      .describe("CSS selector for element to screenshot (default: 'body')"),
    fullPage: z
      .boolean()
      .optional()
      .describe("Take full page screenshot (default: true)"),
    waitForSelector: z
      .string()
      .optional()
      .describe("CSS selector to wait for before screenshot"),
    delay: z
      .number()
      .optional()
      .describe(
        "Delay in milliseconds before taking screenshot (default: 1000)"
      ),
  },
  async (params) => {
    try {
      // Prepare options
      const options = {};
      if (params.viewportWidth || params.viewportHeight) {
        options.viewport = {
          width: params.viewportWidth || 1440,
          height: params.viewportHeight || 1080,
        };
      }
      if (params.selector) options.selector = params.selector;
      if (params.fullPage !== undefined) options.fullPage = params.fullPage;
      if (params.waitForSelector)
        options.waitForSelector = params.waitForSelector;
      if (params.delay !== undefined) options.delay = params.delay;

      // Compare HTML with design image using advanced function
      const result = await compareHtmlWithDesignAdvanced(
        params.htmlFilePath,
        params.designImagePath,
        options
      );

      const content = [
        {
          type: "text",
          text: `🔍 Advanced HTML vs Design Comparison Results:

📄 HTML File: ${result.comparison.htmlFile}
🎨 Design File: ${result.comparison.designFile}
📸 Screenshot: ${result.comparison.screenshotFile}
🔄 Diff Image: ${result.comparison.diffFile}

📊 Page Metrics:
- Dimensions: ${result.pageMetrics.width}x${result.pageMetrics.height}px
- Scroll Size: ${result.pageMetrics.scrollWidth}x${
            result.pageMetrics.scrollHeight
          }px
- Title: ${result.pageMetrics.title}

🖼️ Design Image Info:
- Design Dimensions: ${result.designImageDimensions.width}x${
            result.designImageDimensions.height
          }px
- Format: ${result.designImageDimensions.format}
- Viewport Set To: ${result.analysis.viewport.width}x${
            result.analysis.viewport.height
          }px (auto-matched to design)

🎯 Image Comparison Results:
- Similarity: ${result.imageComparison.similarity}%
- Different Pixels: ${result.imageComparison.diffPixels.toLocaleString()}
- Total Pixels: ${result.imageComparison.totalPixels.toLocaleString()}
- Comparison Dimensions: ${result.imageComparison.dimensions.width}x${
            result.imageComparison.dimensions.height
          }px

🏗️ Layout Analysis:
- Focus Mode: ${result.imageComparison.layoutAnalysis.focusMode}
- Structural Changes: ${result.imageComparison.layoutAnalysis.structuralChanges}
${
  result.imageComparison.layoutAnalysis.recommendations.length > 0
    ? "\n📋 Layout-Specific Recommendations:\n" +
      result.imageComparison.layoutAnalysis.recommendations
        .map((rec) => `• ${rec}`)
        .join("\n")
    : ""
}

⚙️ Analysis Settings:
- Viewport: ${result.analysis.viewport.width}x${
            result.analysis.viewport.height
          }px
- Selector: ${result.analysis.selector}
- Screenshot Size: ${(result.analysis.screenshotSize / 1024).toFixed(2)} KB
- Design Size: ${(result.analysis.designSize / 1024).toFixed(2)} KB
- Timestamp: ${result.analysis.timestamp}

💡 Comparison Recommendations:
${result.comparison.recommendations.map((rec) => `• ${rec}`).join("\n")}

${result.comparison.message}`,
        },
      ];

      // Add HTML screenshot
      if (result.htmlScreenshot) {
        content.push({
          type: "image",
          data: result.htmlScreenshot,
          mimeType: "image/png",
        });
      }

      // Add design image
      if (result.designImage) {
        content.push({
          type: "image",
          data: result.designImage,
          mimeType: "image/png",
        });
      }

      // Add diff image
      if (result.imageComparison && result.imageComparison.diffImageBase64) {
        content.push({
          type: "image",
          data: result.imageComparison.diffImageBase64,
          mimeType: "image/png",
        });
      }

      return { content };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error in advanced HTML-design comparison: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Add standalone image comparison tool
server.tool(
  "compareImages",
  {
    image1Path: z.string().describe("Path to the first image"),
    image2Path: z.string().describe("Path to the second image"),
    outputDiffPath: z
      .string()
      .optional()
      .describe("Optional path for the diff image output"),
    layoutFocused: z
      .boolean()
      .optional()
      .describe(
        "Focus on layout changes only (ignores colors, default: false)"
      ),
    ignoreColors: z
      .boolean()
      .optional()
      .describe(
        "Convert to grayscale to ignore color differences (default: false)"
      ),
    threshold: z
      .number()
      .optional()
      .describe(
        "Comparison threshold 0-1, higher = less sensitive (default: 0.1)"
      ),
  },
  async (params) => {
    try {
      // Prepare comparison options
      const options = {};
      if (params.layoutFocused !== undefined)
        options.layoutFocused = params.layoutFocused;
      if (params.ignoreColors !== undefined)
        options.ignoreColors = params.ignoreColors;
      if (params.threshold !== undefined) options.threshold = params.threshold;

      // Compare the two images
      const result = await compareImages(
        params.image1Path,
        params.image2Path,
        params.outputDiffPath,
        options
      );

      const content = [
        {
          type: "text",
          text: `🔍 Image Comparison Results:

📸 Image 1: ${result.analysis.image1.path}
📸 Image 2: ${result.analysis.image2.path}
🔄 Diff Image: ${result.diffImagePath}

🎯 Comparison Results:
- Similarity: ${result.similarity}%
- Different Pixels: ${result.diffPixels.toLocaleString()}
- Total Pixels: ${result.totalPixels.toLocaleString()}
- Comparison Dimensions: ${result.dimensions.width}x${
            result.dimensions.height
          }px

🏗️ Layout Analysis:
- Focus Mode: ${result.layoutAnalysis.focusMode}
- Structural Changes: ${result.layoutAnalysis.structuralChanges}
${
  result.layoutAnalysis.recommendations.length > 0
    ? "\n📋 Layout-Specific Recommendations:\n" +
      result.layoutAnalysis.recommendations.map((rec) => `• ${rec}`).join("\n")
    : ""
}

📊 Image Details:
- Image 1: ${result.analysis.image1.originalSize} (${
            result.analysis.image1.format
          })
- Image 2: ${result.analysis.image2.originalSize} (${
            result.analysis.image2.format
          })

💡 Analysis:
${
  result.similarity >= 95
    ? "✅ Excellent match! Images are nearly identical."
    : result.similarity >= 85
    ? "✅ Good match with minor differences."
    : result.similarity >= 70
    ? "⚠️ Moderate differences detected."
    : "❌ Significant differences found."
}

The diff image highlights differences in red. ${
            result.layoutAnalysis.focusMode.includes("Layout-focused")
              ? "Color differences are ignored to focus on structural changes."
              : "White areas are identical, red areas show differences."
          }`,
        },
      ];

      // Add diff image to response
      if (result.diffImageBase64) {
        content.push({
          type: "image",
          data: result.diffImageBase64,
          mimeType: "image/png",
        });
      }

      return { content };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error comparing images: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
// await fetchFigmaDesign("https://www.figma.com/design/dYYTLSIATnassRFckYWbpN/NPKI-Website?node-id=4362-10168&t=CKE6uIFszEQngzLt-4");
