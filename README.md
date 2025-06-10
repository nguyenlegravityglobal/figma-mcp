# Gravity Global Figma MCP Server

A Model Context Protocol (MCP) server that integrates Figma with AI coding assistants like Cursor, enabling seamless conversion of Figma designs to responsive HTML/CSS code.

## 🚀 Features

- **Figma Design Analysis**: Extract design data and images from Figma URLs
- **Responsive Design Conversion**: Analyze designs across desktop, tablet, and mobile viewports
- **Image Download**: Batch download images from Figma designs
- **HTML/CSS Generation**: Convert Figma designs to production-ready responsive code
- **Design Token Extraction**: Extract typography, colors, and spacing tokens
- **Layout Conflict Detection**: Identify and resolve responsive design conflicts

## 📋 Prerequisites

- Node.js 18+ installed
- Figma account with API access
- AI coding assistant that supports MCP (like Cursor)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd SSE-MCP
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Get Figma API Token
1. Go to [Figma Settings > Personal Access Tokens](https://www.figma.com/settings)
2. Generate a new personal access token
3. Copy the token for the next step

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```bash
# .env
FIGMA_API_KEY=your_figma_api_token_here
```

### 5. Test the Server
```bash
node index.js
```

If successful, the server will start and wait for MCP connections.

## 🔧 Setup with Cursor

### 1. Configure MCP in Cursor
Add the following to your Cursor settings (`.cursor-settings/settings.json`):

```json
{
  "mcp": {
    "servers": {
      "figma-server": {
        "command": "node",
        "args": ["path/to/your/SSE-MCP/index.js"],
        "env": {
          "FIGMA_API_KEY": "your_figma_api_token_here"
        }
      }
    }
  }
}
```

### 2. Alternative: Global Configuration
Or configure globally in your system's MCP settings file.

## 📖 Usage Guide

### 🎨 Basic Figma Design Analysis

**Analyze a single Figma design:**
```
Analyze this Figma design: https://www.figma.com/design/abc123/my-design?node-id=123-456
```

**Analyze responsive designs across viewports:**
```
Analyze these responsive designs:
- Desktop: https://www.figma.com/design/abc123/my-design?node-id=123-456
- Mobile: https://www.figma.com/design/abc123/my-design?node-id=789-012
```

### 🖼️ Download Images from Figma

**Step 1: First analyze the design to get JSON data**
```
Get design data from: https://www.figma.com/design/abc123/my-design
```

**Step 2: Extract image node IDs from the JSON response**
The AI will identify nodes with actual images (those with `type: "IMAGE"` and `imageRef` property).

**Step 3: Download the images**
```
Download images for file ID: abc123 with these node IDs: ["123-456", "789-012"]
```

### 🏗️ Convert Figma to HTML/CSS

**Complete responsive conversion:**
```
Convert this Figma design to responsive HTML/CSS:
- Desktop: https://www.figma.com/design/abc123/my-design?node-id=desktop-123
- Tablet: https://www.figma.com/design/abc123/my-design?node-id=tablet-456  
- Mobile: https://www.figma.com/design/abc123/my-design?node-id=mobile-789
```

**Single viewport conversion:**
```
Convert this mobile design to HTML: https://www.figma.com/design/abc123/my-design?node-id=123-456
```

## 🛠️ Available Tools

### 1. `figmaToHtml`
Analyzes Figma designs and provides comprehensive responsive implementation guidance.

**Parameters:**
- `desktopUrl` (optional): Desktop Figma URL
- `tabletUrl` (optional): Tablet Figma URL  
- `mobileUrl` (optional): Mobile Figma URL
- `includeImages` (default: true): Include design images in analysis
- `includeJsonData` (default: true): Include JSON design data

### 2. `downloadFigmaImages`
Downloads images from Figma designs based on node IDs.

**Parameters:**
- `fileId` (required): Figma file ID extracted from URL
- `nodeIds` (required): Array of node IDs with actual images
- `folderName` (optional): Custom folder name for downloads

## 🎯 Workflow Examples

### Complete Design-to-Code Workflow

1. **Initial Analysis:**
```
Analyze responsive design:
- Desktop: https://www.figma.com/design/abc123/homepage?node-id=1-100
- Mobile: https://www.figma.com/design/abc123/homepage?node-id=1-200
```

2. **Download Assets:**
```
Download images for homepage design (use node IDs from previous analysis)
```

3. **Generate Code:**
```
Create production-ready HTML/CSS for the homepage module
```

### Quick Single Design Conversion

```
Convert this Figma component to HTML/CSS: 
https://www.figma.com/design/abc123/components?node-id=card-component

Include:
- Responsive behavior
- Hover states  
- Accessibility features
```

## 📁 Output Structure

The MCP server creates the following structure:

```
SSE-MCP/
├── figma-downloader/           # Downloaded assets
│   ├── figma-images-2024-01-15/
│   │   ├── 123-456.png
│   │   └── 789-012.png
│   └── desktop-design.json     # Design data cache
├── utils/
│   └── transformFigmaJson.js   # JSON processing utilities
├── index.js                    # Main MCP server
└── .env                        # Environment configuration
```

## 🎨 Supported Figma URL Formats

- `https://www.figma.com/file/FILE_ID/title`
- `https://www.figma.com/design/FILE_ID/title`  
- `https://www.figma.com/file/FILE_ID/title?node-id=NODE_ID`
- `https://www.figma.com/design/FILE_ID/title?node-id=NODE_ID`

## ⚡ Best Practices

### Design Preparation
- Organize Figma designs with clear naming conventions
- Use auto-layout and constraints for responsive behavior
- Group related elements consistently
- Use consistent spacing and typography scales

### Usage Tips
- Always analyze designs before downloading images
- Use specific node IDs for targeted component conversion
- Test responsive behavior across all viewports
- Validate accessibility requirements

### Code Generation
- The AI follows mobile-first responsive design principles
- Generated code includes proper semantic HTML
- CSS uses modern layout techniques (Grid, Flexbox)
- Accessibility features are built-in (ARIA labels, semantic structure)

## 🐛 Troubleshooting

### Common Issues

**"Figma token not found" error:**
- Ensure FIGMA_API_KEY is set in your .env file
- Verify the token is valid and hasn't expired
- Check token permissions in Figma settings

**"Could not extract file ID" error:**
- Verify the Figma URL format is correct
- Ensure the file is publicly accessible or you have permission
- Try copying the URL directly from Figma

**Images not downloading:**
- Confirm node IDs come from the JSON analysis
- Check that nodes actually contain images (not just backgrounds)
- Verify file permissions and API rate limits

**MCP connection issues:**
- Restart Cursor after configuration changes
- Check MCP server logs for errors
- Verify Node.js path in configuration

### Getting Help

1. Check the server logs for detailed error messages
2. Verify your Figma API token permissions
3. Ensure all URLs are accessible and properly formatted
4. Test with a simple, public Figma file first

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and enhancement requests.

---

**Happy designing and coding! 🎨👨‍💻** 