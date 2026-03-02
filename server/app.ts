import type { Env } from '@/server/type';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from '@/lib/auth';
import { betterAuthMiddleware } from './middlewares/better-auth';
import { chatTitleRouter } from './routes/chat-title/route';
import { chatRouter } from './routes/chat/route';

export const app = new Hono<Env>()
  .use(
    '/api/auth/*',
    cors({
      origin: '*',
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    }),
  )
  .on(['POST', 'GET'], '/api/auth/*', c => {
    return auth.handler(c.req.raw);
  })
  .use(betterAuthMiddleware)
  .basePath('/api')
  .route('/chat', chatRouter)
  .route('/chat-title', chatTitleRouter);

app.notFound(c => c.json({ error: 'Not Found' }, 404));

export type AppType = typeof app;
