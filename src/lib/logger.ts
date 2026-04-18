/**
 * Zero Script QA - Structured JSON Logger
 * Outputs logs in standard JSON format for real-time monitoring and analysis
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

interface LogData {
  request_id?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  request_id: string;
  message: string;
  data?: Record<string, any>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
};

// Development: show all; Production: INFO and above
const MIN_LEVEL = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';

function formatLogEntry(
  level: LogLevel,
  message: string,
  data?: LogData
): LogEntry {
  const requestId = data?.request_id || 'N/A';
  const { request_id, ...restData } = data || {};

  return {
    timestamp: new Date().toISOString(),
    level,
    service: 'web',
    request_id: requestId,
    message,
    ...(Object.keys(restData).length > 0 && { data: restData }),
  };
}

function log(level: LogLevel, message: string, data?: LogData) {
  if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return;

  const logEntry = formatLogEntry(level, message, data);

  // Output as JSON for structured logging
  console.log(JSON.stringify(logEntry));

  // Also log to console in development for debugging
  if (process.env.NODE_ENV === 'development') {
    const color =
      {
        DEBUG: '\x1b[36m', // cyan
        INFO: '\x1b[32m', // green
        WARNING: '\x1b[33m', // yellow
        ERROR: '\x1b[31m', // red
      }[level] || '\x1b[0m';
    const reset = '\x1b[0m';

    console.debug(
      `${color}[${level}]${reset} ${message}`,
      data ? { request_id: data.request_id, ...data } : ''
    );
  }
}

export const logger = {
  debug: (msg: string, data?: LogData) => log('DEBUG', msg, data),
  info: (msg: string, data?: LogData) => log('INFO', msg, data),
  warning: (msg: string, data?: LogData) => log('WARNING', msg, data),
  error: (msg: string, data?: LogData) => log('ERROR', msg, data),
};

/**
 * Generates a unique Request ID for tracking flows across services
 */
export function generateRequestId(): string {
  return `req_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Extracts Request ID from headers or generates new one
 */
export function getOrGenerateRequestId(
  headerValue?: string | null
): string {
  if (headerValue && typeof headerValue === 'string') {
    return headerValue;
  }
  return generateRequestId();
}
