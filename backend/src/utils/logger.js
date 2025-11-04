/**
 * Winston Logger Configuration
 *
 * Provides structured logging for the application
 * - Different log levels: error, warn, info, debug
 * - File and console transports
 * - Log rotation for production
 * - Sensitive data filtering
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let msg = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }

    return msg;
  })
);

// Filter sensitive data from logs
const sensitiveDataFilter = winston.format((info) => {
  const sensitiveKeys = [
    'password',
    'privateKey',
    'secret',
    'token',
    'apiKey',
    'creditCard',
    'ssn',
    'signature',
  ];

  const filterObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const filtered = { ...obj };

    Object.keys(filtered).forEach((key) => {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        filtered[key] = '[REDACTED]';
      } else if (typeof filtered[key] === 'object') {
        filtered[key] = filterObject(filtered[key]);
      }
    });

    return filtered;
  };

  return filterObject(info);
});

// Create transports
const transports = [];

// Console transport (always enabled in development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// File transport for errors
transports.push(
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  })
);

// File transport for all logs
transports.push(
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: logFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  })
);

// Create logger
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    sensitiveDataFilter(),
    logFormat
  ),
  transports,
  exitOnError: false,
});

// Stream for Morgan (HTTP request logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
