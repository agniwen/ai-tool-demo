import { isDeveloperModeEnabled } from '@/lib/developer-mode';
import { factory } from '../factory';

export const authMiddleware = factory.createMiddleware(async (c, next) => {
  if (isDeveloperModeEnabled()) {
    return next();
  }

  if (!c.var.user) {
    return c.json({ message: 'Unauthorized' }, 401);
  }

  return next();
});
