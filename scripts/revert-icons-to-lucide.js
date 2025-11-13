#!/usr/bin/env node

/**
 * Reverse Icon Migration Script
 * Converts SFSymbolIcon components back to Lucide React components for Expo testing
 */

const fs = require('fs');
const path = require('path');

// Reverse mapping from SF Symbol names (lowercase/kebab-case) to Lucide component names (PascalCase)
const REVERSE_ICON_MAPPINGS = {
  'plus': 'Plus',
  'minus': 'Minus',
  'x': 'X',
  'check': 'Check',
  'shuffle': 'Shuffle',
  'dice6': 'Dice6',
  'trophy': 'Trophy',
  'users': 'Users',
  'rotateccw': 'RotateCcw',
  'pen': 'Pen',
  'listfilter': 'ListFilter',
  'camera': 'Camera',
  'clock': 'Clock',
  'chevron-down': 'ChevronDown',
  'chevron-up': 'ChevronUp',
  'chevron-right': 'ChevronRight',
  'chevron-left': 'ChevronLeft',
  'calendar': 'Calendar',
  'star': 'Star',
  'baby': 'Baby',
  'brain': 'Brain',
  'loader2': 'Loader2',
  'arrow-left': 'ArrowLeft',
  'upload': 'Upload',
  'user-plus': 'UserPlus',
  'share2': 'Share2',
  'trash2': 'Trash2',
  'mappin': 'MapPin',
  'copy': 'Copy',
  'barchart3': 'BarChart3',
  'edit': 'Edit',
  'medal': 'Medal',
  'award': 'Award',
  'search': 'Search',
  'info': 'Info',
  'checkcircle': 'CheckCircle',
  'smileplus': 'SmilePlus',
  'smile': 'Smile',
  'laugh': 'Laugh',
  'helpcircle': 'HelpCircle',
  'thumbsdown': 'ThumbsDown',
  'thumbsup': 'ThumbsUp',
  'heart': 'Heart',
  'link': 'Link',
  'settings': 'Settings',
  'library': 'Library',
  'user': 'User',
  'vote': 'Vote',
  'wrench': 'Wrench',
  'logout': 'LogOut',
  'creditcard': 'CreditCard',
  'external-link': 'ExternalLink',
  'mail': 'Mail',
  'login': 'LogIn',
  'refresh': 'RefreshCw',
  'filter': 'Filter',
  'check-square': 'CheckSquare',
  'meh': 'Meh',
  'alert-triangle': 'AlertTriangle',
  'square-pen': 'SquarePen',
  'shield': 'Shield',
  'circle-alert': 'CircleAlert',
  'xmark-circle': 'XCircle'
};

// Directories to scan
const SCAN_DIRS = [
  path.join(__dirname, '..', 'app'),
  path.join(__dirname, '..', 'components')
];

function shouldSkipFile(filePath) {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  // Skip the SFSymbolIcon component itself and the migration scripts
  return relativePath.includes('SFSymbolIcon.tsx') || 
         relativePath.includes('migrate-icons') ||
         relativePath.includes('revert-icons');
}

function revertFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let changesMade = 0;
    const usedIcons = new Set();

    // Check if file uses SFSymbolIcon
    if (!content.includes('SFSymbolIcon')) {
      return { success: true, changes: 0, reason: 'no-sfsymbol-icon' };
    }

    // Pattern 1: JSX usage with string literal: <SFSymbolIcon name="x" ... />
    const jsxPattern = /<SFSymbolIcon\s+name=["']([^"']+)["']\s+([^>]*?)\s*\/>/g;
    newContent = newContent.replace(jsxPattern, (match, iconName, props) => {
      const lucideName = REVERSE_ICON_MAPPINGS[iconName];
      if (!lucideName) {
        console.warn(`⚠️  No mapping found for icon: ${iconName} in ${filePath}`);
        return match;
      }

      changesMade++;
      usedIcons.add(lucideName);

      // Extract and preserve props (size, color, etc.)
      // Filter out SFSymbolIcon-specific props (multicolor, weight, scale)
      const propsStr = props || '';
      const validProps = [];
      
      // Match props like: size={16} or color={colors.text} or size={24} color={tool.color}
      const propMatches = propsStr.match(/(\w+)=(?:{([^}]+)}|(["'])([^"']+)\3)/g);
      if (propMatches) {
        propMatches.forEach(prop => {
          const jsxMatch = prop.match(/(\w+)={([^}]+)}/);
          if (jsxMatch) {
            const [, key, value] = jsxMatch;
            // Only preserve size and color (Lucide icons don't support multicolor, weight, scale)
            if (key === 'size' || key === 'color') {
              validProps.push(`${key}={${value}}`);
            }
          } else {
            const strMatch = prop.match(/(\w+)=(["'])([^"']+)\2/);
            if (strMatch) {
              const [, key, , value] = strMatch;
              if (key === 'size' || key === 'color') {
                validProps.push(`${key}="${value}"`);
              }
            }
          }
        });
      }

      const propsString = validProps.length > 0 ? ' ' + validProps.join(' ') : '';
      return `<${lucideName}${propsString} />`;
    });

    // Pattern 2: JSX usage with variable: <SFSymbolIcon name={tool.icon} ... />
    // This needs special handling - we'll convert back to component reference pattern
    const variablePattern = /<SFSymbolIcon\s+name={([^}]+)}\s+([^>]*?)\s*\/>/g;
    newContent = newContent.replace(variablePattern, (match, varName, props) => {
      changesMade++;
      
      // Extract props
      const propsStr = props || '';
      const validProps = [];
      const propMatches = propsStr.match(/(\w+)=(?:{([^}]+)}|(["'])([^"']+)\3)/g);
      if (propMatches) {
        propMatches.forEach(prop => {
          const jsxMatch = prop.match(/(\w+)={([^}]+)}/);
          if (jsxMatch) {
            const [, key, value] = jsxMatch;
            if (key === 'size' || key === 'color') {
              validProps.push(`${key}={${value}}`);
            }
          } else {
            const strMatch = prop.match(/(\w+)=(["'])([^"']+)\2/);
            if (strMatch) {
              const [, key, , value] = strMatch;
              if (key === 'size' || key === 'color') {
                validProps.push(`${key}="${value}"`);
              }
            }
          }
        });
      }

      // For variable usage, we need to convert the icon property back to component reference
      // This is complex - we'll need to find where the icon is defined and convert it
      // For now, we'll create a component reference pattern
      const propsString = validProps.length > 0 ? ' ' + validProps.join(' ') : '';
      
      // Try to extract the object name (e.g., tool.icon -> tool)
      const objMatch = varName.match(/(\w+)\.icon/);
      if (objMatch) {
        const objName = objMatch[1];
        // We'll need to convert icon strings back to components in the object definition
        // For now, create a component reference
        return `<IconComponent${propsString} />`;
      }
      
      return match;
    });

    // Pattern 3: String references in objects: icon: "shuffle"
    const stringRefPattern = /(\s+)(icon|Icon)\s*:\s*["']([^"']+)["']\s*([,}])/g;
    newContent = newContent.replace(stringRefPattern, (match, indent, prop, iconName, suffix) => {
      const lucideName = REVERSE_ICON_MAPPINGS[iconName];
      if (!lucideName) {
        return match;
      }
      changesMade++;
      usedIcons.add(lucideName);
      return `${indent}${prop}: ${lucideName}${suffix}`;
    });

    // Pattern 4: ICON_MAP entries: voteType1Icon: "laugh"
    const iconMapPattern = /(\s+)(\w+Icon|\w+)\s*:\s*["']([^"']+)["']\s*([,}])/g;
    newContent = newContent.replace(iconMapPattern, (match, indent, key, iconName, suffix) => {
      const lucideName = REVERSE_ICON_MAPPINGS[iconName];
      if (!lucideName) {
        return match;
      }
      changesMade++;
      usedIcons.add(lucideName);
      return `${indent}${key}: ${lucideName}${suffix}`;
    });

    // Pattern 5: Handle View wrappers that were added for style props
    // Remove: <View style={styles.titleCalendarIcon}><SFSymbolIcon name="calendar" ... /></View>
    // Replace with: <Calendar ... style={styles.titleCalendarIcon} />
    // Note: Original code had style directly on Lucide icons, so we restore that pattern
    const viewWrapperPattern = /<View\s+style={([^}]+)}>\s*<SFSymbolIcon\s+name=["']([^"']+)["']\s+([^>]*?)\s*\/>\s*<\/View>/g;
    newContent = newContent.replace(viewWrapperPattern, (match, style, iconName, props) => {
      const lucideName = REVERSE_ICON_MAPPINGS[iconName];
      if (!lucideName) {
        return match;
      }
      changesMade++;
      usedIcons.add(lucideName);
      
      // Extract props and add style
      const propsStr = props || '';
      const validProps = [];
      
      // Extract other props first
      const propMatches = propsStr.match(/(\w+)=(?:{([^}]+)}|(["'])([^"']+)\3)/g);
      if (propMatches) {
        propMatches.forEach(prop => {
          const jsxMatch = prop.match(/(\w+)={([^}]+)}/);
          if (jsxMatch) {
            const [, key, value] = jsxMatch;
            if (key === 'size' || key === 'color') {
              validProps.push(`${key}={${value}}`);
            }
          } else {
            const strMatch = prop.match(/(\w+)=(["'])([^"']+)\2/);
            if (strMatch) {
              const [, key, , value] = strMatch;
              if (key === 'size' || key === 'color') {
                validProps.push(`${key}="${value}"`);
              }
            }
          }
        });
      }
      
      // Add style prop last (original code had it directly on the icon)
      validProps.push(`style={${style}}`);
      
      return `<${lucideName} ${validProps.join(' ')} />`;
    });

    // Pattern 6: Handle variable usage: <SFSymbolIcon name={tool.icon} ... />
    // First, find and convert the object definitions (icon: "shuffle" -> icon: Shuffle)
    // This is already handled in Pattern 3, but we need to handle the usage separately
    
    // Pattern 7: Convert variable usage back to component reference
    // <SFSymbolIcon name={tool.icon as SFSymbolIconProps['name']} ... /> 
    // -> const IconComponent = tool.icon; <IconComponent ... />
    // where tool.icon should now be a component after Pattern 3
    // We need to collect all variable usages first, then add const declarations
    const variableIconPattern = /<SFSymbolIcon\s+name={(\w+)\.icon(?:\s+as\s+[^}]+)?}\s+([^>]*?)\s*\/>/g;
    const variableUsages = [];
    let match;
    
    // First, collect all variable usages with their context
    while ((match = variableIconPattern.exec(newContent)) !== null) {
      const [fullMatch, objName, props] = match;
      const matchIndex = match.index;
      
      // Extract props
      const propsStr = props || '';
      const validProps = [];
      const propMatches = propsStr.match(/(\w+)=(?:{([^}]+)}|(["'])([^"']+)\3)/g);
      if (propMatches) {
        propMatches.forEach(prop => {
          const jsxMatch = prop.match(/(\w+)={([^}]+)}/);
          if (jsxMatch) {
            const [, key, value] = jsxMatch;
            if (key === 'size' || key === 'color') {
              validProps.push(`${key}={${value}}`);
            }
          }
        });
      }
      
      // Find the context - look backwards to find the map function start
      const beforeMatch = newContent.substring(0, matchIndex);
      const mapMatch = beforeMatch.match(/(\{[^}]*\.map\(\((\w+)(?:,\s*\w+)?\)\s*=>\s*\{)/);
      
      variableUsages.push({
        fullMatch,
        objName,
        props: validProps,
        matchIndex,
        mapMatch: mapMatch ? {
          index: mapMatch.index,
          length: mapMatch[0].length,
          varName: mapMatch[2]
        } : null
      });
    }
    
    // Now process in reverse order (so indices don't shift)
    variableUsages.reverse().forEach(usage => {
      changesMade++;
      
      // Replace the SFSymbolIcon usage
      const propsString = usage.props.length > 0 ? ' ' + usage.props.join(' ') : '';
      newContent = newContent.substring(0, usage.matchIndex) + 
        `<IconComponent${propsString} />` + 
        newContent.substring(usage.matchIndex + usage.fullMatch.length);
      
      // Add const declaration if we found a map function and it's not already there
      if (usage.mapMatch) {
        const mapStart = usage.mapMatch.index + usage.mapMatch.length;
        const afterMapStart = newContent.substring(mapStart, usage.matchIndex);
        
        // Check if IconComponent is already defined in this map iteration
        if (!afterMapStart.includes('const IconComponent')) {
          // Find where to insert - right after the map function opening brace
          // Look for the first return or JSX element
          const returnMatch = afterMapStart.match(/(\s+)(return|<\w+)/);
          if (returnMatch) {
            const insertIndex = mapStart + returnMatch.index + returnMatch[1].length;
            const indent = returnMatch[1];
            // Insert the const declaration
            newContent = newContent.slice(0, insertIndex) + 
              `\n${indent}const IconComponent = ${usage.objName}.icon;` + 
              newContent.slice(insertIndex);
          }
        }
      }
    });

    // Pattern 8: Restore IconComponent usage where icon is now a component
    // After Pattern 7 creates IconComponent, and Pattern 3 converts icon strings to components,
    // we can use the component directly
    // This pattern finds: const IconComponent = tool.icon; ... <IconComponent ... />
    // and ensures it's properly formatted
    const iconComponentUsagePattern = /const\s+IconComponent\s*=\s*(\w+)\.icon\s*;[\s\S]*?<IconComponent\s+([^>]*?)\s*\/>/g;
    newContent = newContent.replace(iconComponentUsagePattern, (match, objName, props) => {
      // The icon property should already be converted to a component by Pattern 3
      // So we can use it directly - the pattern is already correct
      return match; // No change needed, just ensure it's processed
    });

    // Clean up extra semicolons (common issue after import removal)
    newContent = newContent.replace(/;\s*;/g, ';');
    newContent = newContent.replace(/;\s*\n\s*;/g, ';\n');
    
    // Update imports
    // Remove SFSymbolIcon imports
    newContent = newContent.replace(/import\s+SFSymbolIcon(?:\s*,\s*\{[^}]*SFSymbolIconProps[^}]*\})?\s+from\s+['"]@\/components\/SFSymbolIcon['"];?\s*/g, '');
    
    // Remove SFSymbolIconProps type imports if standalone
    newContent = newContent.replace(/import\s*{\s*SFSymbolIconProps\s*}\s+from\s+['"]@\/components\/SFSymbolIcon['"];?\s*/g, '');
    
    // Add Lucide imports if we have used icons
    if (usedIcons.size > 0) {
      const lucideImports = Array.from(usedIcons).sort().join(', ');
      
      // Check if there's already a Lucide import
      const existingLucideImport = newContent.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]lucide-react-native['"]/);
      
      if (existingLucideImport) {
        // Merge with existing imports
        const existingIcons = existingLucideImport[1]
          .split(',')
          .map(i => i.trim())
          .filter(i => i);
        const allIcons = [...new Set([...existingIcons, ...Array.from(usedIcons)])].sort();
        newContent = newContent.replace(
          /import\s*{\s*[^}]+\s*}\s*from\s*['"]lucide-react-native['"]/,
          `import { ${allIcons.join(', ')} } from 'lucide-react-native'`
        );
      } else {
        // Add new import at the top (after React imports)
        const importMatch = newContent.match(/(import\s+[^;]+;[\s\n]*)+/);
        if (importMatch) {
          const lastImport = importMatch[0].trim().split('\n').pop();
          const lastImportIndex = newContent.indexOf(lastImport) + lastImport.length;
          newContent = newContent.slice(0, lastImportIndex) + 
            `\nimport { ${lucideImports} } from 'lucide-react-native';` + 
            newContent.slice(lastImportIndex);
        } else {
          // No imports found, add at the beginning
          newContent = `import { ${lucideImports} } from 'lucide-react-native';\n${newContent}`;
        }
      }
    }


    // Write the updated content
    if (changesMade > 0) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Reverted ${filePath} - ${changesMade} changes, ${usedIcons.size} icons`);
      return { success: true, changes: changesMade, icons: Array.from(usedIcons) };
    } else {
      console.log(`⏭️  Skipping ${filePath} - no changes needed`);
      return { success: true, changes: 0, reason: 'no-changes' };
    }

  } catch (error) {
    console.error(`❌ Error reverting ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
}

function findAndRevertFiles() {
  console.log('🔄 Starting reverse icon migration (SFSymbolIcon → Lucide)...\n');
  
  const results = {
    total: 0,
    reverted: 0,
    skipped: 0,
    errors: 0,
    details: [],
    allIcons: new Set()
  };

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if ((file.endsWith('.tsx') || file.endsWith('.ts')) && !shouldSkipFile(filePath)) {
        results.total++;
        
        const result = revertFile(filePath);
        results.details.push({ file: filePath, ...result });

        if (result.success) {
          if (result.changes > 0) {
            results.reverted++;
            if (result.icons) {
              result.icons.forEach(icon => results.allIcons.add(icon));
            }
          } else {
            results.skipped++;
          }
        } else {
          results.errors++;
        }
      }
    });
  }

  // Scan all directories
  SCAN_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
      scanDirectory(dir);
    }
  });

  // Print summary
  console.log('\n📊 Reversion Summary:');
  console.log(`Total files processed: ${results.total}`);
  console.log(`Files reverted: ${results.reverted}`);
  console.log(`Files skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);
  console.log(`Unique icons used: ${results.allIcons.size}`);

  // Print detailed results
  if (results.details.length > 0) {
    console.log('\n📋 Detailed Results:');
    results.details.forEach(detail => {
      const status = detail.success ? (detail.changes > 0 ? '✅' : '⏭️') : '❌';
      const reason = detail.reason ? ` (${detail.reason})` : '';
      const icons = detail.icons ? ` [${detail.icons.join(', ')}]` : '';
      console.log(`${status} ${detail.file}${reason}${icons}`);
    });
  }

  return results;
}

// Run the reversion
if (require.main === module) {
  const results = findAndRevertFiles();
  
  if (results.errors > 0) {
    console.log('\n⚠️  Some files had errors. Please check the output above.');
    process.exit(1);
  } else {
    console.log('\n🎉 Reverse migration completed successfully!');
    console.log('\n⚠️  Note: You may need to manually fix:');
    console.log('   - Variable icon usage (e.g., <SFSymbolIcon name={tool.icon} />)');
    console.log('   - ICON_MAP type definitions');
    console.log('   - Component reference patterns that use IconComponent');
    process.exit(0);
  }
}

module.exports = { findAndRevertFiles, revertFile };

