import { Router } from 'express';
import { body } from 'express-validator';
import {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  patchApplication,  
  deleteApplication,
  getDashboardSummary,
} from '../controllers/applicationController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', getDashboardSummary);

router.get('/', getApplications);

router.post(
  '/',
  [
    body('companyName').notEmpty().withMessage('Nama perusahaan wajib diisi.'),
    body('position').notEmpty().withMessage('Posisi wajib diisi.'),
    body('status').optional().isString(),
  ],
  validate,
  createApplication
);

router.get('/:id', getApplicationById);

router.put('/:id', updateApplication);

router.patch('/:id', patchApplication);

router.delete('/:id', deleteApplication);

export default router;