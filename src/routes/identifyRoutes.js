import express from 'express';
import { identifyUser } from '../controllers/indentifyController.js';

const router = express.Router();

router.post('/',identifyUser);

export default router;