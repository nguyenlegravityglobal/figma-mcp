/**
 * Utility to remove unnecessary metadata from Figma JSON
 * Reduces file size by removing design-specific metadata that's not needed for web rendering
 */

/**
 * List of top-level properties to remove from Figma JSON
 */
const TOP_LEVEL_METADATA_TO_REMOVE = [
  'name',
  'lastModified', 
  'thumbnailUrl',
  'version',
  'role',
  'editorType',
  'linkAccess',
  'schemaVersion'
];

/**
 * List of node-level properties to remove from each node
 */
const NODE_METADATA_TO_REMOVE = [
  'blendMode',
  'preserveRatio',
  'targetAspectRatio',
  'layoutVersion',
  'componentPropertyReferences',
  'componentPropertyDefinitions',
  'prototypeStartNodeID',
  'prototypeDevice',
  'flowStartingPoints',
  'backgrounds',
  'prototype',
  'overrides',
  'variantProperties',
  'componentId',
  'componentSetId',
  'masterComponent',
  'instances',
  'exportSettings',
  'reactions',
  'transitionNodeID',
  'transitionDuration',
  'transitionEasing',
  'opacity' // Only remove if it's 1 (default)
];

/**
 * List of properties that are arrays and should be removed if empty
 */
const EMPTY_ARRAYS_TO_REMOVE = [
  'effects',
  'interactions', 
  'reactions',
  'exportSettings',
  'backgrounds',
  'strokes',
  'strokeCaps',
  'strokeJoins',
  'strokeDashes',
  'characterStyleOverrides',
  'lineTypes',
  'lineIndentations'
];

/**
 * List of style-related properties to simplify or remove
 */
const STYLE_METADATA_TO_REMOVE = [
  'strokeWeight', // Remove if 0 or 1 (default)
  'strokeAlign',  // Remove if default
  'strokeCaps',   // Remove if default
  'strokeJoins',  // Remove if default
  'strokeMiterAngle', // Remove if default
  'textAutoResize', // Remove if default
  'textTruncation', // Remove if default
  'maxLines',     // Remove if default
  'textStyleId',  // Keep only if needed
  'fillStyleId',  // Keep only if needed
  'strokeStyleId' // Keep only if needed
];

/**
 * Remove metadata from a single node recursively
 * @param {Object} node - The node to clean
 * @returns {Object} - Cleaned node
 */
function removeNodeMetadata(node) {
  if (!node || typeof node !== 'object') return node;
  
  const cleanedNode = { ...node };
  
  // Remove node-level metadata
  NODE_METADATA_TO_REMOVE.forEach(prop => {
    delete cleanedNode[prop];
  });
  
  // Remove empty arrays
  EMPTY_ARRAYS_TO_REMOVE.forEach(prop => {
    if (Array.isArray(cleanedNode[prop]) && cleanedNode[prop].length === 0) {
      delete cleanedNode[prop];
    }
  });
  
  // Remove default opacity
  if (cleanedNode.opacity === 1) {
    delete cleanedNode.opacity;
  }
  
  // Remove default stroke properties
  if (cleanedNode.strokeWeight === 0 || cleanedNode.strokeWeight === 1) {
    delete cleanedNode.strokeWeight;
  }
  
  if (cleanedNode.strokeAlign === 'INSIDE') {
    delete cleanedNode.strokeAlign;
  }
  
  // Clean up style overrides if empty
  if (cleanedNode.styleOverrideTable && Object.keys(cleanedNode.styleOverrideTable).length === 0) {
    delete cleanedNode.styleOverrideTable;
  }
  
  // Remove redundant bounding box data (keep only absoluteBoundingBox)
  if (cleanedNode.absoluteBoundingBox && cleanedNode.absoluteRenderBounds) {
    delete cleanedNode.absoluteRenderBounds;
  }
  
  // Clean up constraints if they're default values
  if (cleanedNode.constraints && 
      cleanedNode.constraints.vertical === 'TOP' && 
      cleanedNode.constraints.horizontal === 'LEFT') {
    delete cleanedNode.constraints;
  }
  
  // Clean up layout properties if they're default
  if (cleanedNode.layoutAlign === 'INHERIT') {
    delete cleanedNode.layoutAlign;
  }
  
  if (cleanedNode.layoutGrow === 0) {
    delete cleanedNode.layoutGrow;
  }
  
  // Remove empty backgroundColor if it's transparent
  if (cleanedNode.backgroundColor && 
      cleanedNode.backgroundColor.a === 0) {
    delete cleanedNode.backgroundColor;
  }
  
  // Recursively clean children
  if (cleanedNode.children && Array.isArray(cleanedNode.children)) {
    cleanedNode.children = cleanedNode.children.map(child => removeNodeMetadata(child));
  }
  
  return cleanedNode;
}

/**
 * Remove empty or unnecessary style collections
 * @param {Object} data - The Figma data object
 * @returns {Object} - Data with cleaned styles
 */
