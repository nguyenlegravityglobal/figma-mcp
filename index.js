import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { transformFigmaJson } from "./utils/transformFigmaJson.js";
import dotenv from "dotenv";
import { Buffer } from "buffer";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create figma-downloader directory if it doesn't exist
const downloadDir = path.join(__dirname, 'figma-downloader');
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
  version: "1.0.0"
});

// Helper function to extract file ID and node ID from Figma URL
export function extractFigmaInfo(url) {
  console.log("Processing URL:", url);
  const result = { fileId: "", nodeId: "" };
  
  // Extract file ID from various Figma URL formats
  const fileMatchPatterns = [
    /figma\.com\/file\/([^\/\?]+)/,      // Regular file URL
    /figma\.com\/design\/([^\/\?]+)/     // Design URL
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

export async function fetchFigmaDesign(figmaUrl, download = false, viewport = "desktop") {
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
      'X-Figma-Token': figmaToken
    }
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.statusText}`);
  }

  const data = await response.json();
  const transformedData = transformFigmaJson(data);

  if (download) {
    // Get the design image URL only when downloading
    const imageApiUrl = nodeId
      ? `https://api.figma.com/v1/images/${fileId}?ids=${nodeId.replace("-", ":")}&format=png`
      : `https://api.figma.com/v1/images/${fileId}?format=png`;

    const imageResponse = await fetch(imageApiUrl, {
      headers: {
        'X-Figma-Token': figmaToken
      }
    });

    if (!imageResponse.ok) {
      throw new Error(`Figma API error when fetching image: ${imageResponse.statusText}`);
    }

    const imageData = await imageResponse.json();
    const imageKey = nodeId ? nodeId.replace("-", ":") : fileId;
    const imageUrl = imageData.images[imageKey];

    // Save JSON file
    const jsonPath = path.join(downloadDir, `${viewport}-design.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null));

    // Download and save image
    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error("Failed to download image from Figma CDN");
      const arrayBuffer = await imgRes.arrayBuffer();
      const imagePath = path.join(downloadDir, `${viewport}-image.png`);
      fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
    }

    return {
      success: true,
      jsonPath,
      imagePath: imageUrl ? path.join(downloadDir, `${viewport}-image.png`) : null,
      image: imageUrl ? await fetch(imageUrl).then(res => res.arrayBuffer()).then(buffer => Buffer.from(buffer).toString('base64')) : null,
      design: transformedData
    };
  }

  // When not downloading, just return the design data without image
  return {
    design: transformedData,
    image: null,
    mimeType: null
  };
}

// Helper function to process multiple Figma URLs for different viewports
export async function fetchMultipleViewports(mobileUrl, tabletUrl, desktopUrl) {
  const results = {
    mobile: null,
    tablet: null,
    desktop: null
  };

  // Process mobile viewport
  if (mobileUrl && mobileUrl.trim()) {
    try {
      results.mobile = await fetchFigmaDesign(mobileUrl, false, "mobile");
    } catch (error) {
      console.error(`Error fetching mobile design: ${error.message}`);
      results.mobile = { error: error.message };
    }
  }

  // Process tablet viewport
  if (tabletUrl && tabletUrl.trim()) {
    try {
      results.tablet = await fetchFigmaDesign(tabletUrl, false, "tablet");
    } catch (error) {
      console.error(`Error fetching tablet design: ${error.message}`);
      results.tablet = { error: error.message };
    }
  }

  // Process desktop viewport
  if (desktopUrl && desktopUrl.trim()) {
    try {
      results.desktop = await fetchFigmaDesign(desktopUrl, false, "desktop");
    } catch (error) {
      console.error(`Error fetching desktop design: ${error.message}`);
      results.desktop = { error: error.message };
    }
  }

  return results;
}

// Update the Figma design tool to handle multiple viewports
server.tool("figmaDesign",
  { 
    mobileUrl: z.string().optional().describe("Figma URL or file ID for mobile viewport"),
    tabletUrl: z.string().optional().describe("Figma URL or file ID for tablet viewport"),
    desktopUrl: z.string().optional().describe("Figma URL or file ID for desktop viewport"),
    command: z.string().optional().describe("Command context (e.g., 'get data', 'start data') to include specific rules"),
  },
  async (params) => {
    try {
      if (!figmaToken) {
        return {
          content: [{ 
            type: "text", 
            text: "Error: Figma token not found. Please set the FIGMA_API_KEY environment variable."
          }]
        };
      }

      // Check if at least one URL is provided
      if (!params.mobileUrl && !params.tabletUrl && !params.desktopUrl) {
        return {
          content: [{ 
            type: "text", 
            text: "Error: At least one Figma URL must be provided (mobile, tablet, or desktop)."
          }]
        };
      }

      // Fetch designs for all provided viewports
      const results = await fetchMultipleViewports(
        params.mobileUrl, 
        params.tabletUrl, 
        params.desktopUrl
      );

      // Check if command is related to data extraction
      const isDataCommand = params.command && (
        params.command.toLowerCase().includes('get data') || 
        params.command.toLowerCase().includes('start data')
      );

      // Prepare response object
      const response = {
        figmaData: results
      };

      // Add playwright rules if it's a data command
      if (isDataCommand) {
        response.playwrightRules = {
          title: "Figma to data.ts Style Rule",
          trigger: [
            "When user types `start data` command",
            "If no Figma URL (desktop & mobile) available, AI must request user to provide them",
            "If no `data.ts` file exists, AI must request user to provide or create this file before generating styles"
          ],
          purpose: "Automatically extract typography and color properties from Figma JSON (MCP) to generate styles object for `data.ts` file.",
          scope: {
            mapping: "Map all text selectors found in Figma JSON (e.g.: h1, h2, h3, p, span, .class, #id, ...)",
            allowedProperties: {
              typography: ["fontFamily", "fontWeight", "fontSize", "lineHeight", "letterSpacing", "textTransform"],
              color: "color (always output in rgb format with comma and space between numbers, e.g.: rgb(255, 255, 255))"
            },
            excludedProperties: "Do not include padding, margin, gap, background, border, ..."
          },
          workflow: [
            "1. Check existence of `data.ts` file - If not available, request user to provide or create empty template file",
            "2. Receive Figma JSON (MCP) for each breakpoint (desktop, mobile)",
            "3. Extract typography and color properties for all text selectors found - Color must always be converted to rgb format with comma and space between numbers (e.g.: rgb(255, 255, 255))",
            "4. Compare text elements in Figma JSON with existing selectors in data.ts",
            "5. If Figma JSON contains new text elements not present in data.ts, automatically add those elements to data.ts with appropriate selectors (h1, h2, h3, p, span, .class-name, etc.)",
            "6. Map values into styles object with structure: styles: { desktop: { h1: {...}, h2: {...}, p: {...}, '.my-class': {...} }, mobile: { h1: {...}, h2: {...}, p: {...}, '.my-class': {...} } }",
            "7. If selector has no properties, leave as `{}`",
            "8. If values are missing, skip those fields",
            "9. Alert (notify) user about new elements that have been added for mapping confirmation"
          ],
          elementHandling: {
            newElementDetection: "Automatically detect text elements in Figma JSON that don't exist in data.ts",
            autoAddition: "Automatically add new elements to data.ts with appropriate selectors based on:",
            selectorMapping: [
              "Element name in Figma (if pattern exists like 'Heading 1' → h1, 'Paragraph' → p)",
              "Font size (large fonts → h1, h2; small fonts → p, span)",
              "Font weight (bold → heading; normal → paragraph)",
              "Position in hierarchy (parent element → heading; child element → paragraph/span)"
            ],
            notification: "Always notify user about new elements that have been added and request mapping confirmation"
          },
          importantNotes: [
            "All listed selectors must have styles (do not leave any selector missing in output)",
            "Class selector names are symbolic only, not necessarily matching actual content in Figma",
            "If selector is a class (e.g.: .icon__arrow) but actually represents text, find the most suitable element in Figma JSON for style mapping (prioritize elements with text or closest meaning)",
            "Focus only on typography and color",
            "Color must always be in rgb format with comma and space between numbers (e.g.: rgb(255, 255, 255))",
            "Do not automatically add other fields beyond this rule",
            "Output is styles object to copy into `data.ts` file",
            "IMPORTANT: If new text elements are detected in Figma JSON, must automatically add to data.ts and notify user"
          ],
          usage: [
            "Receive Figma JSON from MCP for desktop and mobile",
            "Analyze and compare with current data.ts",
            "Automatically add new elements if any",
            "Generate styles object as above for all text selectors (including new elements)",
            "Notify user about changes",
            "Copy into `data.ts` file"
          ]
        };
      }
      
      const content = [
        { 
          type: "text", 
          text: JSON.stringify(response, null, 2)
        }
      ];
      return { content };
    } catch (error) {
      return {
        content: [
          { 
            type: "text", 
            text: `Error fetching Figma designs: ${error.message}`
          }
        ]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
// await fetchFigmaDesign("https://www.figma.com/design/dYYTLSIATnassRFckYWbpN/NPKI-Website?node-id=4362-10168&t=CKE6uIFszEQngzLt-4"); 