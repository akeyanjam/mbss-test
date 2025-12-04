/**
 * Build script for production deployment
 * Creates a single dist/ folder with backend/, frontend/, and tests/ subdirectories
 */

import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = __dirname;
const distDir = resolve(rootDir, 'dist');

console.log('🏗️  Building MBSS Portal for Production\n');
console.log('='.repeat(60));

// Clean dist folder
if (existsSync(distDir)) {
  console.log('\n🗑️  Cleaning old dist folder...');
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(distDir, { recursive: true });

// Build backend
console.log('\n📦 Building backend...');
console.log('-'.repeat(60));
try {
  execSync('npm run build', { cwd: resolve(rootDir, 'portal/backend'), stdio: 'inherit' });
  
  // Copy backend dist
  const backendSrc = resolve(rootDir, 'portal/backend/dist');
  const backendDest = resolve(distDir, 'backend');
  cpSync(backendSrc, backendDest, { recursive: true });
  
  // Copy backend config
  const configSrc = resolve(rootDir, 'portal/backend/config');
  const configDest = resolve(backendDest, 'config');
  cpSync(configSrc, configDest, { recursive: true });
  
  // Copy backend package files
  cpSync(resolve(rootDir, 'portal/backend/package.json'), resolve(backendDest, 'package.json'));
  cpSync(resolve(rootDir, 'portal/backend/package-lock.json'), resolve(backendDest, 'package-lock.json'));
  
  console.log('✅ Backend built successfully');
} catch (error) {
  console.error('❌ Backend build failed');
  process.exit(1);
}

// Build tests
console.log('\n📦 Building tests...');
console.log('-'.repeat(60));
try {
  execSync('npm run build', { cwd: resolve(rootDir, 'tests'), stdio: 'inherit' });
  
  // Copy tests dist
  const testsSrc = resolve(rootDir, 'tests/dist-tests');
  const testsDest = resolve(distDir, 'tests');
  cpSync(testsSrc, testsDest, { recursive: true });
  
  console.log('✅ Tests built successfully');
} catch (error) {
  console.error('❌ Tests build failed');
  process.exit(1);
}

// Build frontend (placeholder for now)
console.log('\n📦 Building frontend...');
console.log('-'.repeat(60));
const frontendDest = resolve(distDir, 'frontend');
mkdirSync(frontendDest, { recursive: true });
console.log('⚠️  Frontend build not implemented yet (placeholder created)');

// Create data folder
console.log('\n📦 Creating data folder...');
console.log('-'.repeat(60));
const dataDir = resolve(distDir, '../data');
mkdirSync(dataDir, { recursive: true });
mkdirSync(resolve(dataDir, 'artifacts'), { recursive: true });
console.log('✅ Data folder created');

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ Build Complete!\n');
console.log('📁 Output structure:');
console.log('   dist/');
console.log('   ├── backend/      (Node.js backend)');
console.log('   ├── tests/        (Built Playwright tests)');
console.log('   └── frontend/     (UI - placeholder)');
console.log('   data/');
console.log('   ├── mbss.db       (SQLite database - created on first run)');
console.log('   └── artifacts/    (Test artifacts)\n');
console.log('📝 Next steps:');
console.log('   1. Copy dist/ folder to target server');
console.log('   2. cd dist/backend && npm install --production');
console.log('   3. node dist/backend/index.js\n');
