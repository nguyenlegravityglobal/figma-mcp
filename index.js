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

  // Get the design image URL
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

  if (download) {
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
    mimeType
  };
}

// Add Figma JSON design fetch tool
server.tool("figmaDesign",
  { 
    figmaUrl: z.string().describe("Figma URL or file ID"),
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

      // Fetch the Figma design data and image
      const result = await fetchFigmaDesign(params.figmaUrl);
      
      const content = [
        { 
          type: "text", 
          text: JSON.stringify(result.design)
        }
      ];
      if (result.image) {
        content.push({
          type: "image",
          data: result.image,
          mimeType: result.mimeType
        });
      }

      return { content };
    } catch (error) {
      return {
        content: [
          { 
            type: "text", 
            text: `Error fetching Figma design: ${error.message}`
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