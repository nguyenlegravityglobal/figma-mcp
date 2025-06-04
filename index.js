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

// Combined Figma Responsive Analysis Tool
server.tool("figmaResponsiveAnalysis",
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

      for (const viewport of viewports) {
        if (viewport.url) {
          try {
            const result = await fetchFigmaDesign(viewport.url);
            
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
            console.error(`Error fetching ${viewport.name} design:`, error.message);
          }
        }
      }

      // Create comprehensive analysis prompt
      const imageSection = params.includeImages && imageRefs.length > 0 
        ? `## Visual Analysis Context\nAnalyzing designs from: ${imageRefs.join(', ')}\n\n` 
        : '';

      const jsonSection = params.includeJsonData && Object.keys(designs).length > 0
        ? `## Design Data Analysis\nBelow is the extracted design data from Figma for technical analysis:\n\n\`\`\`json\n${JSON.stringify(designs, null, 2)}\n\`\`\`\n\n`
        : '';

      const prompt = `# Comprehensive Responsive Design Analysis & Implementation

${imageSection}## Objective
Create a production-ready responsive module based on the provided Figma designs across multiple viewports.

## CRITICAL IMPLEMENTATION RULE
**Layout Construction Priority:**
1. **Primary Source**: Build layout structure based on JSON design data AND image design analysis
2. **Data Integration**: Combine structural information from JSON with visual cues from images
3. **Conflict Resolution**: If there are contradictions between desktop and mobile layout approaches:
   - **STOP IMPLEMENTATION**
   - **Provide detailed descriptions of BOTH layout versions**
   - **Present clear comparison with pros/cons of each approach**
   - **Wait for user selection before proceeding**
4. **Consistency Check**: If no conflicts exist, proceed with unified responsive implementation

## Analysis Framework

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
\`\`\`

### Phase 2: Visual & Structural Analysis
**Cross-Viewport Comparison:**
- Layout structural differences between breakpoints
- Content hierarchy and priority shifts
- Navigation pattern evolution (desktop nav → mobile hamburger)
- Typography scaling and readability optimization
- Spacing system consistency and adaptations

**Component Behavior Mapping:**
- Interactive element transformations
- Content reflow and reorganization patterns
- Image and media handling across devices
- Form factor specific optimizations

### Phase 3: Responsive Strategy Development
**Mobile-First Architecture:**
- Base mobile styles as foundation
- Progressive enhancement for larger screens
- Breakpoint selection based on content, not devices
- Performance-first loading strategy

**Interaction Design:**
- Touch vs hover interaction patterns
- Progressive disclosure for complex interfaces
- Accessibility considerations across input methods
- Gesture support and fallback strategies

### Phase 4: Technical Implementation
**Code Architecture:**
- Semantic HTML5 structure with proper landmarks
- CSS custom properties for design tokens
- Modular CSS architecture (BEM, CSS Modules, or similar)
- JavaScript progressive enhancement strategy

**Performance Optimization:**
- Critical CSS inlining strategy
- Image optimization and responsive images
- Font loading optimization
- Bundle splitting for viewport-specific code

### Phase 5: Quality Assurance Framework
**Testing Strategy:**
- Cross-device testing matrix
- Performance benchmarking (Core Web Vitals)
- Accessibility audit checklist (WCAG 2.1 AA)
- Browser compatibility verification

**Monitoring & Maintenance:**
- Performance monitoring setup
- User experience analytics
- A/B testing framework for responsive variants
- Documentation for future maintenance

## Expected Deliverable
A self-contained, production-ready responsive module including:

1. **Complete HTML Structure** - Semantic, accessible markup based on JSON + image analysis
2. **Comprehensive CSS System** - Mobile-first, maintainable styles
3. **Progressive JavaScript** - Enhancement without dependency
4. **Performance Optimizations** - Fast loading across all devices
5. **Documentation Package** - Implementation and maintenance guides

${jsonSection}## Implementation Instructions
**MANDATORY FIRST STEP**: Check for layout conflicts between viewports
1. Analyze the design data structure and extract key design tokens
2. Cross-reference JSON structure with visual design patterns
3. **IF CONFLICTS DETECTED**: Present both layout options and wait for user decision
4. **IF NO CONFLICTS**: Proceed with unified responsive implementation
5. Create comprehensive implementation strategy with specific code recommendations
6. Include performance and accessibility considerations throughout

**Focus:** Create maintainable, scalable code that can be easily integrated into existing projects while maintaining design fidelity across all target devices.

## Development Priorities
- **Data-Driven Layout** - Build structure based on JSON + image analysis
- **Conflict Resolution First** - Address layout contradictions before coding
- **Mobile-First Approach** - Start with mobile base styles
- **Progressive Enhancement** - Layer on desktop features
- **Performance Budget** - Optimize for fast loading
- **Accessibility First** - WCAG 2.1 AA compliance
- **Modern Standards** - Use latest web technologies appropriately`;

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
// await fetchFigmaDesign("https://www.figma.com/design/dYYTLSIATnassRFckYWbpN/NPKI-Website?node-id=4362-10168&t=CKE6uIFszEQngzLt-4"); 