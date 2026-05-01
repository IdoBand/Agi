import { Router } from 'express';
import { uploadAudio } from '../middleware/upload.middleware.js';
import { handleTutorTurn, handleTutorReset } from '../controllers/tutor.controller.js';

const router = Router();

router.post('/turn', uploadAudio, handleTutorTurn);
router.post('/reset', handleTutorReset);

export default router;
