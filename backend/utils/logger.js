const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Simple text format for files
const simpleFileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${level.toUpperCase()} [${timestamp}] : ${message}`;
  })
);

// Create daily rotate file transport
const dailyRotateFileTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: simpleFileFormat
});

// Create console transport for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    dailyRotateFileTransport,
    consoleTransport
  ],
  exceptionHandlers: [
    dailyRotateFileTransport
  ],
  rejectionHandlers: [
    dailyRotateFileTransport
  ]
});

module.exports = logger;