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

// Add a tool to extract typography and color tokens from Figma data
// server.tool("figmaTokens",
//   { 
//     figmaUrl: z.string().describe("Figma URL or file ID to extract tokens from"),
//     tokenTypes: z.array(z.enum(["typography", "colors"])).optional().default(["typography", "colors"]).describe("Types of tokens to extract")
//   },
//   async (params) => {
//     try {
//       if (!figmaToken) {
//         return {
//           content: [{ 
//             type: "text", 
//             text: "Error: Figma token not found. Please set the FIGMA_API_KEY environment variable."
//           }]
//         };
//       }

//       // Fetch the Figma design data
//       const data = await fetchFigmaDesign(params.figmaUrl, flase, tokent=true);
      
      
//       return {
//         content: [{ 
//           type: "text", 
//           text: JSON.stringify(data, null, 2)
//         }]
//       };
//     } catch (error) {
//       return {
//         content: [{ 
//           type: "text", 
//           text: `Error extracting tokens: ${error.message}`
//         }]
//       };
//     }
//   }
// );

// // Extract typography tokens from transformed Figma data
// export function extractTypographyTokens(data) {
//   const typographyTokens = {
//     headings: {}, // Specifically for h1-h6
//     body: {},     // Body text styles
//     other: {}     // Other text styles
//   };
  
//   const seenStyles = new Set();
  
//   // Check if optimizedStyles exists and has typography data
//   if (data.optimizedStyles && data.optimizedStyles.typography) {
//     // Still need to categorize by headings, body, etc.
//     const rawTypography = data.optimizedStyles.typography;
    
//     Object.entries(rawTypography).forEach(([styleId, style]) => {
//       categorizeTypography(styleId, style, typographyTokens);
//     });
    
//     return typographyTokens;
//   }
  
//   // Otherwise extract from styles and nodes
//   if (data.styles) {
//     // Extract typography styles
//     Object.entries(data.styles).forEach(([styleId, style]) => {
//       if (style.fontFamily || style.fontSize || style.fontWeight) {
//         categorizeTypography(styleId, style, typographyTokens);
//       }
//     });
//   }
  
//   // Also look through nodes to find text elements with names like "h1", "h2", etc.
//   if (data.nodes) {
//     Object.values(data.nodes).forEach(node => {
//       processNodeForTypography(node, typographyTokens);
//     });
//   }
  
//   return typographyTokens;
// }

// // Helper function to process nodes recursively for typography
// function processNodeForTypography(node, typographyTokens) {
//   if (!node) return;
  
//   // Check if this node is a text element
//   if (node.type === "TEXT") {
//     let category = "other";
    
//     // Determine if this is a heading by node name
//     const headingMatch = node.name && node.name.match(/^[Hh](\d)/);
//     if (headingMatch) {
//       const headingLevel = headingMatch[1]; 
//       if (headingLevel >= 1 && headingLevel <= 6) {
//         category = "headings";
        
//         // Get style information either from direct node properties or referenced style
//         let style = {};
//         if (node.textStyleId && typographyTokens._tempStyles && typographyTokens._tempStyles[node.textStyleId]) {
//           style = typographyTokens._tempStyles[node.textStyleId];
//         } else if (node.style) {
//           style = {
//             fontFamily: node.style.fontFamily,
//             fontSize: node.style.fontSize,
//             fontWeight: node.style.fontWeight,
//             lineHeight: node.style.lineHeight,
//             letterSpacing: node.style.letterSpacing,
//             textAlign: node.style.textAlign
//           };
//         }
        
//         // Clean undefined properties
//         Object.keys(style).forEach(key => {
//           if (style[key] === undefined) {
//             delete style[key];
//           }
//         });
        
//         if (Object.keys(style).length > 0) {
//           typographyTokens.headings[`h${headingLevel}`] = style;
//         }
//       }
//     }
//   }
  
//   // Process children recursively
//   if (node.children && Array.isArray(node.children)) {
//     node.children.forEach(child => {
//       processNodeForTypography(child, typographyTokens);
//     });
//   }
// }

// // Helper function to categorize typography style
// function categorizeTypography(styleId, style, typographyTokens) {
//   if (!style) return;
  
