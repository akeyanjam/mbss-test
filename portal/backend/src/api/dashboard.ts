import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { environments } from '../config/index.js';
import {
  getDashboardOverview,
  getExecutionHistory,
  getExecutionTimeline,
  getEnvironmentHealth,
  getFlakyTests,
  getTestPerformance,
  getStatsByTag,
  getTestStats,
} from '../db/models/dashboard.js';

const router = Router();

/**
 * GET /api/dashboard/overview
 * Get dashboard overview with key metrics
 * Query params:
 *   - days: number of days to look back (default 30)
 */
router.get('/overview', (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    
    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'days must be between 1 and 365' });
      return;
    }

    const overview = getDashboardOverview(days);
    
    res.json(overview);
  } catch (error) {
    logger.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

/**
 * GET /api/dashboard/executions
 * Get execution history with filters
 * Query params:
 *   - environment: filter by environment
 *   - status: filter by status
 *   - triggerType: filter by trigger type (manual/schedule)
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - limit: max results (default 50, max 200)
 *   - offset: pagination offset
 */
router.get('/executions', (req, res) => {
  try {
    const {
      environment,
      status,
      triggerType,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    // Validate limit
    let parsedLimit = limit ? parseInt(limit as string) : 50;
    if (parsedLimit < 1 || parsedLimit > 200) {
      parsedLimit = 50;
    }

    const options: any = {
      limit: parsedLimit,
      offset: offset ? parseInt(offset as string) : 0,
    };
    
    if (environment) options.environment = environment as string;
    if (status) options.status = status as string;
    if (triggerType) options.triggerType = triggerType as string;
    if (startDate) options.startDate = startDate as string;
    if (endDate) options.endDate = endDate as string;

    const result = getExecutionHistory(options);

    res.json({
      executions: result.executions,
      total: result.total,
      limit: parsedLimit,
      offset: offset ? parseInt(offset as string) : 0,
    });
  } catch (error) {
    logger.error('Error fetching execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

/**
 * GET /api/dashboard/timeline
 * Get execution timeline data
 * Query params:
 *   - days: number of days to look back (default 30)
 *   - environment: filter by environment
 */
router.get('/timeline', (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const environment = req.query.environment as string | undefined;

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'days must be between 1 and 365' });
      return;
    }

    const result = getExecutionTimeline(days, environment);
    
    res.json(result);
  } catch (error) {
    logger.error('Error fetching execution timeline:', error);
    res.status(500).json({ error: 'Failed to fetch execution timeline' });
  }
});

/**
 * GET /api/dashboard/environment-health
 * Get health status for all environments
 * Query params:
 *   - days: number of days to look back (default 30)
 */
router.get('/environment-health', (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'days must be between 1 and 365' });
      return;
    }

    const healthData = getEnvironmentHealth(days);
    
    // Enrich with environment names from config
    const enrichedData = healthData.map(health => {
      const envConfig = environments.find(e => e.code === health.code);
      return {
        ...health,
        name: envConfig?.name || health.code,
        isProd: envConfig?.isProd || false,
      };
    });

    res.json({ environments: enrichedData });
  } catch (error) {
    logger.error('Error fetching environment health:', error);
    res.status(500).json({ error: 'Failed to fetch environment health' });
  }
});

/**
 * GET /api/dashboard/flaky-tests
 * Get flaky tests report
 * Query params:
 *   - minExecutions: minimum number of executions to consider (default 5)
 *   - days: number of days to look back (default 30)
 *   - environment: filter by environment
 */
router.get('/flaky-tests', (req, res) => {
  try {
    const minExecutions = req.query.minExecutions 
      ? parseInt(req.query.minExecutions as string) 
      : 5;
    const days = req.query.days 
      ? parseInt(req.query.days as string) 
      : 30;
    const environment = req.query.environment as string | undefined;

    if (minExecutions < 1 || minExecutions > 100) {
      res.status(400).json({ error: 'minExecutions must be between 1 and 100' });
      return;
    }

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'days must be between 1 and 365' });
      return;
    }

    const flakyOptions: any = { minExecutions, days };
    if (environment) flakyOptions.environment = environment;
    
    const flakyTests = getFlakyTests(flakyOptions);

    res.json({
      flakyTests,
      total: flakyTests.length,
    });
  } catch (error) {
    logger.error('Error fetching flaky tests:', error);
    res.status(500).json({ error: 'Failed to fetch flaky tests' });
  }
});

/**
 * GET /api/dashboard/test-performance
 * Get test performance metrics
 * Query params:
 *   - metric: "duration" | "execution_count" (default "duration")
 *   - limit: max results (default 10, max 50)
 *   - days: number of days to look back (default 30)
 *   - environment: filter by environment
 */
router.get('/test-performance', (req, res) => {
  try {
    const metric = (req.query.metric as 'duration' | 'execution_count') || 'duration';
    const limit = req.query.limit 
      ? Math.min(parseInt(req.query.limit as string), 50) 
      : 10;
    const days = req.query.days 
      ? parseInt(req.query.days as string) 
      : 30;
    const environment = req.query.environment as string | undefined;

    if (!['duration', 'execution_count'].includes(metric)) {
      res.status(400).json({ error: 'metric must be "duration" or "execution_count"' });
      return;
    }

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'days must be between 1 and 365' });
      return;
    }

    const perfOptions: any = { metric, limit, days };
    if (environment) perfOptions.environment = environment;
    
    const tests = getTestPerformance(perfOptions);

    res.json({ tests });
  } catch (error) {
    logger.error('Error fetching test performance:', error);
    res.status(500).json({ error: 'Failed to fetch test performance' });
  }
});

/**
 * GET /api/dashboard/stats-by-tag
 * Get statistics grouped by tag
 * Query params:
 *   - days: number of days to look back (default 30)
 *   - environment: filter by environment
 */
router.get('/stats-by-tag', (req, res) => {
  try {
    const days = req.query.days 
      ? parseInt(req.query.days as string) 
      : 30;
    const environment = req.query.environment as string | undefined;

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'days must be between 1 and 365' });
      return;
    }

    const tagOptions: any = { days };
    if (environment) tagOptions.environment = environment;
    
    const tags = getStatsByTag(tagOptions);

    res.json({ tags });
  } catch (error) {
    logger.error('Error fetching stats by tag:', error);
    res.status(500).json({ error: 'Failed to fetch stats by tag' });
  }
});

/**
 * GET /api/dashboard/test-stats/:testKey
 * Get statistics for a specific test
 * Query params:
 *   - days: number of days to look back (default 30)
 */
router.get('/test-stats/:testKey', (req, res) => {
  try {
    const { testKey } = req.params;
    const days = req.query.days 
      ? parseInt(req.query.days as string) 
      : 30;

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'days must be between 1 and 365' });
      return;
    }

    const stats = getTestStats(testKey, days);

    if (!stats) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching test stats:', error);
    res.status(500).json({ error: 'Failed to fetch test stats' });
  }
});

export default router;
