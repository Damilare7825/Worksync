import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as checklistService from '../services/checklist.service.js';
import * as watcherService from '../services/watcher.service.js';
import * as dependencyService from '../services/dependency.service.js';
import * as recurrenceService from '../services/recurrence.service.js';
import * as labelService from '../services/label.service.js';

// --- Checklist -------------------------------------------------------------
export const listChecklistItems = asyncHandler(async (req, res) => {
  const items = await checklistService.listItems(req.user.id, req.params.taskId);
  return sendSuccess(res, { message: 'Checklist items retrieved', data: { items } });
});

export const addChecklistItem = asyncHandler(async (req, res) => {
  const item = await checklistService.addItem(req.user.id, req.params.taskId, req.body);
  return sendSuccess(res, { statusCode: 201, message: 'Checklist item added', data: { item } });
});

export const updateChecklistItem = asyncHandler(async (req, res) => {
  const item = await checklistService.updateItem(req.user.id, req.params.itemId, req.body);
  return sendSuccess(res, { message: 'Checklist item updated', data: { item } });
});

export const deleteChecklistItem = asyncHandler(async (req, res) => {
  await checklistService.deleteItem(req.user.id, req.params.itemId);
  return sendSuccess(res, { message: 'Checklist item deleted', data: null });
});

export const reorderChecklistItems = asyncHandler(async (req, res) => {
  const items = await checklistService.reorderItems(req.user.id, req.params.taskId, req.body.itemIds);
  return sendSuccess(res, { message: 'Checklist reordered', data: { items } });
});

// --- Watchers ----------------------------------------------------------------
export const listWatchers = asyncHandler(async (req, res) => {
  const watchers = await watcherService.listWatchers(req.user.id, req.params.taskId);
  return sendSuccess(res, { message: 'Watchers retrieved', data: { watchers } });
});

export const watchTask = asyncHandler(async (req, res) => {
  await watcherService.watchTask(req.user.id, req.params.taskId);
  return sendSuccess(res, { message: 'Now watching this task', data: null });
});

export const unwatchTask = asyncHandler(async (req, res) => {
  await watcherService.unwatchTask(req.user.id, req.params.taskId);
  return sendSuccess(res, { message: 'No longer watching this task', data: null });
});

// --- Dependencies ------------------------------------------------------------
export const addDependency = asyncHandler(async (req, res) => {
  const dependency = await dependencyService.addDependency(req.user.id, req.params.taskId, req.body.dependsOnTaskId);
  return sendSuccess(res, { statusCode: 201, message: 'Dependency added', data: { dependency } });
});

export const removeDependency = asyncHandler(async (req, res) => {
  await dependencyService.removeDependency(req.user.id, req.params.taskId, req.params.dependsOnTaskId);
  return sendSuccess(res, { message: 'Dependency removed', data: null });
});

// --- Recurrence ----------------------------------------------------------------
export const getRecurrence = asyncHandler(async (req, res) => {
  const rule = await recurrenceService.getRecurrence(req.user.id, req.params.taskId);
  return sendSuccess(res, { message: 'Recurrence retrieved', data: { rule } });
});

export const setRecurrence = asyncHandler(async (req, res) => {
  const rule = await recurrenceService.setRecurrence(req.user.id, req.params.taskId, req.body);
  return sendSuccess(res, { message: 'Recurrence set', data: { rule } });
});

export const removeRecurrence = asyncHandler(async (req, res) => {
  await recurrenceService.removeRecurrence(req.user.id, req.params.taskId);
  return sendSuccess(res, { message: 'Recurrence removed', data: null });
});

// --- Task labels ---------------------------------------------------------------
export const addLabelToTask = asyncHandler(async (req, res) => {
  await labelService.addLabelToTask(req.user.id, req.params.taskId, req.body.labelId);
  return sendSuccess(res, { message: 'Label added to task', data: null });
});

export const removeLabelFromTask = asyncHandler(async (req, res) => {
  await labelService.removeLabelFromTask(req.user.id, req.params.taskId, req.params.labelId);
  return sendSuccess(res, { message: 'Label removed from task', data: null });
});
