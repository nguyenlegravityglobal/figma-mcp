/**
 * Optimizes color format throughout the entire JSON structure
 * Converts RGBA objects to hex strings for reduced file size
 * @param {Object} data - The JSON data to optimize
 * @param {Object} options - Optimization options
 * @returns {Object} - The optimized data with hex colors
 */

export function optimizeColors(data, options = {}) {
  const {
    keepOriginalColors = false, // Whether to keep original RGBA data for reference
    convertTransparent = true,   // Whether to convert transparent colors
    minAlpha = 0.01             // Minimum alpha value to preserve (below this becomes transparent)
  } = options;

  /**
   * Convert RGBA object to hex string
   * @param {Object} rgba - RGBA color object {r, g, b, a}
   * @returns {string} - Hex color string
   */
  function rgbaToHex(rgba) {
    if (!rgba || typeof rgba !== "object") return "#000000";
    
    const r = Math.floor((rgba.r || 0) * 255);
    const g = Math.floor((rgba.g || 0) * 255);
    const b = Math.floor((rgba.b || 0) * 255);
    const a = rgba.a !== undefined ? rgba.a : 1;
    
    // Handle very low alpha values
    if (a < minAlpha && convertTransparent) {
      return "#00000000"; // Fully transparent
    }
    
    // Standard RGB for opaque colors
    if (a === 1) {
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    } 
    // RGBA hex for semi-transparent colors
    else {
      const alphaHex = Math.floor(a * 255).toString(16).padStart(2, "0");
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${alphaHex}`;
    }
  }

  /**
   * Check if object is an RGBA color object
   * @param {*} obj - Object to check
   * @returns {boolean}
   */
  function isRgbaColor(obj) {
    return (
      obj &&
      typeof obj === "object" &&
      !Array.isArray(obj) &&
      (obj.hasOwnProperty("r") || obj.hasOwnProperty("g") || obj.hasOwnProperty("b"))
    );
  }

  /**
   * Recursively traverse and optimize colors in object
   * @param {*} obj - Current object/value to process
   * @returns {*} - Processed object/value
   */
  function optimizeColorsRecursive(obj) {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    // If it's an RGBA color object, convert to hex
    if (isRgbaColor(obj)) {
      return rgbaToHex(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(optimizeColorsRecursive);
    }

    // Handle objects
    if (typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        // Special handling for color properties
        if (key === "color" && isRgbaColor(value)) {
          result[key] = rgbaToHex(value);
          // Optionally keep original RGBA for reference
          if (keepOriginalColors) {
            result.originalColor = value;
          }
        } else {
          result[key] = optimizeColorsRecursive(value);
        }
      }
      return result;
    }

    // Return primitive values as-is
    return obj;
  }

  // Start the optimization
  const optimized = optimizeColorsRecursive(data);

  return optimized;
}

/**
 * Get statistics about color optimization
 * @param {Object} originalData - Original data before optimization
 * @param {Object} optimizedData - Data after optimization
 * @returns {Object} - Statistics about the optimization
 */
export function getColorOptimizationStats(originalData, optimizedData) {
  const originalSize = JSON.stringify(originalData).length;
  const optimizedSize = JSON.stringify(optimizedData).length;
  
  function countColors(obj, colorCount = { rgba: 0, hex: 0 }) {
    if (obj === null || obj === undefined) return colorCount;
    
    if (Array.isArray(obj)) {
      obj.forEach(item => countColors(item, colorCount));
    } else if (typeof obj === "object") {
      // Count RGBA objects
      if (obj.hasOwnProperty("r") && obj.hasOwnProperty("g") && obj.hasOwnProperty("b")) {
        colorCount.rgba++;
      }
      
      // Count hex strings (basic pattern check)
      Object.values(obj).forEach(value => {
        if (typeof value === "string" && /^#[0-9A-Fa-f]{6,8}$/.test(value)) {
          colorCount.hex++;
        }
        countColors(value, colorCount);
      });
    }
    
    return colorCount;
  }

  const originalColors = countColors(originalData);
  const optimizedColors = countColors(optimizedData);
  
  return {
    fileSize: {
      original: originalSize,
      optimized: optimizedSize,
      reduction: originalSize - optimizedSize,
      reductionPercent: ((originalSize - optimizedSize) / originalSize * 100).toFixed(2)
    },
    colors: {
      original: originalColors,
      optimized: optimizedColors,
      rgbaToHexConverted: originalColors.rgba
    }
  };
}

/**
 * Preview color changes before applying optimization
 * @param {Object} data - Data to analyze
 * @returns {Array} - Array of color changes that would be made
 */
export function previewColorChanges(data) {
  const changes = [];
  
  function findColors(obj, path = "") {
    if (obj === null || obj === undefined) return;
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => findColors(item, `${path}[${index}]`));
    } else if (typeof obj === "object") {
      // Check if this is an RGBA color object
      if (obj.hasOwnProperty("r") && obj.hasOwnProperty("g") && obj.hasOwnProperty("b")) {
        const rgba = obj;
        const hex = rgbaToHex(rgba);
        changes.push({
          path: path,
          from: `rgba(${Math.floor(rgba.r * 255)}, ${Math.floor(rgba.g * 255)}, ${Math.floor(rgba.b * 255)}, ${rgba.a || 1})`,
          to: hex,
          rgba: rgba
        });
      }
      
      // Continue searching in nested objects
      Object.entries(obj).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        findColors(value, newPath);
      });
    }
  }
  
  function rgbaToHex(rgba) {
    if (!rgba || typeof rgba !== "object") return "#000000";
    
    const r = Math.floor((rgba.r || 0) * 255);
    const g = Math.floor((rgba.g || 0) * 255);
    const b = Math.floor((rgba.b || 0) * 255);
    const a = rgba.a !== undefined ? rgba.a : 1;
    
    if (a === 1) {
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    } else if (a === 0) {
      return "#00000000";
    } else {
      const alphaHex = Math.floor(a * 255).toString(16).padStart(2, "0");
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${alphaHex}`;
    }
  }
  
  findColors(data);
  return changes;
} 