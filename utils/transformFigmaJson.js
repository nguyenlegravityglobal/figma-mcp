import crypto from "crypto";

export function transformFigmaJson(rawData) {
  // Helper functions
  function rgbaToHex(rgba) {
    // Convert an RGBA dict into a #RRGGBB hex string (ignoring alpha)
    if (!rgba || typeof rgba !== "object") return "#000000";

    const r = Math.floor(rgba.r * 255);
    const g = Math.floor(rgba.g * 255);
    const b = Math.floor(rgba.b * 255);
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  function styleHash(styleData) {
    // Create a hash from style data to use as a unique identifier
    const styleStr = JSON.stringify(styleData, Object.keys(styleData).sort());
    return crypto.createHash("md5").update(styleStr).digest("hex");
  }

  function getColorStyleId(fills, styles) {
    // Process color styles and add them to the styles dictionary
    if (
      !fills ||
      !Array.isArray(fills) ||
      fills.length === 0 ||
      fills[0].visible === false
    ) {
      return null;
    }

    const fill = fills[0];

    if (fill.type === "SOLID" && fill.color) {
      const color = fill.color;
      const opacity = fill.opacity || 1;

      // Create a style object for color only
      const styleData = {
        color: rgbaToHex(color),
        opacity: opacity,
      };

      // Generate a unique ID for this style
      const styleId = styleHash(styleData);

      // Add to styles dictionary if not already present
      if (!styles[styleId]) {
        styles[styleId] = styleData;
      }

      return styleId;
    }

    return null;
  }

  function getTypographyStyleId(rawNode, styles) {
    // Process typography styles and add them to the styles dictionary
    if (!rawNode || rawNode.type !== "TEXT" || !rawNode.style) {
      return null;
    }

    const typographyStyle = {};
    const nodeStyle = rawNode.style;

    // Extract typography properties only
    if (nodeStyle.fontFamily) {
      typographyStyle.fontFamily = nodeStyle.fontFamily;
    }
    if (nodeStyle.fontWeight) {
      typographyStyle.fontWeight = nodeStyle.fontWeight;
    }
    if (nodeStyle.fontSize) {
      typographyStyle.fontSize = `${nodeStyle.fontSize}px`;
    }
    if (nodeStyle.lineHeightPx) {
      typographyStyle.lineHeight = `${nodeStyle.lineHeightPx}px`;
    }
    if (nodeStyle.letterSpacing) {
      typographyStyle.letterSpacing = `${nodeStyle.letterSpacing}px`;
    }
    if (nodeStyle.textAlignHorizontal) {
      const alignMap = {
        LEFT: "left",
        CENTER: "center",
        RIGHT: "right",
        JUSTIFIED: "justify",
      };
      typographyStyle.textAlign = alignMap[nodeStyle.textAlignHorizontal] || "left";
    }

    // Generate a unique ID for this style if it's not empty
    if (Object.keys(typographyStyle).length > 0) {
      const styleId = styleHash(typographyStyle);

      // Add to styles dictionary if not already present
      if (!styles[styleId]) {
        styles[styleId] = typographyStyle;
      }

      return styleId;
    }

    return null;
  }

  function transformNode(rawNode, styles) {
    // Transform a Figma node into a simplified structure with only typography and color
    if (!rawNode || typeof rawNode !== "object") {
      console.log("Invalid node:", rawNode);
      return { error: "Invalid node" };
    }

    const nodeType = rawNode.type;
    if (!nodeType) {
      console.log("Node missing type:", rawNode);
      return {
        id: rawNode.id || "unknown",
        name: rawNode.name || "Unknown Node",
      };
    }

    // Basic node properties
    const node = {
      id: rawNode.id || "unknown",
      name: rawNode.name || "Unnamed",
      type: nodeType,
      visible: rawNode.visible !== false,
    };

    // Process color styles for all nodes with fills
    if (rawNode.fills) {
      const colorStyleId = getColorStyleId(rawNode.fills, styles);
      if (colorStyleId) {
        node.colorStyleId = colorStyleId;
      }
    }

    // Process typography styles for text nodes
    if (nodeType === "TEXT") {
      const typographyStyleId = getTypographyStyleId(rawNode, styles);
      if (typographyStyleId) {
        node.typographyStyleId = typographyStyleId;
      }

      // Keep text content
      if (rawNode.characters) {
        node.characters = rawNode.characters;
      }
    }

    // Process children
    if (rawNode.children && Array.isArray(rawNode.children)) {
      node.children = [];
      for (const child of rawNode.children) {
        // Skip invisible nodes
        if (child && child.visible === false) {
          continue;
        }

        const transformedChild = transformNode(child, styles);
        if (transformedChild) {
          node.children.push(transformedChild);
        }
      }
    }

    return node;
  }

  // Initialize styles dictionary
  const styles = {};

  // Process the raw data based on Figma API response structure
  // Check if this is a nodes response
  if (rawData && rawData.nodes) {
    // Handle nodes response (from /nodes endpoint)
    const result = { nodes: {}, styles: {} };

    for (const nodeId in rawData.nodes) {
      const nodeData = rawData.nodes[nodeId];
      if (nodeData && nodeData.document) {
        result.nodes[nodeId] = transformNode(nodeData.document, styles);
      }
    }

    result.styles = styles;
    return result;
  }
  // Check if this is a direct file response
  else if (rawData && rawData.document) {
    // Handle file response (from /files endpoint)
    const document = transformNode(rawData.document, styles);

    return {
      document: document,
      styles: styles,
    };
  }
  // Fallback for other structures
  else {
    console.log(
      "Unrecognized Figma data structure, attempting direct transformation"
    );
    const document = transformNode(rawData, styles);

    return {
      document: document,
      styles: styles,
    };
  }
}


