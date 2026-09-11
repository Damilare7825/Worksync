import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
}).refine(
  ({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo,
  { message: 'dateFrom must be before dateTo' }
);
