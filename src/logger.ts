import pino from 'pino';

const logger = pino({
  name: 'app',
  transport: {
    target: 'pino-pretty',
  },
});

export { logger };
