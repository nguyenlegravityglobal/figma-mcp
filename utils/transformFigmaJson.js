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

  function figmaAlignToFlex(figmaVal) {
    // Convert Figma alignment values to CSS flex values
    const alignMap = {
      MIN: "flex-start",
      CENTER: "center",
      MAX: "flex-end",
      SPACE_BETWEEN: "space-between",
    };
    return alignMap[figmaVal] || "flex-start";
  }

  function getFillStyleId(fills, styles) {
    // Process fill styles and add them to the styles dictionary
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

      // Create a style object
      const styleData = {
        backgroundColor: rgbaToHex(color),
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

  function getLayoutStyleId(rawNode, styles) {
    // Process layout styles and add them to the styles dictionary
    if (!rawNode || typeof rawNode !== "object") return null;

    const layoutStyle = {};

    // Extract layout properties
    if (rawNode.layoutMode) {
      const layoutMode = rawNode.layoutMode;

      if (layoutMode === "HORIZONTAL") {
        layoutStyle.display = "flex";
        layoutStyle.flexDirection = "row";
      } else if (layoutMode === "VERTICAL") {
        layoutStyle.display = "flex";
        layoutStyle.flexDirection = "column";
      }

      // Process padding
      if (rawNode.paddingLeft !== undefined) {
        layoutStyle.paddingLeft = `${rawNode.paddingLeft}px`;
      }
      if (rawNode.paddingRight !== undefined) {
        layoutStyle.paddingRight = `${rawNode.paddingRight}px`;
      }
      if (rawNode.paddingTop !== undefined) {
        layoutStyle.paddingTop = `${rawNode.paddingTop}px`;
      }
      if (rawNode.paddingBottom !== undefined) {
        layoutStyle.paddingBottom = `${rawNode.paddingBottom}px`;
      }

      // Process spacing
      if (rawNode.itemSpacing !== undefined) {
        layoutStyle.gap = `${rawNode.itemSpacing}px`;
      }

      // Process alignment
      if (rawNode.primaryAxisAlignItems) {
        const primaryAlign = rawNode.primaryAxisAlignItems;
        const counterAlign = rawNode.counterAxisAlignItems || "MIN";

        layoutStyle.justifyContent = figmaAlignToFlex(primaryAlign);
        layoutStyle.alignItems = figmaAlignToFlex(counterAlign);
      }
    }

    // Process size constraints
    if (rawNode.absoluteBoundingBox) {
      const bbox = rawNode.absoluteBoundingBox;
      layoutStyle.width = `${bbox.width}px`;
      layoutStyle.height = `${bbox.height}px`;
      
      // Remove position styles - we'll keep the raw position data in the node
    }

    // Process border radius
    const borderRadius = getBorderRadius(rawNode);
    if (borderRadius) {
      layoutStyle.borderRadius = borderRadius;
    }

    // Process corner smoothing
    const cornerSmoothing = getCornerSmoothing(rawNode);
    if (cornerSmoothing) {
      layoutStyle.borderRadius = cornerSmoothing;
    }

    // Generate a unique ID for this style if it's not empty
    if (Object.keys(layoutStyle).length > 0) {
      const styleId = styleHash(layoutStyle);

      // Add to styles dictionary if not already present
      if (!styles[styleId]) {
        styles[styleId] = layoutStyle;
      }

      return styleId;
    }

    return null;
  }

  function getBorderRadius(rawNode) {
    // Extract border radius from a node
    if (rawNode.cornerRadius !== undefined) {
      return `${rawNode.cornerRadius}px`;
    }
    
    // Handle rectangleCornerRadii
    if (rawNode.rectangleCornerRadii) {
      const [topLeft, topRight, bottomRight, bottomLeft] = rawNode.rectangleCornerRadii;
      if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
        return `${topLeft}px`;
      }
      return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
    }
    
    return null;
  }

  function getCornerSmoothing(rawNode) {
    // Extract corner smoothing from a node
    if (rawNode.cornerSmoothing !== undefined && rawNode.cornerSmoothing > 0) {
      return `${rawNode.cornerSmoothing}px`;
    }
    return null;
  }

  function getPositionData(rawNode) {
    // Extract position-related data from a node
    const positionData = {};
    
    // Extract absoluteBoundingBox data
    if (rawNode.absoluteBoundingBox) {
      const bbox = rawNode.absoluteBoundingBox;
      positionData.x = bbox.x;
      positionData.y = bbox.y;
      positionData.width = bbox.width;
      positionData.height = bbox.height;
    }
    
    // Extract relativeTransform data if available
    if (rawNode.relativeTransform) {
      positionData.relativeTransform = rawNode.relativeTransform;
    }
    
    // Extract rotation if available
    if (rawNode.rotation !== undefined) {
      positionData.rotation = rawNode.rotation;
    }
    
    // Extract constraints if available
    if (rawNode.constraints) {
      positionData.constraints = rawNode.constraints;
    }
    
    // Extract layoutAlign if available
    if (rawNode.layoutAlign) {
      positionData.layoutAlign = rawNode.layoutAlign;
    }
    
    // Extract layoutGrow if available
    if (rawNode.layoutGrow !== undefined) {
      positionData.layoutGrow = rawNode.layoutGrow;
    }
    
    // Extract layoutPositioning if available
    if (rawNode.layoutPositioning) {
      positionData.layoutPositioning = rawNode.layoutPositioning;
    }
    
    return positionData;
  }

  function getTextStyleId(rawNode, styles) {
    // Process text styles and add them to the styles dictionary
    if (!rawNode || rawNode.type !== "TEXT" || !rawNode.style) {
      return null;
    }

    const textStyle = {};
    const nodeStyle = rawNode.style;

    // Extract text properties
    if (nodeStyle.fontFamily) {
      textStyle.fontFamily = nodeStyle.fontFamily;
    }
    if (nodeStyle.fontWeight) {
      textStyle.fontWeight = nodeStyle.fontWeight;
    }
    if (nodeStyle.fontSize) {
      textStyle.fontSize = `${nodeStyle.fontSize}px`;
    }
    if (nodeStyle.lineHeightPx) {
      textStyle.lineHeight = `${nodeStyle.lineHeightPx}px`;
    }
    if (nodeStyle.letterSpacing) {
      textStyle.letterSpacing = `${nodeStyle.letterSpacing}px`;
    }
    if (nodeStyle.textAlignHorizontal) {
      const alignMap = {
        LEFT: "left",
        CENTER: "center",
        RIGHT: "right",
        JUSTIFIED: "justify",
      };
      textStyle.textAlign = alignMap[nodeStyle.textAlignHorizontal] || "left";
    }

    // Process fill color for text
    if (
      rawNode.fills &&
      Array.isArray(rawNode.fills) &&
      rawNode.fills.length > 0
    ) {
      const fill = rawNode.fills[0];
      if (fill.type === "SOLID" && fill.color) {
        textStyle.color = rgbaToHex(fill.color);
      }
    }

    // Generate a unique ID for this style if it's not empty
    if (Object.keys(textStyle).length > 0) {
      const styleId = styleHash(textStyle);

      // Add to styles dictionary if not already present
      if (!styles[styleId]) {
        styles[styleId] = textStyle;
      }

      return styleId;
    }

    return null;
  }

  function transformNode(rawNode, styles) {
    // Transform a Figma node into a simplified structure
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

    // Add position information
    const positionData = getPositionData(rawNode);
    Object.assign(node, positionData);

    // Process styles
    if (rawNode.fills) {
      const fillStyleId = getFillStyleId(rawNode.fills, styles);
      if (fillStyleId) {
        node.fillStyleId = fillStyleId;
      }
    }

    const layoutStyleId = getLayoutStyleId(rawNode, styles);
    if (layoutStyleId) {
      node.layoutStyleId = layoutStyleId;
    }

    const textStyleId = getTextStyleId(rawNode, styles);
    if (textStyleId) {
      node.textStyleId = textStyleId;
    }

    // Process text content
    if (nodeType === "TEXT" && rawNode.characters) {
      node.characters = rawNode.characters;
    }

    // Process image content
    if (
      nodeType === "RECTANGLE" &&
      rawNode.fills &&
      Array.isArray(rawNode.fills)
    ) {
      for (const fill of rawNode.fills) {
        if (fill && fill.type === "IMAGE" && fill.imageRef) {
          node.imageRef = fill.imageRef;
          break;
        }
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

    // Process component properties (only if they exist)
    if (rawNode.componentPropertyReferences) {
      node.componentPropertyReferences = rawNode.componentPropertyReferences;
    }

    if (rawNode.componentProperties) {
      node.componentProperties = rawNode.componentProperties;
    }

    if (rawNode.componentPropertyDefinitions) {
      node.componentPropertyDefinitions = rawNode.componentPropertyDefinitions;
    }

    if (rawNode.variantProperties) {
      node.variantProperties = rawNode.variantProperties;
    }

    if (rawNode.componentSetId) {
      node.componentSetId = rawNode.componentSetId;
    }

    if (rawNode.componentId) {
      node.componentId = rawNode.componentId;
    }

    return node;
  }

  // Initialize styles dictionary
  const styles = {};

  // Process the raw data based on Figma API response structure
  // Handle both direct file content and nodes object
  let document = null;
  let documentData = null;

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
    // console.log(
    //   `Transformed Figma nodes data with ${
    //     Object.keys(styles).length
    //   } extracted styles`
    // );
    return result;
  }
  // Check if this is a direct file response
  else if (rawData && rawData.document) {
    // Handle file response (from /files endpoint)
    document = transformNode(rawData.document, styles);

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
    document = transformNode(rawData, styles);

    return {
      document: document,
      styles: styles,
    };
  }
}

