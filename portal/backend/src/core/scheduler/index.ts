import { CronExpressionParser } from 'cron-parser';
import { logger } from '../../utils/logger.js';
import { getEnabledSchedules, updateScheduleLastTriggered } from '../../db/models/schedules.js';
import { getActiveRunsForSchedule, createRun } from '../../db/models/runs.js';
import { getTestsByFolder, getTestsByTags, getTestsByKeys } from '../../db/models/tests.js';
import type { Schedule, ScheduleSelector } from '../../types/index.js';

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null;

// How often to check schedules (in milliseconds)
const SCHEDULER_TICK_INTERVAL = 30000; // 30 seconds

/**
 * Start the scheduler
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    logger.warn('Scheduler already running');
    return;
  }

  logger.info('⏰ Starting scheduler');
  
  // Check immediately on start
  checkSchedules();
  
  // Then check periodically
  schedulerInterval = setInterval(() => {
    checkSchedules();
  }, SCHEDULER_TICK_INTERVAL);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Scheduler stopped');
  }
}

/**
 * Check all enabled schedules and trigger if due
 */
function checkSchedules(): void {
  try {
    const schedules = getEnabledSchedules();
    const now = new Date();

    for (const schedule of schedules) {
      try {
        if (isScheduleDue(schedule, now)) {
          triggerSchedule(schedule);
        }
      } catch (error) {
        logger.error(`Error checking schedule ${schedule.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error checking schedules:', error);
  }
}

/**
 * Check if a schedule is due to run
 */
function isScheduleDue(schedule: Schedule, now: Date): boolean {
  try {
    const options = {
      currentDate: schedule.lastTriggeredAt || new Date(0),
      tz: 'UTC',
    };

    const interval = CronExpressionParser.parse(schedule.cron, options);
    const nextRun = interval.next().toDate();

    return nextRun <= now;
  } catch (error) {
    logger.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cron}`);
    return false;
  }
}

/**
 * Trigger a schedule - create a run if conditions are met
 */
function triggerSchedule(schedule: Schedule): void {
  logger.info(`Triggering schedule: ${schedule.name} (${schedule.id})`);

  // Check for overlapping runs
  const activeRuns = getActiveRunsForSchedule(schedule.id);
  if (activeRuns.length > 0) {
    logger.info(`Skipping schedule ${schedule.id}: previous run still active`);
    return;
  }

  // Get tests based on selector
  const tests = getTestsForSelector(schedule.selector);
  
  if (tests.length === 0) {
    logger.warn(`Schedule ${schedule.id} matched no tests, creating skipped run`);
    // Create a skipped run for audit purposes
    createRun({
      triggerType: 'schedule',
      environment: schedule.environment,
      scheduleId: schedule.id,
      triggeredByEmail: schedule.createdByEmail,
      runOverrides: schedule.defaultRunOverrides,
      testIds: [],
    });
    updateScheduleLastTriggered(schedule.id);
    return;
  }

  // Create the run
  const run = createRun({
    triggerType: 'schedule',
    environment: schedule.environment,
    scheduleId: schedule.id,
    triggeredByEmail: schedule.createdByEmail,
    runOverrides: schedule.defaultRunOverrides,
    testIds: tests.map(t => ({ testId: t.id, testKey: t.testKey })),
  });

  // Update last triggered timestamp
  updateScheduleLastTriggered(schedule.id);

  logger.info(`Created run ${run.id} from schedule ${schedule.name} with ${tests.length} test(s)`);
}

/**
 * Get tests matching a selector
 */
function getTestsForSelector(selector: ScheduleSelector) {
  switch (selector.type) {
    case 'folder':
      return getTestsByFolder(selector.folderPrefix);
    case 'tags':
      return getTestsByTags(selector.tags);
    case 'explicit':
      return getTestsByKeys(selector.testKeys);
    default:
      logger.error(`Unknown selector type: ${(selector as any).type}`);
      return [];
  }
}

/**
 * Get next run time for a schedule
 */
export function getNextRunTime(schedule: Schedule): Date | null {
  try {
    const options = {
      currentDate: new Date(),
      tz: 'UTC',
    };

    const interval = CronExpressionParser.parse(schedule.cron, options);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Validate a cron expression
 */
export function isValidCron(cron: string): boolean {
  try {
    CronExpressionParser.parse(cron);
    return true;
  } catch {
    return false;
  }
}
