import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AppConfig {
  port: number;
  testRoot: string;
  artifactRoot: string;
  databasePath: string;
  maxConcurrentRuns: number;
  retentionDays: number;
}

export interface Environment {
  code: string;
  name: string;
  isProd: boolean;
}

export interface UserAccess {
  email: string;
  environments: string[];
}

// Load config from file or use defaults
function loadConfig(): AppConfig {
  const configPath = process.env.CONFIG_PATH || join(__dirname, '../../config/app.config.json');
  
  try {
    const configFile = readFileSync(configPath, 'utf-8');
    const fileConfig = JSON.parse(configFile);
    
    const config: AppConfig = {
      port: process.env.PORT ? parseInt(process.env.PORT) : fileConfig.port || 3000,
      testRoot: process.env.TEST_ROOT || fileConfig.testRoot || './dist-tests',
      artifactRoot: process.env.ARTIFACT_ROOT || fileConfig.artifactRoot || '../data/artifacts',
      databasePath: process.env.DATABASE_PATH || fileConfig.databasePath || '../data/mbss.db',
      maxConcurrentRuns: fileConfig.maxConcurrentRuns || 10,
      retentionDays: fileConfig.retentionDays || 30,
    };

    // Ensure data directories exist
    ensureDirectories(config);
    
    return config;
  } catch (error) {
    console.warn('⚠️  Config file not found, using defaults');
    const config: AppConfig = {
      port: 3000,
      testRoot: './dist-tests',
      artifactRoot: '../data/artifacts',
      databasePath: '../data/mbss.db',
      maxConcurrentRuns: 10,
      retentionDays: 30,
    };
    
    ensureDirectories(config);
    return config;
  }
}

function ensureDirectories(config: AppConfig): void {
  // Ensure artifact directory exists
  const artifactDir = resolve(__dirname, '../..', config.artifactRoot);
  if (!existsSync(artifactDir)) {
    mkdirSync(artifactDir, { recursive: true });
  }
  
  // Ensure database directory exists
  const dbDir = dirname(resolve(__dirname, '../..', config.databasePath));
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
}

// Load environments from config file
function loadEnvironments(): Environment[] {
  const envPath = join(__dirname, '../../config/environments.json');
  try {
    const envFile = readFileSync(envPath, 'utf-8');
    const data = JSON.parse(envFile);
    return data.environments || [];
  } catch (error) {
    console.warn('⚠️  environments.json not found, using defaults');
    return [
      { code: 'SIT1', name: 'System Integration Test 1', isProd: false },
      { code: 'SIT2', name: 'System Integration Test 2', isProd: false },
      { code: 'PROD', name: 'Production', isProd: true },
    ];
  }
}

// Load user access from config file
function loadUserAccess(): UserAccess[] {
  const usersPath = join(__dirname, '../../config/users.json');
  try {
    const usersFile = readFileSync(usersPath, 'utf-8');
    const data = JSON.parse(usersFile);
    return data.users || [];
  } catch (error) {
    console.warn('⚠️  users.json not found, no user access configured');
    return [];
  }
}

export const config = loadConfig();
export const environments = loadEnvironments();
export const userAccess = loadUserAccess();

// Helper to check if a user has access to an environment
export function hasEnvironmentAccess(email: string, envCode: string): boolean {
  const user = userAccess.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return false;
  return user.environments.includes(envCode);
}

// Helper to get allowed environments for a user
export function getAllowedEnvironments(email: string): string[] {
  const user = userAccess.find(u => u.email.toLowerCase() === email.toLowerCase());
  return user?.environments || [];
}

// Helper to validate environment code
export function isValidEnvironment(envCode: string): boolean {
  return environments.some(e => e.code === envCode);
}