function removeEmptyStyles(data) {
  const cleaned = { ...data };
  
  // Remove empty styles object
  if (cleaned.styles && Object.keys(cleaned.styles).length === 0) {
    delete cleaned.styles;
  }
  
  // Remove empty components object
  if (cleaned.components && Object.keys(cleaned.components).length === 0) {
    delete cleaned.components;
  }
  
  // Remove empty componentSets object
  if (cleaned.componentSets && Object.keys(cleaned.componentSets).length === 0) {
    delete cleaned.componentSets;
  }
  
  return cleaned;
}

/**
 * Main function to remove all unnecessary metadata from Figma JSON
 * @param {Object} figmaData - The original Figma JSON data
 * @param {Object} options - Configuration options
 * @param {boolean} options.preserveStyles - Whether to keep style definitions (default: false)
 * @param {boolean} options.preserveComponents - Whether to keep component definitions (default: false)
 * @param {boolean} options.preservePositioning - Whether to keep all positioning data (default: true)
 * @returns {Object} - Cleaned Figma JSON data
 */
export function removeMetadata(figmaData, options = {}) {
  const {
    preserveStyles = false,
    preserveComponents = false,
    preservePositioning = true
  } = options;
  
  if (!figmaData || typeof figmaData !== 'object') {
    return figmaData;
  }
  
  let cleaned = { ...figmaData };
  
  // Remove top-level metadata
  TOP_LEVEL_METADATA_TO_REMOVE.forEach(prop => {
    delete cleaned[prop];
  });
  
  // Handle nodes structure (when fetching specific nodes)
  if (cleaned.nodes) {
    const cleanedNodes = {};
    
    Object.keys(cleaned.nodes).forEach(nodeId => {
      const nodeData = cleaned.nodes[nodeId];
      
      if (nodeData.document) {
        cleanedNodes[nodeId] = {
          ...nodeData,
          document: removeNodeMetadata(nodeData.document)
        };
      } else {
        cleanedNodes[nodeId] = removeNodeMetadata(nodeData);
      }
    });
    
    cleaned.nodes = cleanedNodes;
  }
  
  // Handle document structure (when fetching entire file)
  if (cleaned.document) {
    cleaned.document = removeNodeMetadata(cleaned.document);
  }
  
  // Remove or clean up styles based on options
  if (!preserveStyles) {
    cleaned = removeEmptyStyles(cleaned);
  }
  
  // Remove components if not preserving them
  if (!preserveComponents) {
    delete cleaned.components;
    delete cleaned.componentSets;
  }
  
  // Additional positioning cleanup if not preserving all positioning data
  if (!preservePositioning) {
    cleaned = removeRedundantPositioning(cleaned);
  }
  
  return cleaned;
}

/**
 * Remove redundant positioning data while keeping essential layout information
 * @param {Object} data - The data to clean
 * @returns {Object} - Data with simplified positioning
 */
function removeRedundantPositioning(data) {
  function cleanPositioning(node) {
    if (!node || typeof node !== 'object') return node;
    
    const cleaned = { ...node };
    
    // Remove redundant transform data
    if (cleaned.relativeTransform && cleaned.absoluteBoundingBox) {
      delete cleaned.relativeTransform;
    }
    
    // Remove size if it's the same as bounding box
    if (cleaned.size && cleaned.absoluteBoundingBox &&
        cleaned.size.x === cleaned.absoluteBoundingBox.width &&
        cleaned.size.y === cleaned.absoluteBoundingBox.height) {
      delete cleaned.size;
    }
    
    // Recursively clean children
    if (cleaned.children && Array.isArray(cleaned.children)) {
      cleaned.children = cleaned.children.map(child => cleanPositioning(child));
    }
    
    return cleaned;
  }
  
  let cleaned = { ...data };
  
  if (cleaned.nodes) {
    Object.keys(cleaned.nodes).forEach(nodeId => {
      if (cleaned.nodes[nodeId].document) {
        cleaned.nodes[nodeId].document = cleanPositioning(cleaned.nodes[nodeId].document);
      }
    });
  }
  
  if (cleaned.document) {
    cleaned.document = cleanPositioning(cleaned.document);
  }
  
  return cleaned;
}

/**
 * Get statistics about the cleaning process
 * @param {Object} originalData - Original Figma data
 * @param {Object} cleanedData - Cleaned Figma data
 * @returns {Object} - Statistics about the cleaning
 */
export function getCleaningStats(originalData, cleanedData) {
  const originalSize = JSON.stringify(originalData).length;
  const cleanedSize = JSON.stringify(cleanedData).length;
  const reduction = originalSize - cleanedSize;
  const reductionPercent = ((reduction / originalSize) * 100).toFixed(2);
  
  return {
    originalSize,
    cleanedSize,
    reduction,
    reductionPercent: `${reductionPercent}%`,
    compressionRatio: `${(originalSize / cleanedSize).toFixed(2)}:1`
  };
}

/**
 * Convenience function to clean and get stats in one call
 * @param {Object} figmaData - The original Figma JSON data
 * @param {Object} options - Configuration options
 * @returns {Object} - Object containing cleaned data and stats
 */
export function cleanWithStats(figmaData, options = {}) {
  const cleaned = removeMetadata(figmaData, options);
  const stats = getCleaningStats(figmaData, cleaned);
  
  return {
    data: cleaned,
    stats
  };
} 