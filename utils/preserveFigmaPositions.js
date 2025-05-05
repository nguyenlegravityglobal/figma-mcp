/**
 * Utility to preserve position data in Figma JSON
 * This file contains functions to ensure position data is preserved
 * when processing Figma design files
 */

import fs from 'fs';
import path from 'path';

/**
 * Check if a node has position data
 * @param {Object} node - The Figma node to check
 * @returns {boolean} - True if the node has position data
 */
function hasPositionData(node) {
  return node.x !== undefined || 
         node.y !== undefined || 
         node.absoluteBoundingBox !== undefined ||
         node.layoutPositioning !== undefined;
}

/**
 * Restore missing position data to a Figma node from the original source
 * @param {Object} node - The node to restore position data to
 * @param {Object} sourceNode - The source node containing complete position data
 * @returns {Object} - The node with restored position data
 */
function restorePositionData(node, sourceNode) {
  if (!node || !sourceNode) return node;
  
  // Copy position properties if they exist in source but not target
  const positionProps = [
    'x', 'y', 'width', 'height', 
    'absoluteBoundingBox', 'layoutPositioning',
    'constraints', 'layoutAlign', 'layoutGrow',
    'relativeTransform', 'size', 'clipsContent'
  ];
  
  for (const prop of positionProps) {
    if (sourceNode[prop] !== undefined && node[prop] === undefined) {
      node[prop] = sourceNode[prop];
    }
  }
  
  return node;
}

/**
 * Recursively restore position data for all nodes in a tree
 * @param {Object} tree - The tree to restore position data for
 * @param {Object} sourceTree - The source tree containing complete position data
 * @param {Object} [nodeMap={}] - Map of node IDs to source nodes (for internal use)
 * @returns {Object} - The tree with restored position data
 */
function restorePositionDataTree(tree, sourceTree, nodeMap = {}) {
  if (!tree || !sourceTree) return tree;
  
  // Build a map of node IDs to source nodes if not already provided
  if (Object.keys(nodeMap).length === 0) {
    buildNodeMap(sourceTree, nodeMap);
  }
  
  // Restore position data for the current node
  if (tree.id && nodeMap[tree.id]) {
    restorePositionData(tree, nodeMap[tree.id]);
  }
  
  // Recursively restore position data for children
  if (tree.children && Array.isArray(tree.children)) {
    tree.children.forEach(child => {
      restorePositionDataTree(child, sourceTree, nodeMap);
    });
  }
  
  return tree;
}

/**
 * Build a map of node IDs to nodes for faster lookups
 * @param {Object} tree - The tree to build a map for
 * @param {Object} [map={}] - The map to build (for internal use)
 * @returns {Object} - A map of node IDs to nodes
 */
function buildNodeMap(tree, map = {}) {
  if (!tree) return map;
  
  if (tree.id) {
    map[tree.id] = tree;
  }
  
  if (tree.children && Array.isArray(tree.children)) {
    tree.children.forEach(child => buildNodeMap(child, map));
  }
  
  return map;
}

/**
 * Restore position data from raw figma_data.json to optimized version
 * @param {string} optimizedPath - Path to the optimized JSON file
 * @param {string} rawPath - Path to the raw JSON file
 * @returns {Promise<Object>} - The optimized data with restored position data
 */
async function restorePositionDataToFile(optimizedPath, rawPath) {
  try {
    // Load both files
    const optimizedData = JSON.parse(fs.readFileSync(optimizedPath, 'utf8'));
    const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    
    // Determine the structure of the data
    let restored;
    
    if (optimizedData.document && rawData.document) {
      // Direct file response format
      restored = {
        ...optimizedData,
        document: restorePositionDataTree(optimizedData.document, rawData.document)
      };
    } else if (optimizedData.nodes && rawData.nodes) {
      // Nodes response format
      restored = { ...optimizedData, nodes: {} };
      
      for (const nodeId in optimizedData.nodes) {
        if (rawData.nodes[nodeId]) {
          restored.nodes[nodeId] = restorePositionDataTree(
            optimizedData.nodes[nodeId], 
            rawData.nodes[nodeId].document
          );
        } else {
          restored.nodes[nodeId] = optimizedData.nodes[nodeId];
        }
      }
    } else {
      // Unknown format, try simple restoration
      restored = restorePositionDataTree(optimizedData, rawData);
    }
    
    return restored;
  } catch (error) {
    console.error('Error restoring position data:', error);
    throw error;
  }
}

export {
  hasPositionData,
  restorePositionData,
  restorePositionDataTree,
  restorePositionDataToFile
}; 