import crypto from "crypto";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert an RGBA object to a hex color string
 * @param {Object} rgba - RGBA color object with r, g, b properties (0-1 range)
 * @returns {string} Hex color string in format #RRGGBB
 */
function rgbaToHex(rgba) {
  if (!rgba || typeof rgba !== "object") return "#000000";

  const r = Math.floor(rgba.r * 255);
  const g = Math.floor(rgba.g * 255);
  const b = Math.floor(rgba.b * 255);
  
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Create a unique hash from style data
 * @param {Object} styleData - Style object to hash
 * @returns {string} MD5 hash of the style data
 */
function styleHash(styleData) {
  const styleStr = JSON.stringify(styleData, Object.keys(styleData).sort());
  return crypto.createHash("md5").update(styleStr).digest("hex");
}

/**
 * Convert Figma alignment values to CSS flexbox values
 * @param {string} figmaVal - Figma alignment value
 * @returns {string} CSS flexbox alignment value
 */
function figmaAlignToFlex(figmaVal) {
  const alignMap = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    SPACE_BETWEEN: "space-between",
  };
  return alignMap[figmaVal] || "flex-start";
}

// ============================================================================
// BORDER RADIUS UTILITIES
// ============================================================================

/**
 * Extract border radius from a Figma node
 * @param {Object} rawNode - Raw Figma node
 * @returns {string|null} CSS border-radius value or null
 */
function getBorderRadius(rawNode) {
  if (rawNode.cornerRadius !== undefined) {
    return `${rawNode.cornerRadius}px`;
  }

  if (rawNode.rectangleCornerRadii) {
    const [topLeft, topRight, bottomRight, bottomLeft] = rawNode.rectangleCornerRadii;
    
    // If all corners are the same, use shorthand
    if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
      return `${topLeft}px`;
    }
    
    return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
  }

  return null;
}

/**
 * Extract corner smoothing from a Figma node
 * @param {Object} rawNode - Raw Figma node
 * @returns {string|null} CSS border-radius value for corner smoothing or null
 */
function getCornerSmoothing(rawNode) {
  if (rawNode.cornerSmoothing !== undefined && rawNode.cornerSmoothing > 0) {
    return `${rawNode.cornerSmoothing}px`;
  }
  return null;
}

// ============================================================================
// STYLE PROCESSORS
// ============================================================================

/**
 * Process fill styles and add them to the styles dictionary
 * @param {Array} fills - Array of fill objects from Figma
 * @param {Object} styles - Styles dictionary to populate
 * @returns {string|null} Style ID or null
 */
function getFillStyleId(fills, styles) {
  if (!fills || !Array.isArray(fills) || fills.length === 0 || fills[0].visible === false) {
    return null;
  }

  const fill = fills[0];

  if (fill.type === "SOLID" && fill.color) {
    const styleData = {
      backgroundColor: rgbaToHex(fill.color),
      opacity: fill.opacity || 1,
    };

    const styleId = styleHash(styleData);

    if (!styles[styleId]) {
      styles[styleId] = styleData;
    }

    return styleId;
  }

  return null;
}

/**
 * Process layout styles and add them to the styles dictionary
 * @param {Object} rawNode - Raw Figma node
 * @param {Object} styles - Styles dictionary to populate
 * @returns {string|null} Style ID or null
 */
function getLayoutStyleId(rawNode, styles) {
  if (!rawNode || typeof rawNode !== "object") return null;

  const layoutStyle = {};

  // Process layout mode (flexbox)
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
    const paddingProps = ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'];
    paddingProps.forEach(prop => {
      if (rawNode[prop] !== undefined) {
        layoutStyle[prop] = `${rawNode[prop]}px`;
      }
    });

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
  }

  // Process border radius
  const borderRadius = getBorderRadius(rawNode);
  if (borderRadius) {
    layoutStyle.borderRadius = borderRadius;
  }

  // Process corner smoothing (override border radius if present)
  const cornerSmoothing = getCornerSmoothing(rawNode);
  if (cornerSmoothing) {
    layoutStyle.borderRadius = cornerSmoothing;
  }

  // Generate style ID if we have any styles
  if (Object.keys(layoutStyle).length > 0) {
    const styleId = styleHash(layoutStyle);

    if (!styles[styleId]) {
      styles[styleId] = layoutStyle;
    }

    return styleId;
  }

  return null;
}

/**
 * Process text styles and add them to the styles dictionary
 * @param {Object} rawNode - Raw Figma node
 * @param {Object} styles - Styles dictionary to populate
 * @returns {string|null} Style ID or null
 */
