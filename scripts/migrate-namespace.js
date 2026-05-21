import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FLOW_ROOT = path.resolve(__dirname, '..');
const V3_ROOT = path.join(FLOW_ROOT, 'v3');

console.log(`Starting namespace migration in: ${FLOW_ROOT}`);

// Helper to recursively find files matching a pattern
function getFiles(dir, filter, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        getFiles(fullPath, filter, files);
      }
    } else if (filter(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// 1. Process all package.json files in v3
const packageJsonFiles = getFiles(V3_ROOT, (name) => name === 'package.json');
// Also include the root package.json
packageJsonFiles.push(path.join(FLOW_ROOT, 'package.json'));

console.log(`Found ${packageJsonFiles.length} package.json files to migrate.`);

for (const filePath of packageJsonFiles) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let updatedContent = content;

    // Replace name of the packages
    // e.g. "@claude-flow/cli" -> "@arcanea-flow/cli"
    updatedContent = updatedContent.replace(/"@claude-flow\//g, '"@arcanea-flow/');
    
    // Replace claude-flow in filter names or run scripts
    updatedContent = updatedContent.replace(/--filter @claude-flow\//g, '--filter @arcanea-flow/');
    updatedContent = updatedContent.replace(/--filter claude-flow/g, '--filter arcanea-flow');
    
    // Replace binary command names
    updatedContent = updatedContent.replace(/"claude-flow":/g, '"arcanea-flow":');
    updatedContent = updatedContent.replace(/"claude-flow-mcp":/g, '"arcanea-flow-mcp":');

    if (updatedContent !== content) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✓ Migrated package.json: ${path.relative(FLOW_ROOT, filePath)}`);
    }
  } catch (error) {
    console.error(`Error migrating package.json at ${filePath}:`, error.message);
  }
}

// 2. Process pnpm-workspace.yaml in v3
const pnpmWorkspacePath = path.join(V3_ROOT, 'pnpm-workspace.yaml');
if (fs.existsSync(pnpmWorkspacePath)) {
  try {
    const content = fs.readFileSync(pnpmWorkspacePath, 'utf8');
    const updatedContent = content.replace(/"@claude-flow\/\*"/g, '"@arcanea-flow/*"').replace(/- "@claude-flow\/\*"/g, '- "@arcanea-flow/*"');
    if (updatedContent !== content) {
      fs.writeFileSync(pnpmWorkspacePath, updatedContent, 'utf8');
      console.log(`✓ Migrated pnpm-workspace.yaml: ${path.relative(FLOW_ROOT, pnpmWorkspacePath)}`);
    }
  } catch (error) {
    console.error(`Error migrating pnpm-workspace.yaml:`, error.message);
  }
}

// 3. Process all source files (.ts, .js, .json, .md, .yml, .yaml) for imports and mentions
const sourceFiles = getFiles(
  V3_ROOT,
  (name) => name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.json') || name.endsWith('.md') || name.endsWith('.yml') || name.endsWith('.yaml')
);

// Filter out package.json which was handled separately
const filteredSourceFiles = sourceFiles.filter((p) => !p.endsWith('package.json'));

console.log(`Found ${filteredSourceFiles.length} source/config files to check for imports/mentions.`);

let importReplaceCount = 0;
for (const filePath of filteredSourceFiles) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('@claude-flow') || content.includes('claude-flow')) {
      let updatedContent = content;
      // Replace imports: from '@claude-flow/xxx' -> from '@arcanea-flow/xxx'
      updatedContent = updatedContent.replace(/@claude-flow\//g, '@arcanea-flow/');
      
      // Replace other references where appropriate
      updatedContent = updatedContent.replace(/claude-flow-mcp/g, 'arcanea-flow-mcp');
      // Be careful about URL links or other legacy descriptions, but general renaming is good
      updatedContent = updatedContent.replace(/claude-flow/g, 'arcanea-flow');
      
      if (updatedContent !== content) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        importReplaceCount++;
      }
    }
  } catch (error) {
    console.error(`Error migrating source file at ${filePath}:`, error.message);
  }
}
console.log(`✓ Migrated imports/mentions in ${importReplaceCount} source/config files.`);
console.log('Namespace migration completed successfully!');
