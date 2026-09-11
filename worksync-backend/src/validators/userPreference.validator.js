import { z } from 'zod';

// User preferences validation schema
export const userPreferencesSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(50).optional(),
  timeFormat: z.string().max(50).optional(),
  compactDensity: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one preference field must be provided',
});

// Notification preferences validation schema
export const notificationPreferencesSchema = z.object({
  taskAssignments: z.boolean().optional(),
  taskUpdates: z.boolean().optional(),
  dueDateReminders: z.boolean().optional(),
  mentions: z.boolean().optional(),
  comments: z.boolean().optional(),
  replies: z.boolean().optional(),
  reactions: z.boolean().optional(),
  workspaceActivity: z.boolean().optional(),
  projectActivity: z.boolean().optional(),
  invitations: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one notification preference field must be provided',
});