function getTextStyleId(rawNode, styles) {
  if (!rawNode || rawNode.type !== "TEXT" || !rawNode.style) {
    return null;
  }

  const textStyle = {};
  const nodeStyle = rawNode.style;

  // Text property mappings
  const textProps = {
    fontFamily: 'fontFamily',
    fontWeight: 'fontWeight',
    fontSize: (val) => `${val}px`,
    lineHeightPx: (val) => `${val}px`,
    letterSpacing: (val) => `${val}px`,
  };

  // Process text properties
  Object.entries(textProps).forEach(([figmaProp, cssProp]) => {
    if (nodeStyle[figmaProp] !== undefined) {
      const value = nodeStyle[figmaProp];
      textStyle[typeof cssProp === 'function' ? figmaProp.replace(/Px$/, '') : cssProp] = 
        typeof cssProp === 'function' ? cssProp(value) : value;
    }
  });

  // Handle text alignment
  if (nodeStyle.textAlignHorizontal) {
    const alignMap = {
      LEFT: "left",
      CENTER: "center",
      RIGHT: "right",
      JUSTIFIED: "justify",
    };
    textStyle.textAlign = alignMap[nodeStyle.textAlignHorizontal] || "left";
  }

  // Process text color
  if (rawNode.fills && Array.isArray(rawNode.fills) && rawNode.fills.length > 0) {
    const fill = rawNode.fills[0];
    if (fill.type === "SOLID" && fill.color) {
      textStyle.color = rgbaToHex(fill.color);
    }
  }

  // Generate style ID if we have any styles
  if (Object.keys(textStyle).length > 0) {
    const styleId = styleHash(textStyle);

    if (!styles[styleId]) {
      styles[styleId] = textStyle;
    }

    return styleId;
  }

  return null;
}

// ============================================================================
// POSITION DATA EXTRACTOR
// ============================================================================

/**
 * Extract position-related data from a Figma node
 * @param {Object} rawNode - Raw Figma node
 * @returns {Object} Position data object
 */
function getPositionData(rawNode) {
  const positionData = {};

  // Extract bounding box data
  if (rawNode.absoluteBoundingBox) {
    const bbox = rawNode.absoluteBoundingBox;
    Object.assign(positionData, {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    });
  }

  // Extract transform and layout data
  const layoutProps = [
    'relativeTransform',
    'rotation',
    'constraints',
    'layoutAlign',
    'layoutGrow',
    'layoutPositioning'
  ];

  layoutProps.forEach(prop => {
    if (rawNode[prop] !== undefined) {
      positionData[prop] = rawNode[prop];
    }
  });

  return positionData;
}

// ============================================================================
// NODE TRANSFORMATION
// ============================================================================

/**
 * Transform a Figma node into a simplified structure
 * @param {Object} rawNode - Raw Figma node
 * @param {Object} styles - Styles dictionary to populate
 * @returns {Object} Transformed node
 */
function transformNode(rawNode, styles) {
  if (!rawNode || typeof rawNode !== "object") {
    console.warn("Invalid node:", rawNode);
    return { error: "Invalid node" };
  }

  const nodeType = rawNode.type;
  if (!nodeType) {
    console.warn("Node missing type:", rawNode);
    return {
      id: rawNode.id || "unknown",
      name: rawNode.name || "Unknown Node",
    };
  }

  // Initialize base node structure
  const node = {
    id: rawNode.id || "unknown",
    name: rawNode.name || "Unnamed",
    type: nodeType,
    visible: rawNode.visible !== false,
  };

  // Add position information
  Object.assign(node, getPositionData(rawNode));

  // Process styles
  const styleProcessors = [
    { condition: () => rawNode.fills, processor: getFillStyleId, key: 'fillStyleId' },
    { condition: () => true, processor: getLayoutStyleId, key: 'layoutStyleId' },
    { condition: () => nodeType === "TEXT", processor: getTextStyleId, key: 'textStyleId' },
  ];

  styleProcessors.forEach(({ condition, processor, key }) => {
    if (condition()) {
      const styleId = processor(rawNode, styles);
      if (styleId) {
        node[key] = styleId;
      }
    }
  });

  // Process content based on node type
  processNodeContent(rawNode, node, nodeType);

  // Process children
  if (rawNode.children && Array.isArray(rawNode.children)) {
    node.children = rawNode.children
      .filter(child => child && child.visible !== false)
      .map(child => transformNode(child, styles))
      .filter(Boolean);
  }

  // Process component properties
  processComponentProperties(rawNode, node);

  return node;
}

/**
 * Process node-specific content (text, images, etc.)
 * @param {Object} rawNode - Raw Figma node
 * @param {Object} node - Transformed node to modify
 * @param {string} nodeType - Type of the node
 */
