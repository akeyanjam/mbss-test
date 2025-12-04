#!/usr/bin/env node

/**
 * MBSS Test Build Script
 * 
 * Builds the test suite for deployment to the portal.
 * - Compiles TypeScript to JavaScript
 * - Copies meta.json and constants.json files
 * - Validates test structure
 * - Outputs to ../dist-tests/
 */

import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(__dirname, '../src');
const DIST_ROOT = join(__dirname, '../dist-tests');

console.log('🔨 Building MBSS Tests...\n');

// Clean dist folder
if (existsSync(DIST_ROOT)) {
  console.log('🧹 Cleaning dist folder...');
  rmSync(DIST_ROOT, { recursive: true });
}
mkdirSync(DIST_ROOT, { recursive: true });

// Compile TypeScript
console.log('📦 Compiling TypeScript...');
try {
  execSync('npx tsc --outDir dist-tests', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit'
  });
} catch (error) {
  console.error('❌ TypeScript compilation failed');
  process.exit(1);
}

// Copy JSON files and validate structure
console.log('\n📋 Copying JSON files and validating structure...');

let testCount = 0;
let errors = [];

function processDirectory(dir, relativePath = '') {
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = join(relativePath, entry.name);
    
    if (entry.isDirectory()) {
      // Skip shared folder (not a test)
      if (entry.name === 'shared') {
        continue;
      }
      
      processDirectory(fullPath, relPath);
    } else if (entry.name === 'meta.json' || entry.name === 'constants.json') {
      // Copy JSON file to dist
      const destPath = join(DIST_ROOT, relPath);
      mkdirSync(dirname(destPath), { recursive: true });
      cpSync(fullPath, destPath);
      
      // Validate JSON
      try {
        const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
        
        if (entry.name === 'meta.json') {
          if (!content.testKey) {
            errors.push(`${relPath}: missing testKey`);
          }
          if (!content.friendlyName) {
            errors.push(`${relPath}: missing friendlyName`);
          }
          testCount++;
        }
        
        if (entry.name === 'constants.json') {
          if (!content.environments) {
            errors.push(`${relPath}: missing environments object`);
          }
        }
      } catch (e) {
        errors.push(`${relPath}: invalid JSON - ${e.message}`);
      }
    }
  }
}

processDirectory(TESTS_ROOT);

// Copy shared folder
console.log('📁 Copying shared utilities...');
const sharedSrc = join(TESTS_ROOT, 'shared');
const sharedDist = join(DIST_ROOT, 'shared');
if (existsSync(sharedSrc)) {
  // Shared folder is already compiled by tsc, just need to ensure it's there
  console.log('   Shared utilities compiled with TypeScript');
}

// Report results
console.log('\n📊 Build Summary:');
console.log(`   Tests found: ${testCount}`);
console.log(`   Output: ${DIST_ROOT}`);

if (errors.length > 0) {
  console.log('\n⚠️  Validation warnings:');
  errors.forEach(e => console.log(`   - ${e}`));
}

console.log('\n✅ Build complete!');
