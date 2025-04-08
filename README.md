# Gravity Global Figma MCP

Gravity Global Figma MCP is a tool that integrates Figma with Cursor through the Model Context Protocol (MCP), allowing you to retrieve and optimize design data from Figma for code conversion.

## Key Features

- **Figma Data Retrieval**: Get design information from Figma files using URLs or file IDs
- **Data Optimization**: Reduce JSON size by removing unnecessary properties
- **CSS Conversion**: Automatically divide and organize styles into groups (typography, colors, layouts...)
- **CSS Class Name Generation**: Automatically create meaningful class names based on properties
- **Design Tokens Extraction**: Extract typography and color tokens from Figma designs

## Installation

1. Clone the repository:
```
git clone <repository-url>
```

2. Install dependencies:
```
npm install
```

3. Create a `.env` file and add your Figma API token:
```
FIGMA_API_KEY=your_figma_api_token_here
```

4. Run the MCP server:
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

Result: The MCP will return optimized Figma data.

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

#### 3. Options

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