function processNodeContent(rawNode, node, nodeType) {
  // Process text content
  if (nodeType === "TEXT" && rawNode.characters) {
    node.characters = rawNode.characters;
  }

  // Process image content
  if (nodeType === "RECTANGLE" && rawNode.fills && Array.isArray(rawNode.fills)) {
    const imageFill = rawNode.fills.find(fill => fill && fill.type === "IMAGE" && fill.imageRef);
    if (imageFill) {
      node.imageRef = imageFill.imageRef;
    }
  }
}

/**
 * Process component-related properties
 * @param {Object} rawNode - Raw Figma node
 * @param {Object} node - Transformed node to modify
 */
function processComponentProperties(rawNode, node) {
  const componentProps = [
    'componentPropertyReferences',
    'componentProperties',
    'componentPropertyDefinitions',
    'variantProperties',
    'componentSetId',
    'componentId'
  ];

  componentProps.forEach(prop => {
    if (rawNode[prop]) {
      node[prop] = rawNode[prop];
    }
  });
}

// ============================================================================
// MAIN TRANSFORMATION FUNCTIONS
// ============================================================================

/**
 * Transform Figma JSON data into a simplified structure
 * @param {Object} rawData - Raw Figma API response
 * @returns {Object} Transformed data with nodes and styles
 */
export function transformFigmaJson(rawData) {
  const styles = {};

  // Handle nodes response (from /nodes endpoint)
  if (rawData?.nodes) {
    const result = { nodes: {}, styles: {} };

    Object.entries(rawData.nodes).forEach(([nodeId, nodeData]) => {
      if (nodeData?.document) {
        result.nodes[nodeId] = transformNode(nodeData.document, styles);
      }
    });

    result.styles = styles;
    return result;
  }

  // Handle file response (from /files endpoint)
  if (rawData?.document) {
    return {
      document: transformNode(rawData.document, styles),
      styles: styles,
    };
  }

  // Fallback for other structures
  console.warn("Unrecognized Figma data structure, attempting direct transformation");
  return {
    document: transformNode(rawData, styles),
    styles: styles,
  };
}

// ============================================================================
// VARIABLES OPTIMIZATION
// ============================================================================

/**
 * Optimize Figma variables data for HTML/CSS usage
 * @param {Object} rawVariablesData - Raw variables data from Figma
 * @returns {Object} Optimized variables data
 */
export function optimizeVariablesData(rawVariablesData) {
  const optimized = {};

  if (!rawVariablesData?.meta?.variables) {
    return optimized;
  }

  const variables = rawVariablesData.meta.variables;

  Object.entries(variables).forEach(([variableId, variable]) => {
    if (isUsefulForHTML(variable)) {
      optimized[variableId] = {
        id: variable.id,
        name: variable.name,
        resolvedType: variable.resolvedType,
        valuesByMode: variable.valuesByMode,
        ...(variable.scopes && isRelevantScope(variable.scopes) && { 
          scopes: variable.scopes 
        }),
      };
    }
  });

  const originalCount = Object.keys(variables).length;
  const optimizedCount = Object.keys(optimized).length;
  const reductionPercent = Math.round((1 - optimizedCount / originalCount) * 100);

  console.log(
    `🎯 Optimized variables: ${originalCount} → ${optimizedCount} (${reductionPercent}% reduction)`
  );

  return optimized;
}

/**
 * Check if a variable is useful for HTML/CSS generation
 * @param {Object} variable - Figma variable object
 * @returns {boolean} Whether the variable is useful
 */
function isUsefulForHTML(variable) {
  const { resolvedType, name } = variable;
  const lowerName = name.toLowerCase();

  // Include colors
  if (resolvedType === "COLOR") return true;

  // Include numeric values for layout and typography
  if (resolvedType === "FLOAT") {
    const usefulKeywords = [
      'spacing', 'gap', 'padding', 'margin',
      'font', 'line height', 'letter spacing',
      'width', 'height', 'radius', 'stroke', 'opacity',
      'item spacing'
    ];
    
    return usefulKeywords.some(keyword => lowerName.includes(keyword));
  }

  // Include font family strings
  if (resolvedType === "STRING") {
    return lowerName.includes("font");
  }

  return false;
}

/**
 * Check if variable scopes are relevant for CSS
 * @param {Array} scopes - Array of scope strings
 * @returns {boolean} Whether scopes are relevant
 */
function isRelevantScope(scopes) {
  if (!Array.isArray(scopes)) return false;

  const relevantScopes = [
    "ALL_FILLS", "ALL_SCOPES", "STROKE_COLOR", "FONT_FAMILY",
    "FONT_STYLE", "LINE_HEIGHT", "GAP", "WIDTH_HEIGHT",
    "CORNER_RADIUS", "STROKE_FLOAT", "OPACITY",
  ];

  return scopes.some(scope => relevantScopes.includes(scope));
}
