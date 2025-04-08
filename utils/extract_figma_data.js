// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// // Get the current file's directory
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

export function extractTypoItems(figmaData) {
  const typoStyles = [];
  const processedIds = new Set(); // Track processed IDs to avoid duplicates
  
  // Recursive function to traverse the JSON and find items
  function findItems(node) {
    if (node.name === "typo") {
      console.log("Found typo node:", node.id);
      
      // Process the typo component - look for both "type-style" and "typo-style" naming
      const typeStyleFrames = node.children.filter(child => 
        child.name === "type-style" || child.name === "typo-style"
      );
      console.log(`Found ${typeStyleFrames.length} style frames`);
      
      if (typeStyleFrames.length > 0) {
        // Process structured typo with style frames
        typeStyleFrames.forEach(typeStyle => {
          const titleFrame = typeStyle.children.find(child => child.name === "title");
          
          // Find TEXT type elements at same level as "title"
          const textElements = typeStyle.children.filter(child => 
            child.type === "TEXT" && child.name !== "title"
          );
          
          if (titleFrame && titleFrame.children && titleFrame.children.length > 0) {
            titleFrame.children.forEach(titleChild => {
              console.log(`Found title child: ${titleChild.name} (${titleChild.id})`);
              
              if (!processedIds.has(titleChild.id)) {
                // Determine if mobile or desktop based on ID patterns
                // IDs starting with "5532:" are for mobile, others for desktop
                const isMobile = titleChild.id.startsWith("5532:");
                const deviceType = isMobile ? "mobile" : "desktop";
                
                const style = textElements.length > 0 ? textElements[0].style : titleChild.style;
                
                // Extract only important properties
                const simplifiedStyle = {
                  fontFamily: style.fontFamily,
                  fontStyle: style.fontStyle || style.fontPostScriptName?.split('-')[1] || "",
                  fontWeight: style.fontWeight,
                  fontSize: style.fontSize,
                  letterSpacing: style.letterSpacing,
                };
                
                // Format lineHeight as a ratio string
                if (style.lineHeightPx && style.fontSize) {
                  simplifiedStyle.lineHeight = style.lineHeightPx/style.fontSize;
                }
                
                // Create a simplified object with the label and style information
                const styleInfo = {
                  label: titleChild.name,
                  style: simplifiedStyle,
                  id: titleChild.id,
                  device: deviceType
                };
                
                typoStyles.push(styleInfo);
                processedIds.add(titleChild.id);
              }
            });
          }
        });
      } else {
        // For typo nodes without style frames, look for direct TEXT children
        const textNodes = node.children.filter(child => child.type === "TEXT");
        textNodes.forEach(textNode => {
          console.log(`Found direct text node: ${textNode.name} (${textNode.id})`);
          
          if (!processedIds.has(textNode.id)) {
            const isMobile = textNode.id.startsWith("5532:");
            const deviceType = isMobile ? "mobile" : "desktop";
            
            const style = textNode.style;
            
            // Extract only important properties
            const simplifiedStyle = {
              fontFamily: style.fontFamily,
              fontStyle: style.fontStyle || style.fontPostScriptName?.split('-')[1] || "",
              fontWeight: style.fontWeight,
              fontSize: style.fontSize,
              letterSpacing: style.letterSpacing,
            };
            
            // Format lineHeight as a ratio string
            if (style.lineHeightPx && style.fontSize) {
              simplifiedStyle.lineHeight = `${style.lineHeightPx}/${style.fontSize}`;
            }
            
            const styleInfo = {
              label: textNode.name,
              style: simplifiedStyle,
              id: textNode.id,
              device: deviceType
            };
            
            typoStyles.push(styleInfo);
            processedIds.add(textNode.id);
          }
        });
      }
    }
    
    // Recursively check children if they exist
    if (node && node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        findItems(child);
      }
    }
  }
  
  if (figmaData.nodes) {
    for (const nodeId in figmaData.nodes) {
      const node = figmaData.nodes[nodeId];
      // Check if 'document' property exists
      if (node.document) {
        findItems(node.document);
      } else {
        findItems(node);
      }
    }
  }
  
  // Group items by label
  const groupedStyles = {};
  typoStyles.forEach(style => {
    if (!groupedStyles[style.label]) {
      groupedStyles[style.label] = {
        label: style.label,
        desktop: null,
        mobile: null
      };
    }
    
    if (style.device === "desktop") {
      groupedStyles[style.label].desktop = style.style;
    } else {
      groupedStyles[style.label].mobile = style.style;
    }
  });
  
  return Object.values(groupedStyles);
}

// Path to the Figma data file
// const figmaDataPath = path.join(__dirname, 'figma_data', 'figma_data.json');
// const figmaData = JSON.parse(fs.readFileSync(figmaDataPath, 'utf8'));

// // Extract the items
// try {
//   const result = extractColorAndTypoItems(figmaData);
//   console.log(`Found ${result.length} unique typography styles`);
  
//   result.forEach(item => {
//     console.log(`- ${item.label}: desktop=${!!item.desktop}, mobile=${!!item.mobile}`);
//   });
  
//   fs.writeFileSync('typo_styles.json', JSON.stringify(result, null, 2));
  
//   console.log('Results saved to typo_styles.json');
// } catch (error) {
//   console.error('Error processing Figma data:', error);
// } 