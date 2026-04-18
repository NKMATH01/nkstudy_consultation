/**
 * API Client with Zero Script QA logging integration
 * Automatically logs all API calls with Request ID tracking
 */

import { logger, generateRequestId } from './logger';

interface ApiClientOptions extends RequestInit {
  endpoint: string;
  requestId?: string;
}

interface ApiErrorResponse {
  error?: string | { message: string };
  message?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorResponse
  ) {
    super(data.error?.toString() || data.message || 'API Error');
    this.name = 'ApiError';
  }
}

/**
 * Universal API client with structured logging
 * Usage: apiClient({ endpoint: '/api/consultations', method: 'GET' })
 */
export async function apiClient<T>(
  options: ApiClientOptions
): Promise<T> {
  const {
    endpoint,
    requestId: providedRequestId,
    ...fetchOptions
  } = options;

  const requestId = providedRequestId || generateRequestId();
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const startTime = Date.now();

  logger.info('API Request started', {
    request_id: requestId,
    method,
    endpoint,
  });

  try {
    const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...fetchOptions.headers,
      },
    });

    const duration = Date.now() - startTime;

    // Always log response (including 200 OK)
    logger.info('API Request completed', {
      request_id: requestId,
      method,
      endpoint,
      status: response.status,
      duration_ms: duration,
    });

    let data: T | ApiErrorResponse;

    try {
      data = await response.json();
    } catch {
      // Handle non-JSON responses
      data = { error: 'Invalid JSON response' };
    }

    if (!response.ok) {
      logger.error('API Request failed', {
        request_id: requestId,
        method,
        endpoint,
        status: response.status,
        error: (data as ApiErrorResponse).error?.toString(),
      });

      throw new ApiError(response.status, data as ApiErrorResponse);
    }

    return data as T;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof ApiError) {
      throw error; // Re-throw ApiError
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('API Request error', {
      request_id: requestId,
      method,
      endpoint,
      error: errorMessage,
      duration_ms: duration,
    });

    throw error;
  }
}

/**
 * Convenience wrapper for GET requests
 */
export async function apiGet<T>(endpoint: string, requestId?: string): Promise<T> {
  return apiClient<T>({ endpoint, method: 'GET', requestId });
}

/**
 * Convenience wrapper for POST requests
 */
export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  requestId?: string
): Promise<T> {
  return apiClient<T>({
    endpoint,
    method: 'POST',
    body: JSON.stringify(body),
    requestId,
  });
}

/**
 * Convenience wrapper for PATCH requests
 */
export async function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  requestId?: string
): Promise<T> {
  return apiClient<T>({
    endpoint,
    method: 'PATCH',
    body: JSON.stringify(body),
    requestId,
  });
}

/**
 * Convenience wrapper for DELETE requests
 */
export async function apiDelete<T>(
  endpoint: string,
  requestId?: string
): Promise<T> {
  return apiClient<T>({
    endpoint,
    method: 'DELETE',
    requestId,
  });
}
