// Debug and verification routes for the self-debugging system
import { Router } from 'express';
import { DebugLogger } from './lib/self-debug';
import { runVerificationSuite } from './lib/verification-suite';

const router = Router();

// Get current triage bundles
router.get('/api/debug/triage-bundles', async (req, res) => {
  try {
    const bundles = DebugLogger.getTriageBundles();
    res.json({
      count: bundles.length,
      bundles: bundles.slice(-10) // Last 10 bundles
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to get triage bundles',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Run verification suite
router.post('/api/debug/verify', async (req, res) => {
  try {
    const report = await runVerificationSuite();
    res.json(report);
  } catch (error) {
    res.status(500).json({ 
      message: 'Verification suite failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Check system health
router.get('/api/debug/health', (req, res) => {
  res.json({
    status: 'healthy',
    selfDebugMode: process.env.NODE_ENV !== 'production',
    protocolVersion: '1.0.0',
    timestamp: Date.now()
  });
});

export default router;