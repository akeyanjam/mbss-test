import { Router } from 'express';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

/**
 * GET /artifacts/:runId/:testKey/:file
 * Serve artifact files (video, trace, logs)
 */
router.get('/:runId/:testKey/:file', (req, res) => {
  try {
    const { runId, testKey, file } = req.params;

    // Validate file name (prevent directory traversal)
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
      res.status(400).json({ error: 'Invalid file name' });
      return;
    }

    // Build file path
    const artifactRoot = resolve(__dirname, '../..', config.artifactRoot);
    const filePath = join(artifactRoot, runId, testKey, file);

    // Check if file exists
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    // Set appropriate content type based on file extension
    const ext = file.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp4':
        res.setHeader('Content-Type', 'video/mp4');
        break;
      case 'webm':
        res.setHeader('Content-Type', 'video/webm');
        break;
      case 'zip':
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
        break;
      case 'log':
      case 'txt':
        res.setHeader('Content-Type', 'text/plain');
        break;
      case 'jpg':
      case 'jpeg':
        res.setHeader('Content-Type', 'image/jpeg');
        break;
      case 'png':
        res.setHeader('Content-Type', 'image/png');
        break;
      default:
        res.setHeader('Content-Type', 'application/octet-stream');
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error('Error serving artifact:', error);
    res.status(500).json({ error: 'Failed to serve artifact' });
  }
});

/**
 * GET /artifacts/:runId/:testKey
 * List available artifacts for a test
 */
router.get('/:runId/:testKey', (req, res) => {
  try {
    const { runId, testKey } = req.params;

    const artifactRoot = resolve(__dirname, '../..', config.artifactRoot);
    const testDir = join(artifactRoot, runId, testKey);

    if (!existsSync(testDir)) {
      res.status(404).json({ error: 'Artifacts not found' });
      return;
    }

    // List files in the directory
    const { readdirSync, statSync } = require('fs');
    const files = readdirSync(testDir).map((file: string) => {
      const filePath = join(testDir, file);
      const stats = statSync(filePath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime,
        url: `/artifacts/${runId}/${testKey}/${file}`,
      };
    });

    res.json({ artifacts: files });
  } catch (error) {
    logger.error('Error listing artifacts:', error);
    res.status(500).json({ error: 'Failed to list artifacts' });
  }
});

export default router;
