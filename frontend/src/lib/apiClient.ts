/**
 * ⚡ PRODUCTION FRONTEND API CLIENT (100K Concurrent Users)
 *
 * CRITICAL FEATURES:
 * ✅ Automatic HttpOnly cookie inclusion (credentials: 'include')
 * ✅ JWT token refresh on 401 (seamless re-authentication)
 * ✅ Request deduplication (prevents double-submit)
 * ✅ Exponential backoff retry (handles transient failures)
 * ✅ Circuit breaker pattern (stop hammering broken endpoint)
 * ✅ Streaming response support (SSE for AI/chat)
 *
 * ZERO client-side token storage (no localStorage XSS vector)
 *
 * Usage:
 * ```typescript
 * import { apiClient } from './lib/apiClient';
 *
 * const response = await apiClient.post('/api/chat/completions', {
 *   messages: [...],
 *   sessionId: 'xyz'
 * });
 * ```
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiError {
  status: number;
  message: string;
  details?: any;
}

interface RequestConfig {
  retries?: number;
  retryDelay?: number; // ms
  timeout?: number; // ms
  skipDedup?: boolean;
}

/**
 * REQUEST DEDUPLICATION
 * Prevents duplicate requests from reaching backend
 * Example: User frantically clicks button → only first request goes through
 */
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<Response>>();

  /**
   * Generate request key: method:endpoint:hash(body)
   */
  private getKey(method: string, endpoint: string, data?: any): string {
    const bodyStr = data ? JSON.stringify(data) : '';
    const hash = bodyStr.substring(0, 32);
    return `${method}:${endpoint}:${hash}`;
  }

  /**
   * Execute fetch, reuse if already in-flight
   */
  async fetch(
    method: string,
    endpoint: string,
    options: RequestInit,
    data?: any
  ): Promise<Response> {
    const key = this.getKey(method, endpoint, data);

    // Check if request already in-flight
    if (this.pendingRequests.has(key)) {
      console.debug(`[API] Deduplicating request: ${key}`);
      return this.pendingRequests.get(key)!;
    }

    // Execute fetch
    const promise = fetch(`${API_BASE}${endpoint}`, options)
      .finally(() => {
        // Clean up after response received
        this.pendingRequests.delete(key);
      });

    // Store in-flight request
    this.pendingRequests.set(key, promise);
    return promise;
  }
}

/**
 * CIRCUIT BREAKER
 * Stops retrying if endpoint is consistently failing
 * Prevents "thundering herd" of retry requests
 */
class CircuitBreaker {
  private failures = new Map<string, { count: number; timestamp: number }>();
  private readonly failureThreshold = 5;
  private readonly resetTimeMs = 60000; // 1 minute

  isOpen(endpoint: string): boolean {
    const stats = this.failures.get(endpoint);
    if (!stats) return false;

    // Reset if enough time has passed
    if (Date.now() - stats.timestamp > this.resetTimeMs) {
      this.failures.delete(endpoint);
      return false;
    }

    return stats.count >= this.failureThreshold;
  }

  recordFailure(endpoint: string): void {
    const stats = this.failures.get(endpoint) || { count: 0, timestamp: Date.now() };
    stats.count++;
    stats.timestamp = Date.now();
    this.failures.set(endpoint, stats);
  }

  recordSuccess(endpoint: string): void {
    this.failures.delete(endpoint);
  }
}

class ApiClient {
  private deduplicator = new RequestDeduplicator();
  private circuitBreaker = new CircuitBreaker();
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * EXPONENTIAL BACKOFF RETRY
   * Retry up to N times with exponential delay
   *
   * Retryable errors:
   * - 429: Rate limited (wait and retry)
   * - 503: Service unavailable (wait and retry)
   * - Network errors: Connection issues (wait and retry)
   *
   * Non-retryable errors:
   * - 400: Bad request (won't fix itself)
   * - 401: Unauthorized (needs login)
   * - 404: Not found (won't fix itself)
   */
  private async requestWithRetry(
    method: string,
    endpoint: string,
    data: any | undefined,
    config: RequestConfig
  ): Promise<Response> {
    const maxRetries = config.retries ?? 3;
    const baseDelay = config.retryDelay ?? 100; // ms
    const timeout = config.timeout ?? 30000; // 30s

    // Check circuit breaker
    if (this.circuitBreaker.isOpen(endpoint)) {
      throw new Error(`Circuit breaker open for ${endpoint} - endpoint is down`);
    }

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include', // ✅ Auto-include HttpOnly cookies
          signal: AbortSignal.timeout(timeout)
        };

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data);
        }

