/**
 * Utility to convert Figma absolute positioning to relative/responsive positioning
 * This helps reduce file size and creates more web-friendly layouts
 */

/**
 * Convert absolute positioning to relative positioning within parent
 * @param {Object} node - The node to convert
 * @param {Object} parentBounds - Parent container bounds
 * @returns {Object} - Relative positioning data
 */
function calculateRelativePosition(node, parentBounds = null) {
  if (!node.absoluteBoundingBox) return {};
  
  const bounds = node.absoluteBoundingBox;
  const relativePos = {};
  
  if (parentBounds) {
    // Calculate position relative to parent
    const relativeX = bounds.x - parentBounds.x;
    const relativeY = bounds.y - parentBounds.y;
    
    // Convert to percentages if meaningful
    if (parentBounds.width > 0) {
      relativePos.leftPercent = ((relativeX / parentBounds.width) * 100).toFixed(2);
    }
    if (parentBounds.height > 0) {
      relativePos.topPercent = ((relativeY / parentBounds.height) * 100).toFixed(2);
    }
    
    // Width and height as percentages
    if (parentBounds.width > 0) {
      relativePos.widthPercent = ((bounds.width / parentBounds.width) * 100).toFixed(2);
    }
    if (parentBounds.height > 0) {
      relativePos.heightPercent = ((bounds.height / parentBounds.height) * 100).toFixed(2);
    }
    
    // Pixel values for small offsets
    relativePos.left = `${relativeX}px`;
    relativePos.top = `${relativeY}px`;
  }
  
  // Always include absolute dimensions as fallback
  relativePos.width = `${bounds.width}px`;
  relativePos.height = `${bounds.height}px`;
  
  return relativePos;
}

/**
 * Determine if a container should use flexbox layout
 * @param {Object} node - The node to analyze
 * @returns {boolean} - Whether to use flexbox
 */
function shouldUseFlexbox(node) {
  // Use flexbox if Figma indicates layout mode
  if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
    return true;
  }
  
  // Use flexbox for containers with multiple children in similar positions
  if (node.children && node.children.length > 1) {
    return true;
  }
  
  return false;
}

/**
 * Generate CSS flexbox properties from Figma layout
 * @param {Object} node - The node with layout properties
 * @returns {Object} - CSS flexbox properties
 */
function generateFlexboxCSS(node) {
  const flexCSS = {};
  
  if (!shouldUseFlexbox(node)) return flexCSS;
  
  flexCSS.display = 'flex';
  
  // Direction
  if (node.layoutMode === 'HORIZONTAL') {
    flexCSS.flexDirection = 'row';
  } else if (node.layoutMode === 'VERTICAL') {
    flexCSS.flexDirection = 'column';
  } else {
    // Auto-detect based on children positions
    flexCSS.flexDirection = 'column'; // Default
  }
  
  // Alignment
  if (node.primaryAxisAlignItems) {
    const alignMap = {
      'MIN': 'flex-start',
      'CENTER': 'center', 
      'MAX': 'flex-end',
      'SPACE_BETWEEN': 'space-between'
    };
    flexCSS.justifyContent = alignMap[node.primaryAxisAlignItems] || 'flex-start';
  }
  
  if (node.counterAxisAlignItems) {
    const alignMap = {
      'MIN': 'flex-start',
      'CENTER': 'center',
      'MAX': 'flex-end'
    };
    flexCSS.alignItems = alignMap[node.counterAxisAlignItems] || 'flex-start';
  }
  
  // Gap/spacing
  if (node.itemSpacing) {
    flexCSS.gap = `${node.itemSpacing}px`;
  }
  
  // Padding
  if (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom) {
    const padding = [
      node.paddingTop || 0,
      node.paddingRight || 0, 
      node.paddingBottom || 0,
      node.paddingLeft || 0
    ];
    
    if (padding.every(p => p === padding[0])) {
      flexCSS.padding = `${padding[0]}px`;
    } else {
      flexCSS.padding = padding.map(p => `${p}px`).join(' ');
    }
  }
  
  return flexCSS;
}

/**
 * Generate responsive CSS properties
 * @param {Object} node - The node to process
 * @param {Object} parentBounds - Parent container bounds
 * @returns {Object} - Responsive CSS properties
 */
