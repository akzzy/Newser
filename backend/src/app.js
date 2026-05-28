import 'dotenv/config.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { supabasePlugin } from './plugins/supabase.js';
import { articleRoutes } from './routes/articles.js';
import { sourceRoutes } from './routes/sources.js';
import adminRoutes from './routes/admin.js';
import { startCronJobs } from './jobs/refreshFeeds.js';

import path from 'path';
import fs from 'fs';

const logFile = path.join(process.cwd(), 'app.log');

// Clear the log file on startup to prevent infinite growth
if (fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '');
}

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      targets: [
        {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
        },
        {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname', destination: logFile, colorize: false }
        }
      ]
    }
  }
});

// Plugins
fastify.register(cors, {
  origin: true, // Allow all origins in dev; lock down in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

fastify.register(supabasePlugin);

// Routes
fastify.register(articleRoutes, { prefix: '/api' });
fastify.register(sourceRoutes, { prefix: '/api' });
fastify.register(adminRoutes, { prefix: '/api/admin' });

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    fastify.log.info(`Newser API running on http://${host}:${port}`);

    // Start cron jobs after server is up
    startCronJobs(fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
