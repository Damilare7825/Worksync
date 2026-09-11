import { Router } from 'express';
import * as ctrl from '../controllers/taskExtras.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { paramsWithIdSchema } from '../validators/common.validator.js';
import {
  checklistItemCreateSchema,
  checklistItemUpdateSchema,
  checklistReorderSchema,
  dependencyCreateSchema,
  recurrenceSchema,
  taskLabelAssignSchema,
} from '../validators/taskExtras.validator.js';
import { z } from 'zod';

const taskIdParams = z.object({ taskId: paramsWithIdSchema.shape.id });

export const taskScopedRouter = Router({ mergeParams: true });
taskScopedRouter.use(authenticate);

// Checklist
taskScopedRouter.get('/checklist', validate({ params: taskIdParams }), ctrl.listChecklistItems);
taskScopedRouter.post(
  '/checklist',
  validate({ params: taskIdParams, body: checklistItemCreateSchema }),
  ctrl.addChecklistItem
);
taskScopedRouter.post(
  '/checklist/reorder',
  validate({ params: taskIdParams, body: checklistReorderSchema }),
  ctrl.reorderChecklistItems
);

// Watchers
taskScopedRouter.get('/watchers', validate({ params: taskIdParams }), ctrl.listWatchers);
taskScopedRouter.post('/watchers', validate({ params: taskIdParams }), ctrl.watchTask);
taskScopedRouter.delete('/watchers', validate({ params: taskIdParams }), ctrl.unwatchTask);

// Dependencies
taskScopedRouter.post(
  '/dependencies',
  validate({ params: taskIdParams, body: dependencyCreateSchema }),
  ctrl.addDependency
);
taskScopedRouter.delete(
  '/dependencies/:dependsOnTaskId',
  validate({ params: taskIdParams.extend({ dependsOnTaskId: paramsWithIdSchema.shape.id }) }),
  ctrl.removeDependency
);

// Recurrence
taskScopedRouter.get('/recurrence', validate({ params: taskIdParams }), ctrl.getRecurrence);
taskScopedRouter.put(
  '/recurrence',
  validate({ params: taskIdParams, body: recurrenceSchema }),
  ctrl.setRecurrence
);
taskScopedRouter.delete('/recurrence', validate({ params: taskIdParams }), ctrl.removeRecurrence);

// Labels on a task
taskScopedRouter.post(
  '/labels',
  validate({ params: taskIdParams, body: taskLabelAssignSchema }),
  ctrl.addLabelToTask
);
taskScopedRouter.delete(
  '/labels/:labelId',
  validate({ params: taskIdParams.extend({ labelId: paramsWithIdSchema.shape.id }) }),
  ctrl.removeLabelFromTask
);

// Standalone checklist-item routes (item id, not scoped under a task path)
export const checklistItemRouter = Router();
checklistItemRouter.use(authenticate);
checklistItemRouter.patch(
  '/:itemId',
  validate({ params: z.object({ itemId: paramsWithIdSchema.shape.id }), body: checklistItemUpdateSchema }),
  ctrl.updateChecklistItem
);
checklistItemRouter.delete(
  '/:itemId',
  validate({ params: z.object({ itemId: paramsWithIdSchema.shape.id }) }),
  ctrl.deleteChecklistItem
);
