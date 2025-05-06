import { env } from '@/env';
import { logger } from '@/logger';

logger.info(`Starting up in ${env.NODE_ENV} mode`);

const onCloseSignal = () => {
  logger.info('sigint received, shutting down');

  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after timeout

  // Do some cleanup here

  process.exit(0); // Exit gracefully
};

process.on('SIGINT', onCloseSignal);
process.on('SIGTERM', onCloseSignal);
