import app from './app.js';
import env from './config/env.js';
import connectDB, { disconnectDB } from './config/db.js';
import { initSocket } from './realtime/socket.js';

import User from './models/User.js';

const startServer = async () => {
  await connectDB();

  // Auto-seed if database is completely empty (e.g. fresh in-memory MongoDB instance)
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    console.log('🌱 Database is empty. Auto-seeding initial dataset...');
    const { runSeed } = await import('../seed/seed.js');
    await runSeed();
  }

  // Start Express server and attach Socket.io
  const server = app.listen(env.PORT, () => {
    console.log(`🚀 BookLeaf Support Backend running on port ${env.PORT} (${env.NODE_ENV})`);
    console.log(`📡 Health endpoint: http://localhost:${env.PORT}/api/health`);
    console.log(`📚 Swagger Docs: http://localhost:${env.PORT}/api/docs`);
  });

  initSocket(server);

  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });

    // Force shutdown if taking longer than 10s
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
