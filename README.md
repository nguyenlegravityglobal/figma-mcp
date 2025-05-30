# Gravity Global Figma MCP

Gravity Global Figma MCP is a tool that integrates Figma with Cursor through the Model Context Protocol (MCP), allowing you to retrieve and optimize design data from Figma for code conversion and HTML-design comparison.

## Key Features

- **Figma Data Retrieval**: Get design information from Figma files using URLs or file IDs
- **Data Optimization**: Reduce JSON size by removing unnecessary properties
- **CSS Conversion**: Automatically divide and organize styles into groups (typography, colors, layouts...)
- **CSS Class Name Generation**: Automatically create meaningful class names based on properties
- **Design Tokens Extraction**: Extract typography and color tokens from Figma designs
- **HTML vs Design Comparison**: Compare HTML implementations with design mockups using browser automation

## Installation

1. Clone the repository:
```
git clone <repository-url>
```

2. Install dependencies:
```
npm install
```

3. Install Playwright for HTML comparison features:
```
npm install pixelmatch pngjs sharp
npx playwright install chromium
```

4. Create a `.env` file and add your Figma API token:
```
FIGMA_API_KEY=your_figma_api_token_here
```

5. Run the MCP server:
```
node index.js
```

## Usage

### In Cursor Chat

You can use the following tools through Cursor Chat:

#### 1. Retrieve Data from Figma

```
Get data from Figma URL https://www.figma.com/file/abc123/my-design?node-id=123-456
```

Result: The MCP will return optimized Figma data **with automatic next steps guidance** for HTML development and verification workflow.

**🔄 Complete Workflow:**
1. **Get Figma Design** → Use `figmaDesign` tool
2. **Build HTML/CSS** → Follow provided guidelines focusing on spacing, fonts, containers
3. **Verify Implementation** → **Automatically suggested**: Use `compareHtmlWithDesignAdvanced`
4. **Fix Issues** → Follow detailed recommendations
5. **Re-verify** → Repeat comparison until pixel-perfect

#### 2. Extract Design Tokens

```
Extract typography and color tokens from Figma URL https://www.figma.com/file/abc123/my-design
```

Result: The MCP will return a JSON object containing typography and color tokens extracted from the Figma design.

Example response:
```json
{
  "typography": {
    "opensans-600-32": {
      "fontFamily": "Open Sans",
      "fontSize": "32px",
      "fontWeight": 600,
      "lineHeight": "48px"
    },
    "avenirnext-400-16": {
      "fontFamily": "Avenir Next",
      "fontSize": "16px",
      "fontWeight": 400,
      "lineHeight": "24px"
    }
  },
  "colors": {
    "bg-ffffff": "#ffffff",
    "text-030e12": "#030e12"
  }
}
```

#### 3. Compare HTML with Design (NEW!)

```
Compare HTML file ./index.html with design image ./design.png
```

Result: The MCP will take a screenshot of the HTML file and compare it with the design image, providing both images for visual comparison.

#### 4. Advanced HTML vs Design Comparison (NEW!)

```
Compare HTML file ./index.html with design ./design.png using viewport 1440x900 and selector .main-content
```

Result: Advanced comparison with customizable options including viewport size, CSS selectors, timing controls, and **pixel-level image analysis with layout-focused comparison**.

**Key Features:**
- **Layout-focused analysis** that ignores colors and focuses on structure
- **Pixel-perfect comparison** with similarity percentage
- **Diff image generation** highlighting structural differences in red
- **Automatic grayscale conversion** to focus on spacing, typography, positioning
- **Smart threshold** to ignore minor antialiasing differences
- **Layout-specific recommendations** for spacing, typography, and positioning issues
- **Auto viewport sizing** based on design image dimensions for accurate comparison

**Layout-Focused Options:**
- `layoutFocused: true` - Focus on structure, ignore colors
- `ignoreColors: true` - Convert to grayscale
- `threshold: 0.2` - Higher threshold for layout comparison

**Available Parameters for Advanced HTML Comparison:**
- `viewportWidth/Height`: Browser viewport dimensions
- `selector`: CSS selector for specific elements to screenshot
- `fullPage`: Whether to capture the full page or just the viewport
- `waitForSelector`: Wait for specific elements before capturing
- `delay`: Delay before taking screenshot (useful for animations)

#### 5. Standalone Image Comparison (NEW!)

```
Compare image ./screenshot1.png with ./screenshot2.png with layout focus
```

Result: Direct pixel-level comparison between any two images with **layout-focused analysis** option to ignore colors and focus on structural differences.

#### 6. Detailed Difference Analysis (NEW!)

```
Analyze differences between HTML screenshot and design with specific fix suggestions
```

Result: **Intelligent analysis** of detected differences with categorized issues, severity levels, and **specific CSS fix recommendations** prioritized by importance.

**Analysis Features:**
- **Automatic issue detection** (alignment, spacing, typography, layout)
- **Area distribution analysis** (top/middle/bottom sections)
- **Severity classification** (Major/Moderate/Minor)
- **Specific fix suggestions** with CSS properties to check
- **Priority-ordered recommendations** for efficient fixing

**Layout-Focused Options:**
- `layoutFocused: true` - Focus on structure, ignore colors
- `ignoreColors: true` - Convert to grayscale
- `threshold: 0.2` - Higher threshold for layout comparison

#### 7. Options

- **figmaDesign tool**:
  - **fullJson=true**: Returns full uncompressed JSON data
  - **cleanData=true**: Removes unnecessary properties for HTML/CSS rendering

- **figmaTokens tool**:
  - **tokenTypes=["typography"]**: Only extract typography tokens
  - **tokenTypes=["colors"]**: Only extract color tokens
  - **tokenTypes=["typography", "colors"]**: Extract both (default)

Example:
```
Extract only color tokens from Figma URL https://www.figma.com/file/abc123/my-design
```

## Data Structure

The converted Figma data has the following structure:

```json
{
  "nodes": {
    "nodeId": {
      "id": "nodeId",
      "name": "Node Name",
      "type": "FRAME",
      "fillStyleId": "style123",
      "layoutStyleId": "style456",
      "children": [...]
    }
  },
  "styles": {
    "style123": {
      "backgroundColor": "#ffffff",
      "opacity": 1,
      "categories": { "colors": "color1" }
    }
  },
  "optimizedStyles": {
    "typography": {...},
    "colors": {...},
    "layout": {...},
    "spacing": {...},
    "sizing": {...}
  },
  "classNames": {
    "style123": "bg-1",
    "style456": "flex-row-1"
  }
}
```

## Technical Details

### Figma Data Retrieval

The tool uses the Figma REST API to fetch design data. It supports URLs from both regular files and new design URLs. You can specify a particular node using `node-id`.

### Data Optimization

The optimization process includes these steps:
1. Removing unnecessary properties
2. Dividing styles into groups (typography, colors, layout...)
3. Merging similar styles to reduce duplication
4. Automatically generating CSS class names

### Token Extraction

The token extraction process:
1. Identifies typography and color styles used in the design
2. Creates standardized naming conventions for each token
3. Groups tokens by type (typography or colors)
4. Removes duplicates and organizes them for easy integration with design systems

### Limitations

- MCP has limitations on the size of returned data; large files will be saved to the `figma_data` directory
- Complex vector properties are not fully preserved
- Complex gradients and effects may require additional processing

## License

MIT License 