//   // Make a clean copy of the style
//   const cleanStyle = { ...style };
  
//   // Remove categories and other non-CSS properties
//   ['categories', 'id', 'name'].forEach(prop => {
//     if (cleanStyle[prop]) delete cleanStyle[prop];
//   });
  
//   // Try to identify if this is a heading style
//   let category = "other";
//   let specificName = "";
  
//   // Check if name contains heading indicators (h1, h2, etc.)
//   const headingMatch = styleId.match(/[Hh](\d)/) || 
//                        (cleanStyle.name && cleanStyle.name.match(/[Hh](\d)/));
  
//   if (headingMatch) {
//     const headingLevel = headingMatch[1];
//     if (headingLevel >= 1 && headingLevel <= 6) {
//       category = "headings";
//       specificName = `h${headingLevel}`;
//     }
//   } 
//   // If not a heading, check if it might be body text
//   else if (styleId.includes('body') || 
//           (cleanStyle.name && cleanStyle.name.toLowerCase().includes('body')) ||
//           (cleanStyle.fontSize && 
//            parseInt(cleanStyle.fontSize) < 18)) { // Body text is typically smaller
//     category = "body";
    
//     // Create a name based on properties
//     let baseName = 'body';
//     if (cleanStyle.fontWeight) {
//       if (cleanStyle.fontWeight >= 600) baseName += '-bold';
//       else if (cleanStyle.fontWeight >= 500) baseName += '-medium';
//       else if (cleanStyle.fontWeight <= 300) baseName += '-light';
//       else baseName += '-regular';
//     }
    
//     specificName = baseName;
//   } else {
//     // Create a generic name
//     specificName = `text-${Object.keys(typographyTokens.other).length + 1}`;
//   }
  
//   // Store in the appropriate category
//   typographyTokens[category][specificName] = cleanStyle;
// }

// // Extract color tokens from transformed Figma data
// export function extractColorTokens(data) {
//   // Color categories
//   const colorTokens = {
//     primary: {},
//     secondary: {},
//     neutral: {},
//     additional: {},
//     states: {},
//     gradients: {},
//     other: {}
//   };
  
//   const seenColors = new Set();
  
//   // Check if optimizedStyles exists and has colors data
//   if (data.optimizedStyles && data.optimizedStyles.colors) {
//     // Process and categorize colors
//     Object.entries(data.optimizedStyles.colors).forEach(([styleId, colorValue]) => {
//       categorizeColor(styleId, colorValue, colorTokens, seenColors);
//     });
    
//     return colorTokens;
//   }
  
//   // Otherwise extract from styles
//   if (data.styles) {
//     // Extract color styles
//     Object.entries(data.styles).forEach(([styleId, style]) => {
//       // Look for backgroundColor or color properties
//       if (style.backgroundColor || style.color) {
//         let colorValue = style.backgroundColor || style.color;
        
//         // Skip if we've seen this color before
//         if (seenColors.has(colorValue)) {
//           return;
//         }
        
//         categorizeColor(styleId, colorValue, colorTokens, seenColors);
//       }
//     });
//   }
  
//   // Also look for fill colors in nodes
//   if (data.nodes) {
//     Object.values(data.nodes).forEach(node => {
//       processNodeForColors(node, colorTokens, seenColors);
//     });
//   }
  
//   return colorTokens;
// }

// // Helper function to process nodes recursively for colors
// function processNodeForColors(node, colorTokens, seenColors) {
//   if (!node) return;
  
//   // Check for color information in this node
//   if (node.fills && Array.isArray(node.fills)) {
//     node.fills.forEach(fill => {
//       if (fill.type === 'SOLID' && fill.color) {
//         const colorValue = rgbaToHex(fill.color);
        
//         // Determine category from node name
//         let category = 'other';
//         let colorName = '';
        
