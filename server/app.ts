import type { Env } from '@/server/type';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from '@/lib/auth';
import { authMiddleware } from './middlewares/auth';
import { betterAuthMiddleware } from './middlewares/better-auth';
import { chatTitleRouter } from './routes/chat-title/route';
import { chatRouter } from './routes/chat/route';
import { interviewRouter } from './routes/interview/route';
import { interviewNextRouter } from './routes/interview-next/route';

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
  .on(['POST', 'GET'], '/api/auth/*', (c) => {
    return auth.handler(c.req.raw);
  })
  .use(betterAuthMiddleware)
  .use('/api/chat', authMiddleware)
  .use('/api/chat-title', authMiddleware)
  .use('/api/interview/parse-resume', authMiddleware)
  .use('/api/interview/token', authMiddleware)
  .use('/api/interview/report/*', authMiddleware)
  .use('/api/interview-next/parse-resume', authMiddleware)
  .use('/api/interview-next/token', authMiddleware)
  .use('/api/interview-next/report/*', authMiddleware)
  .basePath('/api')
  .route('/chat', chatRouter)
  .route('/chat-title', chatTitleRouter)
  .route('/interview', interviewRouter)
  .route('/interview-next', interviewNextRouter);

app.notFound(c => c.json({ error: 'Not Found' }, 404));

export type AppType = typeof app;
