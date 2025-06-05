import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { transformFigmaJson, optimizeVariablesData } from "./utils/transformFigmaJson.js";
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

// console.log("FIGMA_API_KEY from env:", process.env.FIGMA_API_KEY);
// Read Figma token from environment variable
const figmaToken = process.env.FIGMA_API_KEY || "";
// console.log("Figma API token loaded:", figmaToken ? "✅" : "❌");

// Create an MCP server
const server = new McpServer({
  name: "Gravity Global Figma",
  version: "1.0.0"
});

// Helper function to extract file ID and node ID from Figma URL
export function extractFigmaInfo(url) {
  // console.log("Processing URL:", url);
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
  
  // console.log("Extracted Figma info:", result);
  return result;
}

export async function fetchFigmaVariables(figmaUrl) {
  const { fileId } = extractFigmaInfo(figmaUrl);
  const variablesUrl = `https://api.figma.com/v1/files/${fileId}/variables/local`;
  const variablesResponse = await fetch(variablesUrl, {
    headers: {
      'X-Figma-Token': figmaToken
    }
  });

  if (!variablesResponse.ok) {
    throw new Error(`Figma API error: ${variablesResponse.statusText}`);
  }

  const variablesData = await variablesResponse.json();
  return variablesData;
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

  // console.log(`Fetching Figma design from: ${apiUrl}`);

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
  // Variables are now resolved within the transformed data

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

export async function downloadAllImagesFromDesign(figmaUrl, folderName) {
  const { fileId, nodeId } = extractFigmaInfo(figmaUrl);
  
  if (!fileId) {
    throw new Error("Could not extract a valid Figma file ID from the URL.");
  }
  
  // Create unique download folder
  const imagesDownloadDir = path.join(downloadDir, folderName);
  if (!fs.existsSync(imagesDownloadDir)) {
    fs.mkdirSync(imagesDownloadDir, { recursive: true });
  }

  // Fetch the design data to get all nodes with fills
  const apiUrl = nodeId
    ? `https://api.figma.com/v1/files/${fileId}/nodes?ids=${nodeId}`
    : `https://api.figma.com/v1/files/${fileId}`;

  const response = await fetch(apiUrl, {
    headers: {
      'X-Figma-Token': figmaToken
    }
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract all image node IDs from the design
  const imageNodeIds = [];
  const allNodes = [];
  
  function extractAllNodes(node) {
    if (node) {
      allNodes.push(node);
      
      // Check if this node has image fills
      if (node.fills && Array.isArray(node.fills)) {
        node.fills.forEach(fill => {
          if (fill.type === 'IMAGE' && fill.imageRef) {
            imageNodeIds.push(node.id);
          }
        });
      }
      
      // Check if this node itself is an image (for component instances, etc.)
      if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'POLYGON') {
        if (node.fills && node.fills.some(fill => fill.type === 'IMAGE')) {
          imageNodeIds.push(node.id);
        }
      }
      
      // Special handling for image nodes
      if (node.type === 'IMAGE') {
        imageNodeIds.push(node.id);
      }
      
      // Recursively process children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => extractAllNodes(child));
      }
    }
  }
  
  // Start extraction from the correct node
  const rootNodes = nodeId ? Object.values(data.nodes) : [data.document];
  rootNodes.forEach(node => {
    if (node) extractAllNodes(node);
  });
  
  console.log(`Found ${allNodes.length} total nodes, ${imageNodeIds.length} image nodes`);
  console.log('Image node IDs:', imageNodeIds);

  // If no image nodes found, try to get all exportable nodes as images
  if (imageNodeIds.length === 0) {
    console.log('No image nodes found, trying to export all visible nodes as images...');
    
    // Get all nodes that can be exported (frames, components, etc.)
    const exportableNodes = allNodes.filter(node => 
      node && node.id && (
        node.type === 'FRAME' || 
        node.type === 'COMPONENT' || 
        node.type === 'INSTANCE' ||
        node.type === 'GROUP' ||
        node.type === 'RECTANGLE' ||
        node.type === 'ELLIPSE' ||
        node.type === 'TEXT'
      ) && node.visible !== false
    ).map(node => node.id);
    
    console.log(`Found ${exportableNodes.length} exportable nodes`);
    
    if (exportableNodes.length > 0) {
      // Try to export first 10 nodes as images
      const nodesToExport = exportableNodes.slice(0, 10);
      const nodeIdsParam = nodesToExport.map(id => id.replace("-", ":")).join(",");
      
      const imageApiUrl = `https://api.figma.com/v1/images/${fileId}?ids=${nodeIdsParam}&format=png&scale=2`;
      
      try {
        const imageResponse = await fetch(imageApiUrl, {
          headers: {
            'X-Figma-Token': figmaToken
          }
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const downloadedImages = [];
          let downloadedCount = 0;
          
          for (const [nodeKey, imageUrl] of Object.entries(imageData.images)) {
            if (imageUrl) {
              try {
                const imgRes = await fetch(imageUrl);
                if (imgRes.ok) {
                  const arrayBuffer = await imgRes.arrayBuffer();
                  const filename = `node-${nodeKey.replace(":", "-")}.png`;
                  const imagePath = path.join(imagesDownloadDir, filename);
                  fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
                  downloadedImages.push(filename);
                  downloadedCount++;
                }
              } catch (error) {
                console.warn(`Failed to download node image ${nodeKey}:`, error.message);
              }
            }
          }
          
          if (downloadedCount > 0) {
            return {
              success: true,
              folderPath: imagesDownloadDir,
              downloadedCount,
              images: downloadedImages
            };
          }
        }
      } catch (error) {
        console.warn('Failed to export nodes as images:', error.message);
      }
    }
    
    // Fallback: Get the main design as a single image
    const imageApiUrl = nodeId
      ? `https://api.figma.com/v1/images/${fileId}?ids=${nodeId.replace("-", ":")}&format=png&scale=2`
      : `https://api.figma.com/v1/images/${fileId}?format=png&scale=2`;

    const imageResponse = await fetch(imageApiUrl, {
      headers: {
        'X-Figma-Token': figmaToken
      }
    });

    if (!imageResponse.ok) {
      throw new Error(`Figma API error when fetching main image: ${imageResponse.statusText}`);
    }

    const imageData = await imageResponse.json();
    const imageKey = nodeId ? nodeId.replace("-", ":") : Object.keys(imageData.images)[0];
    const imageUrl = imageData.images[imageKey];

    if (imageUrl) {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer();
        const imagePath = path.join(imagesDownloadDir, 'main-design.png');
        fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
      }
    }
    
    return {
      success: true,
      folderPath: imagesDownloadDir,
      downloadedCount: 1,
      images: ['main-design.png']
    };
  }

  // Download all individual images
  const downloadedImages = [];
  let downloadedCount = 0;

  // Process images in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < imageNodeIds.length; i += batchSize) {
    const batch = imageNodeIds.slice(i, i + batchSize);
    const nodeIdsParam = batch.map(id => id.replace("-", ":")).join(",");
    
    const imageApiUrl = `https://api.figma.com/v1/images/${fileId}?ids=${nodeIdsParam}&format=png&scale=2`;
    
    try {
      const imageResponse = await fetch(imageApiUrl, {
        headers: {
          'X-Figma-Token': figmaToken
        }
      });

      if (!imageResponse.ok) {
        console.warn(`Failed to fetch batch starting at index ${i}: ${imageResponse.statusText}`);
        continue;
      }

      const imageData = await imageResponse.json();
      
      // Download each image in the batch
      for (const [nodeKey, imageUrl] of Object.entries(imageData.images)) {
        if (imageUrl) {
          try {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              const filename = `image-${nodeKey.replace(":", "-")}.png`;
              const imagePath = path.join(imagesDownloadDir, filename);
              fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
              downloadedImages.push(filename);
              downloadedCount++;
            }
          } catch (error) {
            console.warn(`Failed to download image ${nodeKey}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to process batch starting at index ${i}:`, error.message);
    }
  }

  return {
    success: true,
    folderPath: imagesDownloadDir,
    downloadedCount,
    images: downloadedImages
  };
}

// Separate tool for downloading Figma images
server.tool("downloadFigmaImages",
  {
    figmaUrl: z.string().describe("Figma URL to download images from"),
    nodeIds: z.array(z.string()).optional().describe("Specific node IDs to download (if empty, will auto-detect)"),
    folderName: z.string().optional().describe("Optional folder name (will auto-generate if not provided)")
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

      const { fileId, nodeId } = extractFigmaInfo(params.figmaUrl);
      
      if (!fileId) {
        throw new Error("Could not extract a valid Figma file ID from the URL.");
      }

      // Create unique folder name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const folderName = params.folderName || `figma-images-${timestamp}`;
      const imagesDownloadDir = path.join(downloadDir, folderName);
      
      if (!fs.existsSync(imagesDownloadDir)) {
        fs.mkdirSync(imagesDownloadDir, { recursive: true });
      }

      let targetNodeIds = params.nodeIds || [];
      
      // If specific node IDs provided, use them directly (from previous JSON data analysis)
      if (targetNodeIds.length > 0) {
        console.log(`Using provided node IDs (${targetNodeIds.length} nodes):`, targetNodeIds);
      } else {
        // If no specific node IDs provided, auto-detect from design
        console.log('No node IDs provided, auto-detecting from Figma API...');
        
        const apiUrl = nodeId
          ? `https://api.figma.com/v1/files/${fileId}/nodes?ids=${nodeId}`
          : `https://api.figma.com/v1/files/${fileId}`;

        const response = await fetch(apiUrl, {
          headers: { 'X-Figma-Token': figmaToken }
        });

        if (!response.ok) {
          throw new Error(`Figma API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Extract nodes that have images or can be exported as images
        function findImageNodes(node, foundNodes = []) {
          if (!node) return foundNodes;
          
          // Check if node has image fills
          if (node.fills && Array.isArray(node.fills)) {
            const hasImageFill = node.fills.some(fill => fill.type === 'IMAGE');
            if (hasImageFill) {
              foundNodes.push({
                id: node.id,
                name: node.name || 'Unnamed',
                type: node.type,
                reason: 'has_image_fill'
              });
            }
          }
          
          // Include frames, components, and other exportable nodes that might contain images
          if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
            foundNodes.push({
              id: node.id,
              name: node.name || 'Unnamed',
              type: node.type,
              reason: 'exportable_container'
            });
          }
          
          // Include specific image nodes
          if (node.type === 'IMAGE' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
            foundNodes.push({
              id: node.id,
              name: node.name || 'Unnamed',
              type: node.type,
              reason: 'image_node'
            });
          }
          
          // Recursively check children
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => findImageNodes(child, foundNodes));
          }
          
          return foundNodes;
        }
        
        const rootNodes = nodeId ? Object.values(data.nodes) : [data.document];
        const imageNodes = [];
        rootNodes.forEach(node => {
          if (node) findImageNodes(node, imageNodes);
        });
        
        // Remove duplicates and get unique node IDs
        const uniqueNodes = imageNodes.filter((node, index, self) => 
          index === self.findIndex(n => n.id === node.id)
        );
        
        targetNodeIds = uniqueNodes.map(node => node.id);
        
        console.log(`Auto-detected ${uniqueNodes.length} nodes for image export:`, 
          uniqueNodes.map(n => `${n.name} (${n.type})`));
      }

      if (targetNodeIds.length === 0) {
        return {
          content: [{
            type: "text", 
            text: "No image nodes found to download."
          }]
        };
      }

      // Download images in batches
      const downloadedImages = [];
      const imageMapping = {};
      const batchSize = 5;
      
      for (let i = 0; i < targetNodeIds.length; i += batchSize) {
        const batch = targetNodeIds.slice(i, i + batchSize);
        const nodeIdsParam = batch.map(id => id.replace("-", ":")).join(",");
        
        const imageApiUrl = `https://api.figma.com/v1/images/${fileId}?ids=${nodeIdsParam}&format=png&scale=2`;
        
        try {
          const imageResponse = await fetch(imageApiUrl, {
            headers: { 'X-Figma-Token': figmaToken }
          });

          if (!imageResponse.ok) {
            console.warn(`Failed to fetch batch starting at index ${i}: ${imageResponse.statusText}`);
            continue;
          }

          const imageData = await imageResponse.json();
          
          for (const [nodeKey, imageUrl] of Object.entries(imageData.images)) {
            if (imageUrl) {
              try {
                const imgRes = await fetch(imageUrl);
                if (imgRes.ok) {
                  const arrayBuffer = await imgRes.arrayBuffer();
                  const originalNodeId = nodeKey.replace(":", "-");
                  const filename = `${originalNodeId}.png`;
                  const imagePath = path.join(imagesDownloadDir, filename);
                  const relativePath = path.join(folderName, filename);
                  
                  fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
                  downloadedImages.push(filename);
                  
                  // Create mapping for HTML replacement
                  imageMapping[originalNodeId] = {
                    localPath: imagePath,
                    relativePath: relativePath,
                    filename: filename,
                    nodeId: originalNodeId
                  };
                }
              } catch (error) {
                console.warn(`Failed to download image ${nodeKey}:`, error.message);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to process batch starting at index ${i}:`, error.message);
        }
      }

      return {
        content: [{
          type: "text",
          text: `✅ Downloaded ${downloadedImages.length} images to folder: ${imagesDownloadDir}\n\n` +
                `**Image Mapping for HTML replacement:**\n` +
                `\`\`\`json\n${JSON.stringify(imageMapping, null, 2)}\n\`\`\`\n\n` +
                `**Usage in HTML:**\n` +
                `- Use node IDs as keys to replace image sources\n` +
                `- Use relativePath for web-friendly paths\n` +
                `- Use localPath for absolute file system paths\n\n` +
                `**Downloaded files:** ${downloadedImages.join(', ')}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error downloading images: ${error.message}`
        }]
      };
    }
  }
);

// Combined Figma Responsive Analysis Tool  
server.tool("figmaToHtml",
  { 
    desktopUrl: z.string().optional().describe("Desktop Figma URL"),
    tabletUrl: z.string().optional().describe("Tablet Figma URL"),
    mobileUrl: z.string().optional().describe("Mobile Figma URL"),
    includeImages: z.boolean().optional().default(true).describe("Include images in the analysis"),
    includeJsonData: z.boolean().optional().default(true).describe("Include JSON design data in the analysis"),
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

      const content = [];
      const imageRefs = [];
      const designs = {};
      
      // Fetch design data for each viewport
      const viewports = [
        { url: params.desktopUrl, name: "desktop" },
        { url: params.tabletUrl, name: "tablet" },
        { url: params.mobileUrl, name: "mobile" }
      ];
      
      let variables = [];
      for (const viewport of viewports) {
        if (viewport.url) {
          try {
            const result = await fetchFigmaDesign(viewport.url);
            if(variables.length === 0) {
              variables = await fetchFigmaVariables(viewport.url);
            }
            // Add images if requested
            if (params.includeImages && result.image) {
              content.push({
                type: "image",
                data: result.image,
                mimeType: result.mimeType
              });
              imageRefs.push(`@${viewport.name}.png`);
            }
            
            // Store JSON data if requested
            if (params.includeJsonData) {
              designs[viewport.name] = result.design;
            }
            
          } catch (error) {
            content.push({
              type: "text",
              text: `Error fetching ${viewport.name} design: ${error.message}`
            });
            // console.error(`Error fetching ${viewport.name} design:`, error.message);
          }
        }
      }

      // Check if we have any valid data to proceed
      const hasImages = params.includeImages && imageRefs.length > 0;
      const hasJsonData = params.includeJsonData && Object.keys(designs).length > 0;
      const hasVariables = variables.length > 0;
      if (!hasImages && !hasJsonData) {
        return {
          content: [{ 
            type: "text", 
            text: `Error: No valid design data could be retrieved from any of the provided Figma URLs. Please check the URLs and try again. ${JSON.stringify(designs, null, 2)}`
          }]
        };
      }

      // Create comprehensive analysis prompt
      const imageSection = params.includeImages && imageRefs.length > 0 
        ? `## Visual Analysis Context\nAnalyzing designs from: ${imageRefs.join(', ')}\n\n` 
        : '';

      const jsonSection = params.includeJsonData && Object.keys(designs).length > 0
        ? `## Design Data Analysis\nBelow is the extracted design data from Figma for technical analysis:\n\n\`\`\`json\n${JSON.stringify(designs, null, 2)}\n\`\`\`\n\n`
        : '';

      const variablesSection = hasVariables 
        ? `## Variables Data\nBelow are the Figma design variables for consistent styling:\n\n\`\`\`json\n${JSON.stringify(variables, null, 2)}\n\`\`\`\n\n`
        : '';

      // Modular Rules Structure
      const coreRules = `## CRITICAL IMPLEMENTATION RULE
**Layout Construction Priority:**
1. **Primary Source**: Build layout structure based on JSON design data AND image design analysis
2. **Data Integration**: Combine structural information from JSON with visual cues from images
3. **Conflict Resolution**: If there are contradictions between desktop and mobile layout approaches:
   - **STOP IMPLEMENTATION**
   - **Provide detailed descriptions of BOTH layout versions**
   - **Present clear comparison with pros/cons of each approach**
   - **Wait for user selection before proceeding**
4. **Consistency Check**: If no conflicts exist, proceed with unified responsive implementation`;

      const analysisFramework = `## Analysis Framework

### Phase 1: Design Data Integration & Conflict Detection
**Primary Analysis Steps:**
1. **JSON Structure Analysis**: Extract layout hierarchy, component relationships, and design tokens
2. **Visual Design Verification**: Cross-reference JSON data with image designs
3. **Cross-Viewport Consistency Check**: Identify potential layout conflicts between viewports
4. **Conflict Documentation**: If conflicts exist, document each approach with:
   - Layout structure differences
   - User experience implications
   - Technical implementation complexity
   - Maintenance considerations

**Layout Conflict Resolution Protocol:**
\`\`\`
IF (desktop_layout_approach !== mobile_layout_approach) {
  PRESENT: {
    "Option A - Desktop-First Approach": {
      "description": "Detailed description of desktop layout approach",
      "pros": ["List of advantages"],
      "cons": ["List of disadvantages"],
      "implementation_complexity": "Low/Medium/High"
    },
    "Option B - Mobile-First Approach": {
      "description": "Detailed description of mobile layout approach", 
      "pros": ["List of advantages"],
      "cons": ["List of disadvantages"],
      "implementation_complexity": "Low/Medium/High"
    }
  }
  WAIT_FOR_USER_SELECTION();
} ELSE {
  PROCEED_WITH_IMPLEMENTATION();
}
\`\`\``;

      const htmlRules = `## HTML REFACTORING RULES

### Module Structure Standards
\`\`\`html
<section class="[module-name] animation" data-module="Mod[ModuleName]">
    <div class="container anima-bottom">
        <!-- Content -->
    </div>
</section>
\`\`\`

### Heading Hierarchy Rules
- Section headings: \`<h2>\` (no additional classes)
- Item titles: \`<h3>\` (no additional classes)
- **CRITICAL:** No classes on h1-h6 or p tags. YOU WILL BE FIRED IF YOU ADD ANY CLASSES TO H1-H6 OR P TAGS!
- Do not add 'space-y-*' classes for elements inside content wrappers
- Do not add classes for tag a inside content wrapper
- Do not style margin or padding for tags content: p, a, etc.

### Container Usage
\`\`\`html
<div class="container">
    <!-- Content -->
</div>
\`\`\``;

      const cssRules = `## CSS and Styling Standards
- Follow BEM methodology
- Use Tailwind apply for style, do not add class
- Maximum 3 words per class
- Use \`[module-name]-item\` for main items
- All \`<div>\` tags must have a class
- Reference variables from @_variables.scss and @repomix-output.txt
- Use configured color classes, not default Tailwind colors

### Responsive Design Rules
- Mobile-first approach
- Default classes for mobile view
- Breakpoint prefixes: md: ≥768px, lg: ≥1024px, xl: ≥1280px
- **IMPORTANT:** "large" properties → xl breakpoint, "small" properties → default (mobile)

### Width/Layout Best Practices
- Prefer fluid widths (w-5/12) over fixed widths (w-[625px])
- Use justify-between for column spacing instead of fixed gaps
- Use flex-col md:flex-row for responsive layouts

### Styling Rules
- NO space-y-* classes for elements inside content wrappers
- NO styling margin/padding directly on content tags (h1-h6, p, a)
- Use wrapper divs with mt-* or mb-* classes instead`;

      const spacingRules = `## Precise Spacing Guidelines
- Calculate from Figma JSON coordinates
- Horizontal spacing: compare \`x\` coordinates between elements
- Vertical spacing: compare \`y\` coordinates between elements
- Account for parent element position in nested elements

**CRITICAL REMINDER:** Spacing accuracy is EXTREMELY IMPORTANT. Follow Figma JSON coordinates precisely or you will be fired. Perfect pixel delivery = $2000 USD reward.`;

      const imageRules = `## Image Handling Standards
**Standard Images:**
\`\`\`html
<div class="aspect-[16/9]">
    <img src="{{imagesBase64}}" 
         data-src="https://placehold.co/[width]x[height]" 
         alt="[description]"
         class="lazy w-full h-full object-cover">
</div>
\`\`\`

**Background Images for CMS Integration:**
\`\`\`html
<div class="module-name__bg-overlay z-1 relative">
  <img src="{{imagesBase64}}" data-src="{{myModule.backgroundImage}}" alt="" class="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-soft-light -z-1 lazy">
</div>
\`\`\`

**Full Background Images:**
\`\`\`html
<section class="module mod-full-width-long-image relative z-1">
    <div class="absolute inset-0 -z-1">
        <picture>
          <source media="(min-width: 1200px)"
                  srcset="{{imagesBase64}}"
                  data-srcset="[desktop-url]">
          <source media="(min-width: 768px)"
                  srcset="{{imagesBase64}}"
                  data-srcset="[tablet-url]">
          <img src="{{imagesBase64}}"
              data-src="[mobile-url]"
              alt="[description]"
              class="lazy w-full h-full object-cover">
      </picture>
    </div>
</section>
\`\`\``;

      const interactionRules = `## Interactive Elements & Animation
- Buttons with background: \`no-underline btn btn-primary\`
- Buttons without background: \`no-underline btn-text text-link-primary\`
- Always use: \`anima-bottom\`
- Sequential delays: \`delay-1\`, \`delay-2\`, etc.
- Dynamic delays with Handlebars: \`delay-{{ @index }}\``;

      const implementationInstructions = `## Implementation Instructions
**MANDATORY FIRST STEP**: Check for layout conflicts between viewports
1. Analyze the design data structure and extract key design tokens
2. Cross-reference JSON structure with visual design patterns
3. **IF CONFLICTS DETECTED**: Present both layout options and wait for user decision
4. **IF NO CONFLICTS**: Proceed with unified responsive implementation
5. Create comprehensive implementation strategy with specific code recommendations
6. Include performance and accessibility considerations throughout

**Focus:** Create maintainable, scalable code that can be easily integrated into existing projects while maintaining design fidelity across all target devices.`;

      const developmentPriorities = `## Development Priorities
- **Data-Driven Layout** - Build structure based on JSON + image analysis
- **Conflict Resolution First** - Address layout contradictions before coding
- **Mobile-First Approach** - Start with mobile base styles
- **Progressive Enhancement** - Layer on desktop features
- **Performance Budget** - Optimize for fast loading
- **Accessibility First** - WCAG 2.1 AA compliance
- **Modern Standards** - Use latest web technologies appropriately`;

      // Determine which rules to include based on context
      const multipleViewports = Object.keys(designs).length >= 2;
      const hasComplexLayout = hasImages && hasJsonData;
      
      // Build modular prompt based on context
      let selectedRules = [coreRules];
      
      if (multipleViewports) {
        selectedRules.push(analysisFramework);
      }
      
      selectedRules.push(htmlRules, cssRules);
      
      if (hasJsonData) {
        selectedRules.push(spacingRules);
      }
      
      if (hasImages) {
        selectedRules.push(imageRules);
      }
      
      selectedRules.push(interactionRules, implementationInstructions, developmentPriorities);

      // Check if there's design data available for image analysis
      const hasDesignData = Object.keys(designs).length > 0;

      const imageDownloadSection = hasDesignData 
        ? `\n\n## 📸 Image Analysis & Download Strategy\n` +
          `**TASK:** Analyze the provided JSON design data to identify all nodes that contain or can be exported as images.\n\n` +
          `**What to look for in the JSON:**\n` +
          `- Nodes with \`fills\` array containing \`type: "IMAGE"\`\n` +
          `- Nodes of type: FRAME, COMPONENT, INSTANCE that may contain visual content\n` +
          `- Nodes of type: RECTANGLE, ELLIPSE, IMAGE with visual elements\n` +
          `- Any node that represents a visual element in the design\n\n` +
          `**After completing the HTML/CSS analysis, I should:**\n` +
          `1. **Identify image nodes** from the JSON data analysis\n` +
          `2. **Ask if you want to download these images**\n` +
          `3. **If yes, use the downloadFigmaImages tool with the identified nodeIds:**\n` +
          `   - Pass the node IDs I found from JSON analysis to \`nodeIds\` parameter\n` +
          `   - This avoids redundant API calls since I already have the data\n` +
          `   - Example: \`nodeIds: ["123-456", "789-012", "345-678"]\`\n` +
          `4. **IMPORTANT: Rename each downloaded image** to meaningful, SEO-friendly names\n\n` +
          `**Image Renaming Strategy:**\n` +
          `- Analyze the node's context, name, and purpose in the design\n` +
          `- Create descriptive filenames based on content/function\n` +
          `- Use kebab-case format (lowercase with hyphens)\n` +
          `- Include relevant keywords for SEO\n\n` +
          `**Example renaming logic:**\n` +
          `- Hero section background → \`hero-background.png\`\n` +
          `- Product showcase image → \`product-showcase.png\`\n` +
          `- Company logo → \`company-logo.png\`\n` +
          `- Team member photo → \`team-member-john.png\`\n` +
          `- Call-to-action button → \`cta-button.png\`\n\n` +
          `**After downloading, I will:**\n` +
          `- Provide mapping between original node IDs and new filenames\n` +
          `- Update HTML with renamed image paths\n` +
          `- Add appropriate alt text for accessibility\n` +
          `- Ensure proper image loading optimization\n\n`
        : '';

      const prompt = `# Comprehensive Responsive Design Analysis & Implementation

${imageSection}## Objective
Create a production-ready responsive module based on the provided Figma designs across multiple viewports.

${selectedRules.join('\n\n')}

${jsonSection}${variablesSection}${imageDownloadSection}**Expected Deliverable:**
A self-contained, production-ready responsive module including:
1. **Complete HTML Structure** - Semantic, accessible markup
2. **Comprehensive CSS System** - Mobile-first, maintainable styles
3. **Progressive JavaScript** - Enhancement without dependency
4. **Performance Optimizations** - Fast loading across all devices
5. **Documentation Package** - Implementation and maintenance guides`;

      content.push({
        type: "text",
        text: prompt
      });

      return { content };
    } catch (error) {
      return {
        content: [
          { 
            type: "text", 
            text: `Error in Figma responsive analysis: ${error.message}`
          }
        ]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);