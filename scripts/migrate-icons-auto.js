#!/usr/bin/env node

/**
 * Automated Icon Migration Script
 * Migrates Lucide icons to SF Symbols across all files
 * Skips already migrated files in tools directory
 */

const fs = require('fs');
const path = require('path');

// Icon mapping from Lucide to SF Symbols
const ICON_MAPPINGS = {
  'Plus': 'plus',
  'Minus': 'minus',
  'X': 'x',
  'Check': 'check',
  'Shuffle': 'shuffle',
  'Dice6': 'dice6',
  'Trophy': 'trophy',
  'Users': 'users',
  'RotateCcw': 'rotateccw',
  'Pen': 'pen',
  'ListFilter': 'listfilter',
  'Camera': 'camera',
  'Clock': 'clock',
  'ChevronDown': 'chevron-down',
  'ChevronUp': 'chevron-up',
  'ChevronRight': 'chevron-right',
  'ChevronLeft': 'chevron-left',
  'Calendar': 'calendar',
  'Star': 'star',
  'Baby': 'baby',
  'Brain': 'brain',
  'Loader2': 'loader2',
  'ArrowLeft': 'arrow-left',
  'Upload': 'upload',
  'UserPlus': 'user-plus',
  'Share2': 'share2',
  'Trash2': 'trash2',
  'MapPin': 'mappin',
  'Copy': 'copy',
  'BarChart3': 'barchart3',
  'Edit': 'edit',
  'Medal': 'medal',
  'Award': 'award',
  'Search': 'search',
  'Info': 'info',
  'CheckCircle': 'checkcircle',
  'SmilePlus': 'smileplus',
  'Smile': 'smile',
  'Laugh': 'laugh',
  'HelpCircle': 'helpcircle',
  'ThumbsDown': 'thumbsdown',
  'ThumbsUp': 'thumbsup',
  'Heart': 'heart',
  'Link': 'link',
  'Settings': 'settings',
  'Library': 'library',
  'User': 'user',
  'Vote': 'vote',
  'Wrench': 'wrench',
  'LogOut': 'logout',
  'CreditCard': 'creditcard',
  'ExternalLink': 'external-link',
  'Mail': 'mail',
  'LogIn': 'login',
  'RefreshCw': 'refresh',
  'Filter': 'filter',
  'CheckSquare': 'check-square',
  'Meh': 'meh',
  'AlertTriangle': 'alert-triangle',
  'SquarePen': 'square-pen',
  'Shield': 'shield',
  'CircleAlert': 'circle-alert',
  'XCircle': 'xmark-circle'
};

// Files to skip (none - we want to migrate all files)
const SKIP_FILES = [];

// Directories to scan
const SCAN_DIRS = [
  path.join(__dirname, '..', 'app'),
  path.join(__dirname, '..', 'components')
];

function shouldSkipFile(filePath) {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  return SKIP_FILES.some(skipFile => relativePath.includes(skipFile));
}

function migrateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let changesMade = 0;

    // Check if file already uses SFSymbolIcon (but still process it to ensure consistency)
    if (content.includes('SFSymbolIcon')) {
      console.log(`🔄 Processing ${filePath} - already has SFSymbolIcon, ensuring consistency`);
    }

    // Check if file has Lucide imports
    const lucideImportMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]lucide-react-native['"]/);
    if (!lucideImportMatch) {
      console.log(`⏭️  Skipping ${filePath} - no Lucide imports`);
      return { success: true, changes: 0, reason: 'no-lucide-imports' };
    }

    // Extract imported icons
    const importedIcons = lucideImportMatch[1]
      .split(',')
      .map(icon => icon.trim())
      .filter(icon => ICON_MAPPINGS[icon]);

    if (importedIcons.length === 0) {
      console.log(`⏭️  Skipping ${filePath} - no mappable icons`);
      return { success: true, changes: 0, reason: 'no-mappable-icons' };
    }

    // Replace import statement
    newContent = newContent.replace(
      /import\s*{\s*[^}]+\s*}\s*from\s*['"]lucide-react-native['"]/,
      "import SFSymbolIcon from '@/components/SFSymbolIcon';"
    );

    // Replace icon usages
    importedIcons.forEach(iconName => {
      const sfSymbolName = ICON_MAPPINGS[iconName];
      
      // Pattern 1: JSX usage: <IconName ... /> or <IconName ...></IconName>
      // Handle both self-closing and with children, with flexible spacing
      const jsxPattern = new RegExp(`<${iconName}(\\s+[^>]*?)?\\s*(/>|>.*?</${iconName}>)`, 'gs');
      
      newContent = newContent.replace(jsxPattern, (match, props, closing) => {
        changesMade++;
        
        // Extract props (handle both quoted strings and JSX expressions)
        const propsStr = props || '';
        // Match props like: size={16} or color="red" or style={styles.icon}
        const propsMatch = propsStr.match(/(\w+)=(?:{([^}]+)}|(["'])([^"']+)\3)/g);
        let extractedProps = [];
        let styleValue = null;
        
        if (propsMatch) {
          propsMatch.forEach(prop => {
            // Handle JSX expressions: size={16} or style={styles.icon}
            const jsxMatch = prop.match(/(\w+)={([^}]+)}/);
            if (jsxMatch) {
              const [, key, value] = jsxMatch;
              if (key === 'style') {
                // Store style value separately - SFSymbolIcon doesn't accept style
                styleValue = value;
              } else {
                extractedProps.push(`${key}={${value}}`);
              }
            } else {
              // Handle string values: color="red"
              const strMatch = prop.match(/(\w+)=(["'])([^"']+)\2/);
              if (strMatch) {
                const [, key, , value] = strMatch;
                extractedProps.push(`${key}="${value}"`);
              }
            }
          });
        }
        
        // Build new SFSymbolIcon props (exclude style)
        const newProps = extractedProps.join(' ');
        
        if (styleValue) {
          // Wrap in View to apply style
          return `<View style={${styleValue}}><SFSymbolIcon name="${sfSymbolName}" ${newProps ? newProps + ' ' : ''}/></View>`;
        } else {
          return `<SFSymbolIcon name="${sfSymbolName}" ${newProps ? newProps + ' ' : ''}/>`;
        }
      });
      
      // Pattern 2: Component reference in object properties: icon: IconName,
      // This converts component references to string names for use with SFSymbolIcon
      const objectPropertyPattern = new RegExp(`(\\s+)(icon|Icon)\\s*:\\s*${iconName}\\s*([,}])`, 'g');
      newContent = newContent.replace(objectPropertyPattern, (match, indent, prop, suffix) => {
        changesMade++;
        return `${indent}${prop}: "${sfSymbolName}"${suffix}`;
      });
      
      // Pattern 3: Component reference in ICON_MAP objects: IconName,
      const iconMapPattern = new RegExp(`(\\s+)(\\w+Icon|\\w+):\\s*${iconName}\\s*([,}])`, 'g');
      newContent = newContent.replace(iconMapPattern, (match, indent, key, suffix) => {
        changesMade++;
        return `${indent}${key}: "${sfSymbolName}"${suffix}`;
      });
    });
    
    // Pattern 4: Update component usage when icon is now a string
    // Replace: const IconComponent = item.icon; <IconComponent ... />
    // With: <SFSymbolIcon name={item.icon} ... />
    const componentUsagePattern = /const\s+(\w+)\s*=\s*(\w+)\.icon\s*;[\s\S]*?<(\1)\s+([^>]*?)\s*\/>/g;
    newContent = newContent.replace(componentUsagePattern, (match, varName, objName, componentName, props) => {
      // Only replace if we've converted icons to strings in this file
      if (changesMade > 0) {
        changesMade++;
        return `<SFSymbolIcon name={${objName}.icon} ${props} />`;
      }
      return match;
    });
    
    // Pattern 5: Direct component usage: <IconComponent ... /> where IconComponent comes from item.icon
    // This is a simpler pattern for cases like ToolsFooter
    newContent = newContent.replace(/<IconComponent\s+([^>]*?)\s*\/>/g, (match, props) => {
      // Check if we're in a context where icon was converted to string
      const beforeMatch = newContent.substring(0, newContent.indexOf(match));
      if (beforeMatch.includes('icon: "') && beforeMatch.includes('const IconComponent = item.icon')) {
        changesMade++;
        // Extract the object name from context
        const objMatch = beforeMatch.match(/const\s+IconComponent\s*=\s*(\w+)\.icon/);
        if (objMatch) {
          const objName = objMatch[1];
          return `<SFSymbolIcon name={${objName}.icon} ${props} />`;
        }
      }
      return match;
    });

    // Write the updated content
    if (changesMade > 0) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Migrated ${filePath} - ${changesMade} changes`);
      return { success: true, changes: changesMade };
    } else {
      console.log(`⏭️  Skipping ${filePath} - no changes needed`);
      return { success: true, changes: 0, reason: 'no-changes' };
    }

  } catch (error) {
    console.error(`❌ Error migrating ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
}

function findAndMigrateFiles() {
  console.log('🚀 Starting automated icon migration...\n');
  
  const results = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if ((file.endsWith('.tsx') || file.endsWith('.ts')) && !file.includes('SFSymbolIcon')) {
        results.total++;
        
        if (shouldSkipFile(filePath)) {
          results.skipped++;
          results.details.push({ file: filePath, status: 'skipped', reason: 'already-migrated' });
          return;
        }

        const result = migrateFile(filePath);
        results.details.push({ file: filePath, ...result });

        if (result.success) {
          if (result.changes > 0) {
            results.migrated++;
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
  console.log('\n📊 Migration Summary:');
  console.log(`Total files processed: ${results.total}`);
  console.log(`Files migrated: ${results.migrated}`);
  console.log(`Files skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);

  // Print detailed results
  if (results.details.length > 0) {
    console.log('\n📋 Detailed Results:');
    results.details.forEach(detail => {
      const status = detail.success ? (detail.changes > 0 ? '✅' : '⏭️') : '❌';
      const reason = detail.reason ? ` (${detail.reason})` : '';
      console.log(`${status} ${detail.file}${reason}`);
    });
  }

  return results;
}

// Run the migration
if (require.main === module) {
  const results = findAndMigrateFiles();
  
  if (results.errors > 0) {
    console.log('\n⚠️  Some files had errors. Please check the output above.');
    process.exit(1);
  } else {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  }
}

module.exports = { findAndMigrateFiles, migrateFile };
