import { Router } from 'express';
import { uploadAudio } from '../middleware/upload.middleware.js';
import { handleQuizStart, handleQuizStartTest, handleQuizEvaluate, handleGetCategories } from '../controllers/quiz.controller.js';

const router = Router();

router.get('/start', handleQuizStart);
router.get('/start/test', handleQuizStartTest);
router.get('/categories', handleGetCategories);
router.post('/evaluate', uploadAudio, handleQuizEvaluate);

export default router;
