import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const backendDir = process.cwd();
const zipFile = path.join(backendDir, '..', 'backend-deploy.zip');

console.log('📦 Bundling backend for cPanel deployment...');

try {
  // Use PowerShell's Compress-Archive, but we must exclude node_modules.
  const psCommand = `
    $source = '${backendDir}\\*'
    $destination = '${zipFile}'
    $exclude = @('node_modules', '.env', '.env.local', '.git')
    
    Get-ChildItem -Path $source -Exclude $exclude | Compress-Archive -DestinationPath $destination -Force
  `;
  
  console.log('Compressing to backend-deploy.zip...');
  execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`);
  
  console.log(`✅ Success! Your cPanel zip file is ready at: ${zipFile}`);
} catch (err) {
  console.error('❌ Failed to zip:', err.message);
}
