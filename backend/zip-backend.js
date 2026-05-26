import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const backendDir = process.cwd();
const zipFile = path.join(backendDir, '..', 'backend-deploy.zip');

console.log('📦 Bundling backend for cPanel deployment...');

try {
  // Use PowerShell's Compress-Archive, but we must exclude node_modules.
  // The easiest way on Windows without external dependencies is to copy the folder,
  // delete node_modules in the copy, zip it, and delete the copy.
  
  const tempDir = path.join(backendDir, '..', 'temp_backend_deploy');
  
  // 1. Copy backend to temp
  console.log('Copying files...');
  execSync(`xcopy "${backendDir}" "${tempDir}" /E /I /H /Y /EXCLUDE:exclude.txt`, { stdio: 'ignore' });
  
  // 2. Zip temp folder
  console.log('Compressing to backend-deploy.zip...');
  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
  execSync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipFile}'"`);
  
  // 3. Cleanup
  console.log('Cleaning up...');
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (fs.existsSync('exclude.txt')) fs.unlinkSync('exclude.txt');
  
  console.log(`✅ Success! Your cPanel zip file is ready at: ${zipFile}`);
} catch (err) {
  console.error('❌ Failed to zip:', err.message);
}
