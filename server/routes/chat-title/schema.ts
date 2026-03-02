import { z } from 'zod';

export const chatTitleRequestSchema = z.object({
  hasFiles: z.boolean().optional(),
  text: z.string().trim().min(1).max(5000),
});

function sanitizeTitle(title: string): string {
  return title
    .replace(/["'`]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

export { sanitizeTitle };
