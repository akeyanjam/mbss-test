import { Router } from 'express';
import { 
  getAllSchedules, 
  getScheduleById, 
  createSchedule, 
  updateSchedule, 
  deleteSchedule,
  toggleScheduleEnabled 
} from '../db/models/schedules.js';
import { hasEnvironmentAccess, isValidEnvironment } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { CreateScheduleRequest, UpdateScheduleRequest } from '../types/index.js';

const router = Router();

/**
 * GET /api/schedules
 * List all schedules
 */
router.get('/', (_req, res) => {
  try {
    const schedules = getAllSchedules();
    res.json({
      schedules,
      count: schedules.length,
    });
  } catch (error) {
    logger.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

/**
 * GET /api/schedules/:id
 * Get a specific schedule
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const schedule = getScheduleById(id);

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    res.json(schedule);
  } catch (error) {
    logger.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

/**
 * POST /api/schedules
 * Create a new schedule
 */
router.post('/', (req, res) => {
  try {
    const body = req.body as CreateScheduleRequest;
    const { name, cron, environment, selector, userEmail, defaultRunOverrides } = body;

    // Validate required fields
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!cron) {
      res.status(400).json({ error: 'cron is required' });
      return;
    }
    if (!environment) {
      res.status(400).json({ error: 'environment is required' });
      return;
    }
    if (!selector || !selector.type) {
      res.status(400).json({ error: 'selector is required' });
      return;
    }
    if (!userEmail) {
      res.status(400).json({ error: 'userEmail is required' });
      return;
    }

    // Validate selector type
    if (!['folder', 'tags', 'explicit'].includes(selector.type)) {
      res.status(400).json({ error: 'Invalid selector type' });
      return;
    }

    // Validate environment
    if (!isValidEnvironment(environment)) {
      res.status(400).json({ error: `Invalid environment: ${environment}` });
      return;
    }

    // Check user access
    if (!hasEnvironmentAccess(userEmail, environment)) {
      res.status(403).json({ error: `User ${userEmail} does not have access to environment ${environment}` });
      return;
    }

    // Validate cron expression (basic check)
    const cronParts = cron.trim().split(/\s+/);
    if (cronParts.length < 5 || cronParts.length > 6) {
      res.status(400).json({ error: 'Invalid cron expression' });
      return;
    }

    // Create the schedule
    const schedule = createSchedule({
      name,
      cron,
      environment,
      selector,
      createdByEmail: userEmail,
      ...(defaultRunOverrides && { defaultRunOverrides }),
    });

    logger.info(`Created schedule ${schedule.id}: ${name} for ${environment} by ${userEmail}`);

    res.status(201).json(schedule);
  } catch (error) {
    logger.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

/**
 * PUT /api/schedules/:id
 * Update a schedule
 */
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as UpdateScheduleRequest;
    const { name, cron, enabled, environment, selector, userEmail, defaultRunOverrides } = body;

    if (!userEmail) {
      res.status(400).json({ error: 'userEmail is required' });
      return;
    }

    const existing = getScheduleById(id);
    if (!existing) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // If changing environment, validate access
    const targetEnv = environment || existing.environment;
    if (!hasEnvironmentAccess(userEmail, targetEnv)) {
      res.status(403).json({ error: `User ${userEmail} does not have access to environment ${targetEnv}` });
      return;
    }

    // Validate environment if provided
    if (environment && !isValidEnvironment(environment)) {
      res.status(400).json({ error: `Invalid environment: ${environment}` });
      return;
    }

    // Validate selector if provided
    if (selector && !['folder', 'tags', 'explicit'].includes(selector.type)) {
      res.status(400).json({ error: 'Invalid selector type' });
      return;
    }

    // Validate cron if provided
    if (cron) {
      const cronParts = cron.trim().split(/\s+/);
      if (cronParts.length < 5 || cronParts.length > 6) {
        res.status(400).json({ error: 'Invalid cron expression' });
        return;
      }
    }

    const schedule = updateSchedule(id, {
      ...(name !== undefined && { name }),
      ...(cron !== undefined && { cron }),
      ...(enabled !== undefined && { enabled }),
      ...(environment !== undefined && { environment }),
      ...(selector !== undefined && { selector }),
      ...(defaultRunOverrides !== undefined && { defaultRunOverrides }),
      updatedByEmail: userEmail,
    });

    logger.info(`Updated schedule ${id} by ${userEmail}`);

    res.json(schedule);
  } catch (error) {
    logger.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = getScheduleById(id);
    if (!existing) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const deleted = deleteSchedule(id);
    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete schedule' });
      return;
    }

    logger.info(`Deleted schedule ${id}`);

    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    logger.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

/**
 * POST /api/schedules/:id/toggle
 * Toggle schedule enabled/disabled
 */
router.post('/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    const schedule = toggleScheduleEnabled(id, enabled);
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    logger.info(`Toggled schedule ${id} to ${enabled ? 'enabled' : 'disabled'}`);

    res.json(schedule);
  } catch (error) {
    logger.error('Error toggling schedule:', error);
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

export default router;