        // Use deduplicator to prevent duplicate requests
        const response = config.skipDedup
          ? await fetch(`${API_BASE}${endpoint}`, options)
          : await this.deduplicator.fetch(method, endpoint, options, data);

        // Handle 401 - token expired
        if (response.status === 401) {
          const refreshed = await this.refreshToken();
          if (!refreshed) {
            this.handleAuthError();
            throw new Error('Authentication expired');
          }
          // Retry request with new token
          continue;
        }

        // Handle retryable errors
        if (response.status === 429 || response.status === 503) {
          if (attempt < maxRetries) {
            // Exponential backoff: 100ms, 200ms, 400ms
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`[API] ${response.status} error on attempt ${attempt + 1}, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Success or non-retryable error
        if (response.ok) {
          this.circuitBreaker.recordSuccess(endpoint);
        } else {
          this.circuitBreaker.recordFailure(endpoint);
        }

        return response;
      } catch (error: any) {
        lastError = error;

        // Retryable network errors
        if (
          error instanceof TypeError &&
          (error.message.includes('fetch') || error.message.includes('Network'))
        ) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`[API] Network error on attempt ${attempt + 1}, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // AbortError (timeout)
        if (error.name === 'AbortError') {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`[API] Timeout on attempt ${attempt + 1}, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Non-retryable error
        this.circuitBreaker.recordFailure(endpoint);
        throw error;
      }
    }

    // All retries exhausted
    this.circuitBreaker.recordFailure(endpoint);
    throw lastError;
  }

  /**
   * Refresh access token using refresh token cookie
   * Prevents "thundering herd" of concurrent refresh calls
   */
  private async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      // Already refreshing, wait for result
      return this.refreshPromise || false;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' // ✅ Send refresh token cookie
        });

        if (!response.ok) {
          console.warn('[API] Token refresh failed', { status: response.status });
          return false;
        }

        console.log('[API] Token refreshed successfully');
        return true;
      } catch (error) {
        console.error('[API] Token refresh error', error);
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Handle authentication errors - redirect to login
   */
  private handleAuthError(): void {
    if (typeof window !== 'undefined') {
      console.warn('[API] Redirecting to login');
      window.location.href = '/login';
    }
  }

  /**
   * GET request with exponential backoff
   */
  async get(endpoint: string, config?: RequestConfig): Promise<any> {
    const response = await this.requestWithRetry('GET', endpoint, undefined, config || {});

    if (!response.ok) {
      throw this.handleError(response);
    }

    return response.json();
  }

  /**
   * POST request with exponential backoff
   */
  async post(endpoint: string, data: any, config?: RequestConfig): Promise<any> {
    const response = await this.requestWithRetry('POST', endpoint, data, config || {});

    if (!response.ok) {
      throw this.handleError(response);
    }

    return response.json();
  }

  /**
   * POST with streaming response (Server-Sent Events)
   * Used for AI chat completions
   */
  async postStream(
    endpoint: string,
    data: any,
    onChunk: (chunk: string) => void,
    config?: RequestConfig
  ): Promise<void> {
    const response = await this.requestWithRetry(
      'POST',
      endpoint,
      data,
      { ...config, skipDedup: true } // Never dedup streams
    );

    if (!response.ok) {
      throw this.handleError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.choices?.[0]?.delta?.content) {
                onChunk(json.choices[0].delta.content);
              }
            } catch {
              // Ignore SSE parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * PUT request with exponential backoff
   */
  async put(endpoint: string, data: any, config?: RequestConfig): Promise<any> {
    const response = await this.requestWithRetry('PUT', endpoint, data, config || {});

    if (!response.ok) {
      throw this.handleError(response);
    }

    return response.json();
  }

  /**
   * DELETE request with exponential backoff
   */
  async delete(endpoint: string, config?: RequestConfig): Promise<any> {
    const response = await this.requestWithRetry('DELETE', endpoint, undefined, config || {});

    if (!response.ok) {
      throw this.handleError(response);
    }

    return response.json();
  }

  /**
   * Parse error response
   */
  private handleError(response: Response): ApiError {
    const status = response.status;
    let message = 'API request failed';

    if (status === 400) message = 'Bad request';
    else if (status === 401) message = 'Unauthorized';
    else if (status === 403) message = 'Forbidden';
    else if (status === 404) message = 'Not found';
    else if (status === 429) message = 'Too many requests - rate limited';
    else if (status === 503) message = 'Service temporarily unavailable';
    else if (status >= 500) message = 'Server error';

    return {
      status,
      message,
      details: undefined
    };
  }
}

/**
 * Singleton API client
 * Use throughout frontend without creating new instances
 */
export const apiClient = new ApiClient();

export default apiClient;
