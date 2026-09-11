import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { requestIdMiddleware } from './middleware/requestId.middleware.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';
import { ForbiddenError } from './utils/errors.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import searchRoutes from './routes/search.routes.js';
import inviteLinkRoutes from './routes/inviteLink.routes.js';
import { workspaceScopedRouter as teamsByWorkspaceRouter, flatRouter as teamRoutes } from './routes/team.routes.js';
import {
  workspaceScopedRouter as projectsByWorkspaceRouter,
  flatRouter as projectRoutes,
} from './routes/project.routes.js';
import { projectScopedRouter as tasksByProjectRouter, flatRouter as taskRoutes, workspaceScopedRouter as tasksByWorkspaceRouter } from './routes/task.routes.js';
import { taskScopedRouter as taskExtrasRouter, checklistItemRouter } from './routes/taskExtras.routes.js';
import { taskScopedRouter as commentsByTaskRouter, flatRouter as commentRoutes } from './routes/comment.routes.js';
import {
  workspaceScopedRouter as workspaceActivityRouter,
  projectScopedRouter as projectActivityRouter,
  taskScopedRouter as taskActivityRouter,
} from './routes/activity.routes.js';
import { workspaceScopedRouter as labelsByWorkspaceRouter } from './routes/label.routes.js';
import { attachmentRouter } from './routes/attachment.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import preferencesRoutes from './routes/preferences.routes.js';

export function createApp() {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(helmet());

  const allowedOrigins = [...env.allowedOrigins];

  if (!env.isProduction) {
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
    ];

    for (const origin of devOrigins) {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
      }
    }
  }

  app.use(
    cors({
      origin(origin, callback) {
        // Requests without an Origin header (health checks, native clients)
        // are not browser cross-origin requests. Browser origins must be
        // explicitly allow-listed, especially because cookies are enabled.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new ForbiddenError('Origin is not allowed by CORS policy', 'CORS_ORIGIN_DENIED'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.use('/api', apiLimiter);

  const API_PREFIX = '/api/v1';

  const checkDatabase = async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch (_err) {
      return 'degraded';
    }
  };

  // Liveness: the process is running. Dependency failures should not make
  // the container look dead to an orchestrator.
  const healthHandler = async (_req, res) => {
    const dbStatus = await checkDatabase();
    res.status(200).json({
      success: true,
      message: 'WorkSync API is healthy',
      data: {
        status: 'UP',
        uptime: process.uptime(),
        database: dbStatus,
      },
    });
  };

  // Readiness: the process can serve traffic only when critical dependencies
  // are reachable. A 503 lets a load balancer remove an unhealthy instance.
  const readinessHandler = async (_req, res) => {
    const dbStatus = await checkDatabase();
    const ready = dbStatus === 'ok';
    res.status(ready ? 200 : 503).json({
      success: ready,
      message: ready ? 'WorkSync API is ready' : 'WorkSync API is not ready',
      data: {
        status: ready ? 'READY' : 'NOT_READY',
        uptime: process.uptime(),
        database: dbStatus,
      },
    });
  };

  app.get('/health', healthHandler);
  app.get(`${API_PREFIX}/health`, healthHandler);
  app.get('/ready', readinessHandler);
  app.get(`${API_PREFIX}/ready`, readinessHandler);

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/users`, userRoutes);
  app.use(`${API_PREFIX}/notifications`, notificationRoutes);
  app.use(`${API_PREFIX}/invitations`, invitationRoutes);
  app.use(`${API_PREFIX}/search`, searchRoutes);
  app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
  app.use(`${API_PREFIX}/join`, inviteLinkRoutes);
  app.use(`${API_PREFIX}/me`, preferencesRoutes);
  app.use(`${API_PREFIX}/users/me`, preferencesRoutes);

  app.use(`${API_PREFIX}/workspaces`, workspaceRoutes);
  app.use(`${API_PREFIX}/workspaces/:workspaceId/teams`, teamsByWorkspaceRouter);
  app.use(`${API_PREFIX}/workspaces/:workspaceId/projects`, projectsByWorkspaceRouter);
  app.use(`${API_PREFIX}/workspaces/:workspaceId/activity`, workspaceActivityRouter);
  app.use(`${API_PREFIX}/workspaces/:workspaceId/labels`, labelsByWorkspaceRouter);

  app.use(`${API_PREFIX}/teams`, teamRoutes);
  app.use(`${API_PREFIX}/projects`, projectRoutes);
  app.use(`${API_PREFIX}/workspaces/:workspaceId/tasks`, tasksByWorkspaceRouter);
  app.use(`${API_PREFIX}/projects/:projectId/tasks`, tasksByProjectRouter);
  app.use(`${API_PREFIX}/projects/:projectId/activity`, projectActivityRouter);

  app.use(`${API_PREFIX}/tasks`, taskRoutes);
  app.use(`${API_PREFIX}/tasks/:taskId/comments`, commentsByTaskRouter);
  app.use(`${API_PREFIX}/tasks/:taskId/activity`, taskActivityRouter);
  app.use(`${API_PREFIX}/tasks/:taskId`, taskExtrasRouter);
  app.use(`${API_PREFIX}/checklist-items`, checklistItemRouter);
  app.use(`${API_PREFIX}/comments`, commentRoutes);
  app.use(`${API_PREFIX}/attachments`, attachmentRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
