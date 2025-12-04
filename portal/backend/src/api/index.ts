import { Router } from 'express';
import testsRouter from './tests.js';
import runsRouter from './runs.js';
import schedulesRouter from './schedules.js';
import artifactsRouter from './artifacts.js';
import { environments, getAllowedEnvironments } from '../config/index.js';

const router = Router();

// Mount API routes
router.use('/tests', testsRouter);
router.use('/runs', runsRouter);
router.use('/schedules', schedulesRouter);

// Environments endpoint
router.get('/environments', (_req, res) => {
  res.json({ environments });
});

// User environments endpoint (get allowed environments for a user)
router.get('/user/environments', (req, res) => {
  const email = req.query.email as string;
  if (!email) {
    res.status(400).json({ error: 'email query parameter is required' });
    return;
  }
  
  const allowed = getAllowedEnvironments(email);
  res.json({ 
    email, 
    environments: environments.filter(e => allowed.includes(e.code)) 
  });
});

export { artifactsRouter };
export default router;
