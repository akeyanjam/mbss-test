/**
 * Copy built tests from the test project to the backend's dist-tests folder
 * This is used for local development.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const testProjectRoot = resolve(__dirname, '../../../tests');
const testProjectDist = resolve(testProjectRoot, 'dist-tests');
const backendRoot = resolve(__dirname, '..');
const backendTestDest = resolve(backendRoot, 'dist-tests');

console.log('📦 Copying built tests to backend...\n');
console.log(`   Source: ${testProjectDist}`);
console.log(`   Destination: ${backendTestDest}\n`);

// Check if test dist exists
if (!existsSync(testProjectDist)) {
  console.error('❌ Test project dist-tests folder not found!');
  console.error('   Please build the test project first:');
  console.error('   cd tests && npm run build\n');
  process.exit(1);
}

// Remove old dist-tests if exists
if (existsSync(backendTestDest)) {
  console.log('🗑️  Removing old dist-tests...');
  rmSync(backendTestDest, { recursive: true, force: true });
}

// Copy tests
console.log('📋 Copying tests...');
cpSync(testProjectDist, backendTestDest, { recursive: true });

console.log('✅ Tests copied successfully!\n');
console.log(`   ${backendTestDest}\n`);
