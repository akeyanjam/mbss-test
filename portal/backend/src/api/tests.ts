import { Router } from 'express';
import { getAllTests, getTestByKey, getTestsByFolder, getTestsByTags, getAllTags, getFolderTree, updateTestOverrides } from '../db/models/tests.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/tests
 * List all active tests with optional filters
 * Query params:
 *   - folder: filter by folder prefix
 *   - tags: filter by tags (comma-separated)
 */
router.get('/', (req, res) => {
  try {
    const { folder, tags } = req.query;

    let tests;
    if (folder && typeof folder === 'string') {
      tests = getTestsByFolder(folder);
    } else if (tags && typeof tags === 'string') {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      tests = getTestsByTags(tagList);
    } else {
      tests = getAllTests();
    }

    res.json({
      tests,
      count: tests.length,
    });
  } catch (error) {
    logger.error('Error fetching tests:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

/**
 * GET /api/tests/tags
 * Get all unique tags
 */
router.get('/tags', (_req, res) => {
  try {
    const tags = getAllTags();
    res.json({ tags });
  } catch (error) {
    logger.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

/**
 * GET /api/tests/folders
 * Get folder tree structure
 */
router.get('/folders', (_req, res) => {
  try {
    const folders = getFolderTree();
    res.json({ folders });
  } catch (error) {
    logger.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

/**
 * GET /api/tests/:testKey
 * Get a specific test by key
 */
router.get('/:testKey', (req, res) => {
  try {
    const { testKey } = req.params;
    const test = getTestByKey(testKey);

    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.json(test);
  } catch (error) {
    logger.error('Error fetching test:', error);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
});

/**
 * PUT /api/tests/:testKey/overrides
 * Update test overrides
 */
router.put('/:testKey/overrides', (req, res) => {
  try {
    const { testKey } = req.params;
    const overrides = req.body;

    if (!overrides || typeof overrides !== 'object') {
      res.status(400).json({ error: 'Invalid overrides format' });
      return;
    }

    const test = updateTestOverrides(testKey, overrides);

    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.json(test);
  } catch (error) {
    logger.error('Error updating test overrides:', error);
    res.status(500).json({ error: 'Failed to update test overrides' });
  }
});

export default router;
