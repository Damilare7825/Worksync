import { Router } from 'express';
import * as searchController from '../controllers/search.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { searchQuerySchema, suggestionQuerySchema } from '../validators/search.validator.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: searchQuerySchema }), searchController.search);
router.get('/suggestions', validate({ query: suggestionQuerySchema }), searchController.suggestions);

export default router;
