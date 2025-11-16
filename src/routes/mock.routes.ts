import { Router } from 'express';

const router = Router();

router.get('/test', (req, res) => {
  res.json({
    message: 'This is a mock route',
    timestamp: new Date().toISOString(),
    });
});

export default router;