function generateResponsiveCSS(node, parentBounds) {
  const css = {
    large: {},    // Desktop
    medium: {},   // Tablet
    small: {}     // Mobile
  };
  
  const relativePos = calculateRelativePosition(node, parentBounds);
  const flexCSS = generateFlexboxCSS(node);
  
  // Desktop (large) - use calculated relative positioning
  css.large = {
    ...flexCSS,
    position: shouldUseFlexbox(node) ? 'relative' : 'absolute',
    width: relativePos.widthPercent ? `${relativePos.widthPercent}%` : relativePos.width,
    height: relativePos.heightPercent ? `${relativePos.heightPercent}%` : relativePos.height
  };
  
  if (!shouldUseFlexbox(node) && relativePos.leftPercent && relativePos.topPercent) {
    css.large.left = `${relativePos.leftPercent}%`;
    css.large.top = `${relativePos.topPercent}%`;
  }
  
  // Tablet (medium) - responsive adjustments
  css.medium = {
    position: 'relative',
    width: '100%',
    height: 'auto',
    minHeight: relativePos.height
  };
  
  // Mobile (small) - stack vertically, full width
  css.small = {
    position: 'relative', 
    width: '100%',
    height: 'auto',
    minHeight: `calc(${relativePos.height} * 0.8)` // Slightly smaller on mobile
  };
  
  return css;
}

/**
 * Convert a node tree from absolute to relative positioning
 * @param {Object} node - The node to convert
 * @param {Object} parentBounds - Parent container bounds
 * @returns {Object} - Node with relative positioning
 */
function convertNodeToRelative(node, parentBounds = null) {
  if (!node || typeof node !== 'object') return node;
  
  const convertedNode = { ...node };
  
  // Generate responsive CSS
  if (node.absoluteBoundingBox) {
    convertedNode.responsiveStyles = generateResponsiveCSS(node, parentBounds);
    
    // Keep original bounds for reference but mark as processed
    convertedNode.originalBounds = node.absoluteBoundingBox;
    delete convertedNode.absoluteBoundingBox;
    
    // Remove other absolute positioning data
    delete convertedNode.relativeTransform;
    delete convertedNode.x;
    delete convertedNode.y;
  }
  
  // Process children with current node as parent
  if (convertedNode.children && Array.isArray(convertedNode.children)) {
    const currentBounds = node.absoluteBoundingBox || parentBounds;
    convertedNode.children = convertedNode.children.map(child => 
      convertNodeToRelative(child, currentBounds)
    );
  }
  
  return convertedNode;
}

/**
 * Convert entire document to relative positioning
 * @param {Object} figmaData - The Figma data to convert
 * @returns {Object} - Data with relative positioning
 */
export function convertToRelativePositioning(figmaData) {
  if (!figmaData || typeof figmaData !== 'object') {
    return figmaData;
  }
  
  const converted = { ...figmaData };
  
  // Handle nodes structure
  if (converted.nodes) {
    Object.keys(converted.nodes).forEach(nodeId => {
      const nodeData = converted.nodes[nodeId];
      
      if (nodeData.document) {
        converted.nodes[nodeId] = {
          ...nodeData,
          document: convertNodeToRelative(nodeData.document)
        };
      } else {
        converted.nodes[nodeId] = convertNodeToRelative(nodeData);
      }
    });
  }
  
  // Handle document structure  
  if (converted.document) {
    converted.document = convertNodeToRelative(converted.document);
  }
  
  return converted;
}

/**
 * Get statistics about positioning conversion
 * @param {Object} originalData - Original data with absolute positioning
 * @param {Object} convertedData - Converted data with relative positioning
 * @returns {Object} - Conversion statistics
 */
export function getPositioningStats(originalData, convertedData) {
  const originalSize = JSON.stringify(originalData).length;
  const convertedSize = JSON.stringify(convertedData).length;
  const reduction = originalSize - convertedSize;
  const reductionPercent = ((reduction / originalSize) * 100).toFixed(2);
  
  // Count positioning properties
  function countPositioningProps(obj, count = { absolute: 0, relative: 0 }) {
    if (typeof obj !== 'object' || !obj) return count;
    
    if (obj.absoluteBoundingBox) count.absolute++;
    if (obj.responsiveStyles) count.relative++;
    
    Object.values(obj).forEach(value => {
      if (typeof value === 'object') {
        countPositioningProps(value, count);
      }
    });
    
    return count;
  }
  
  const originalCounts = countPositioningProps(originalData);
  const convertedCounts = countPositioningProps(convertedData);
  
  return {
    originalSize,
    convertedSize,
    reduction,
    reductionPercent: `${reductionPercent}%`,
    compressionRatio: `${(originalSize / convertedSize).toFixed(2)}:1`,
    positioning: {
      absolute: originalCounts.absolute,
      relative: convertedCounts.relative,
      converted: originalCounts.absolute - convertedCounts.absolute
    }
  };
}

/**
 * Convert positioning and get stats in one call
 * @param {Object} figmaData - The original Figma data
 * @returns {Object} - Object containing converted data and stats
 */
export function convertWithStats(figmaData) {
  const converted = convertToRelativePositioning(figmaData);
  const stats = getPositioningStats(figmaData, converted);
  
  return {
    data: converted,
    stats
  };
} 