const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/pages/Agents.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Inference.tsx',
  'src/pages/Settings.tsx',
  'src/pages/Workflows.tsx',
  'src/components/AgentWorker.tsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import if not exists
    if (!content.includes("import { authenticatedFetch }")) {
      content = "import { authenticatedFetch } from '../utils/api';\n" + content;
    }
    
    // Replace fetch('/api/
    content = content.replace(/fetch\('\/api\//g, "authenticatedFetch('/api/");
    content = content.replace(/fetch\(`\/api\//g, "authenticatedFetch(`/api/");
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
