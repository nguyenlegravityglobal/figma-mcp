/**
 * Finds all items with name "color" (case-insensitive) that are not children of other items with name "color"
 * Then cleans the output to group colors by their label with hex values
 * @param {Object} obj - The object to search through (Figma data structure)
 * @returns {Object} - Object containing colorItems and cleaned color palette
 */


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

// Convert a gradient fill to a CSS gradient string
function gradientToCss(fill) {
  if (!fill.gradientStops || !Array.isArray(fill.gradientStops) || fill.gradientStops.length === 0) {
    return null;
  }

  // Convert individual stops to CSS color stops
  const stops = fill.gradientStops.map(stop => {
    const hex = rgbaToHex(stop.color);
    const position = Math.round(stop.position * 100);
    return `${hex} ${position}%`;
  }).join(', ');

  // Handle different gradient types with proper angle/position calculations
  const gradientType = fill.type || 'GRADIENT_LINEAR';

  switch (gradientType) {
    case 'GRADIENT_LINEAR': {
      // Calculate angle from handle positions if available
      let angle = 180; // Default to top-to-bottom (180deg)
      
      if (fill.gradientHandlePositions && fill.gradientHandlePositions.length >= 2) {
        const start = fill.gradientHandlePositions[0];
        const end = fill.gradientHandlePositions[1];
        
        if (start && end && typeof start.x === 'number' && typeof start.y === 'number' 
            && typeof end.x === 'number' && typeof end.y === 'number') {
          // Calculate angle in degrees (0° points up, and increases clockwise)
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          
          // Calculate angle in radians and convert to degrees
          let radians = Math.atan2(dy, dx);
          // Convert to CSS angle (CSS uses a different coordinate system)
          let degrees = (radians * 180 / Math.PI) + 90;
          // Normalize to 0-360 range
          angle = (degrees + 360) % 360;
        }
      }
      
      return `linear-gradient(${angle}deg, ${stops})`;
    }
    
    case 'GRADIENT_RADIAL': {
      // If we have handle positions, we can calculate the center and radius
      let position = 'circle';
      
      if (fill.gradientHandlePositions && fill.gradientHandlePositions.length >= 3) {
        const center = fill.gradientHandlePositions[0];
        const radius = fill.gradientHandlePositions[1];
        
        if (center && radius && typeof center.x === 'number' && typeof center.y === 'number') {
          // Calculate position based on center
          const centerX = Math.round(center.x * 100);
          const centerY = Math.round(center.y * 100);
          position = `circle at ${centerX}% ${centerY}%`;
        }
      }
      
      return `radial-gradient(${position}, ${stops})`;
    }
    
    case 'GRADIENT_ANGULAR':
      // For angular gradients, we create a conic gradient
      // CSS conic gradients start at the top and go clockwise
      let position = 'from 0deg at center';
      
      if (fill.gradientHandlePositions && fill.gradientHandlePositions.length >= 1) {
        const center = fill.gradientHandlePositions[0];
        if (center && typeof center.x === 'number' && typeof center.y === 'number') {
          const centerX = Math.round(center.x * 100);
          const centerY = Math.round(center.y * 100);
          position = `from 0deg at ${centerX}% ${centerY}%`;
        }
      }
      
      return `conic-gradient(${position}, ${stops})`;
      
    case 'GRADIENT_DIAMOND':
      // This is a bit harder to represent exactly in CSS, so we approximate
      // using a radial gradient with the right center
      let diamondPosition = 'circle';
      
      if (fill.gradientHandlePositions && fill.gradientHandlePositions.length >= 1) {
        const center = fill.gradientHandlePositions[0];
        if (center && typeof center.x === 'number' && typeof center.y === 'number') {
          const centerX = Math.round(center.x * 100);
          const centerY = Math.round(center.y * 100);
          diamondPosition = `circle at ${centerX}% ${centerY}%`;
        }
      }
      
      return `radial-gradient(${diamondPosition}, ${stops})`;
      
    default:
      return `linear-gradient(180deg, ${stops})`;
  }
}

export function findColorItems(obj) {
  const colorItems = [];

  // Helper function to search recursively for color items
  function searchColors(item, hasColorParent = false) {
    // Check if the current item has name "color" (case insensitive)
    const isColorItem = item.name && item.name.toLowerCase() === "color";

    // If this is a color item and doesn't have a color parent, add to results
    if (isColorItem && !hasColorParent) {
      colorItems.push(item);
    }

    // Determine if children will have a color parent
    const childrenHaveColorParent = hasColorParent || isColorItem;

    // Recursively search through children if they exist
    if (item.children && Array.isArray(item.children)) {
      item.children.forEach((child) =>
        searchColors(child, childrenHaveColorParent)
      );
    }

    // Handle nested objects that might not be in a children array
    if (typeof item === "object" && item !== null) {
      Object.keys(item).forEach((key) => {
        if (
          key !== "children" &&
          typeof item[key] === "object" &&
          item[key] !== null
        ) {
          searchColors(item[key], childrenHaveColorParent);
        }
      });
    }
  }

  // Start the search from the root object to find color items
  searchColors(obj);

  // Create a clean output with the color items grouped by label
  const colorPalette = {};

  colorItems.forEach((colorItem) => {
    // Get label from the first child's name if available
    let label = 'color';
    function findLabel(item) {
      if (item.children && Array.isArray(item.children)) {
        item.children.forEach((child) => {
          if (child.name === "title") {
            if (child.children) {
              child.children.forEach((title) => {
                if (title.type === "TEXT") {
                  label = title.characters;
                }
              });
            }
          } else {
            findLabel(child);
          }
        });
      }
    }
    findLabel(colorItem);
    let index = 1;
    if (!colorPalette[label]) {
      colorPalette[label] = {};
    }
    // Find all rectangle children and their colors
    function findRectanglesAndColors(item) {
      if (item.children && Array.isArray(item.children)) {
        item.children.forEach((child) => {
          if (child.type === "RECTANGLE") {
            if (
              child.fills &&
              Array.isArray(child.fills) &&
              child.fills.length > 0
            ) {
              const fill = child.fills[0];
              
              // Handle different fill types
              if (fill.type === "SOLID" && fill.color) {
                // Regular solid color
                colorPalette[label][index * 100] = rgbaToHex(fill.color);
                index++;
              } else if (fill.type && fill.type.startsWith("GRADIENT") && fill.gradientStops) {
                // It's a gradient, convert to CSS gradient
                const gradient = gradientToCss(fill);
                if (gradient) {
                  colorPalette[label][index * 100] = gradient;
                  index++;
                }
              }
            }
          }

          // Continue searching in this child's children
          findRectanglesAndColors(child);
        });
      }
    }

    findRectanglesAndColors(colorItem);
  });
  // console.log(colorPalette);
  return colorPalette;
}