//         // Check node name for category hints
//         if (node.name) {
//           const nameLower = node.name.toLowerCase();
//           if (nameLower.includes('primary')) {
//             category = 'primary';
//             colorName = `primary-${colorValue.replace('#', '')}`;
//           } else if (nameLower.includes('secondary')) {
//             category = 'secondary';
//             colorName = `secondary-${colorValue.replace('#', '')}`;
//           } else if (nameLower.includes('neutral')) {
//             category = 'neutral';
//             colorName = `neutral-${colorValue.replace('#', '')}`;
//           } else if (nameLower.includes('additional')) {
//             category = 'additional';
//             colorName = `additional-${colorValue.replace('#', '')}`;
//           } else if (nameLower.includes('state') || nameLower.includes('success') || 
//                     nameLower.includes('error') || nameLower.includes('warning')) {
//             category = 'states';
            
//             if (nameLower.includes('success')) colorName = 'success';
//             else if (nameLower.includes('error')) colorName = 'error';
//             else if (nameLower.includes('warning')) colorName = 'warning';
//             else colorName = `state-${colorValue.replace('#', '')}`;
//           } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
//             category = 'gradients';
//             colorName = `gradient-${Object.keys(colorTokens.gradients).length + 1}`;
//           } else {
//             colorName = `color-${colorValue.replace('#', '')}`;
//           }
//         } else {
//           colorName = `color-${colorValue.replace('#', '')}`;
//         }
        
//         // Add to appropriate category if not seen before
//         if (!seenColors.has(colorValue)) {
//           seenColors.add(colorValue);
//           colorTokens[category][colorName] = colorValue;
//         }
//       }
//     });
//   }
  
//   // Process children recursively
//   if (node.children && Array.isArray(node.children)) {
//     node.children.forEach(child => {
//       processNodeForColors(child, colorTokens, seenColors);
//     });
//   }
// }

// // Helper function to categorize color
// function categorizeColor(styleId, colorValue, colorTokens, seenColors) {
//   if (!colorValue) return;
  
//   // Skip if we've seen this color before
//   if (seenColors.has(colorValue)) {
//     return;
//   }
//   seenColors.add(colorValue);
  
//   // Determine category and name based on styleId or other hints
//   let category = 'other';
//   let colorName = '';
  
//   const styleLower = styleId.toLowerCase();
  
//   if (styleLower.includes('primary')) {
//     category = 'primary';
//     colorName = `primary-${colorValue.replace('#', '')}`;
//   } else if (styleLower.includes('secondary')) {
//     category = 'secondary';
//     colorName = `secondary-${colorValue.replace('#', '')}`;
//   } else if (styleLower.includes('neutral')) {
//     category = 'neutral';
//     colorName = `neutral-${colorValue.replace('#', '')}`;
//   } else if (styleLower.includes('additional')) {
//     category = 'additional';
//     colorName = `additional-${colorValue.replace('#', '')}`;
//   } else if (styleLower.includes('state') || styleLower.includes('success') || 
//             styleLower.includes('error') || styleLower.includes('warning')) {
//     category = 'states';
    
//     if (styleLower.includes('success')) colorName = 'success';
//     else if (styleLower.includes('error')) colorName = 'error';
//     else if (styleLower.includes('warning')) colorName = 'warning';
//     else colorName = `state-${colorValue.replace('#', '')}`;
//   } else if (styleLower.includes('gradient')) {
//     category = 'gradients';
//     colorName = `gradient-${Object.keys(colorTokens.gradients).length + 1}`;
//   } else {
//     // Default naming - use the property type if available (bg/text) or just 'color'
//     const prefix = styleLower.includes('background') ? 'bg' : 
//                   styleLower.includes('text') ? 'text' : 'color';
//     colorName = `${prefix}-${colorValue.replace('#', '')}`;
//   }
  
//   // Add to the appropriate category
//   colorTokens[category][colorName] = colorValue;
// }

// // Helper function to convert RGBA to hex
// function rgbaToHex(rgba) {
//   if (!rgba || typeof rgba !== 'object') return '#000000';
  
//   const r = Math.floor(rgba.r * 255);
//   const g = Math.floor(rgba.g * 255);
//   const b = Math.floor(rgba.b * 255);
//   return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
// }

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
// await fetchFigmaDesign("https://www.figma.com/design/Xg0BslXQN1tNB1djfbAySf/Allied-Fire-Protection-Website-(Copy)?node-id=4993-1905&t=saI0jT1zN8qcacwK-4", true);