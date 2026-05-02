import { Router } from 'express';
import { handleTranslate } from '../controllers/translation.controller.js';

const router = Router();

router.post('/', handleTranslate);

export default router;
