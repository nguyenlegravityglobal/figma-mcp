import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
// import fs from "fs";
import { transformFigmaJson } from "./utils/transformFigmaJson.js";
// import { extractColorAndTypoItems } from "./utils/extract_figma_data.js";
import { findColorItems } from "./utils/findColorItems.js";
import { extractTypoItems } from "./utils/extract_figma_data.js";
import dotenv from "dotenv";
dotenv.config();


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
function extractFigmaInfo(url) {
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

async function fetchFigmaDesign(figmaUrl, saveToFile = false, tokent=false) {
  // Extract file ID and node ID from URL
  const { fileId, nodeId } = extractFigmaInfo(figmaUrl);
  
  if (!fileId) {
    throw new Error("Could not extract a valid Figma file ID from the URL.");
  }
  
  // Construct the API URL
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
  
  if (saveToFile) {
    // Create figma_data directory if it doesn't exist
    if (!fs.existsSync('figma_data')) {
      fs.mkdirSync('figma_data', { recursive: true });
      console.log("Created directory: figma_data");
    }
    
    // Save original data
    const fileName = `figma_data/figma_data.json`;
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log(`Figma data saved to: ${fileName}`);
    
    // Process and save transformed data
    try {
      const transformedData = transformFigmaJson(data);
      fs.writeFileSync('figma_data/figma_data-optimized.json', JSON.stringify(transformedData, null, 2));
      
      // Log transformation details
      const originalSize = JSON.stringify(data).length;
      const transformedSize = JSON.stringify(transformedData).length;
      const percentReduction = ((originalSize - transformedSize) / originalSize * 100).toFixed(2);

      // const colorTokens = extractOptimizedColors(transformedData);
      // const typoTokens = extractOptimizedTypography(transformedData);
      // console.log(typoTokens);
      // fs.writeFileSync('figma_data/figma_tokens.json', JSON.stringify({ colors: colorTokens, typography: typoTokens }, null, 2));
    } catch (error) {
      console.error(`Error transforming Figma data: ${error.message}`);
      console.error(error.stack);
    }
  }
  if (tokent) {
    const colorItems = findColorItems(data);
    const typoItems = extractTypoItems(data);
    return { colors: colorItems, typography: typoItems };
  }
  return transformFigmaJson(data);
}


// Add Figma JSON design fetch tool
server.tool("figmaDesign",
  { 
    figmaUrl: z.string().describe("Figma URL or file ID"),
    fullJson: z.boolean().optional().describe("If true, returns full uncompressed JSON data"),
    cleanData: z.boolean().optional().describe("If true, removes unnecessary properties for HTML/CSS rendering")
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

      // Fetch the Figma design data
      const data = await fetchFigmaDesign(params.figmaUrl);
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(data, null, 2)
        }]
      };
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
// await fetchFigmaDesign("https://www.figma.com/design/Xg0BslXQN1tNB1djfbAySf/Allied-Fire-Protection-Website-(Copy)?node-id=4993-1905&t=saI0jT1zN8qcacwK-4", true);