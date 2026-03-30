/**
 * Frontend API Client
 *
 * CRITICAL SECURITY:
 * - Automatically includes HttpOnly cookies in every request
 * - credentials: 'include' ensures auth token sent to backend
 * - Handles token refresh on 401
 * - Zero-Trust: never store tokens in localStorage
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

class ApiClient {
  /**
   * Fetch with automatic credentials and error handling
   */
  private async request(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<Response> {
    const url = `${API_BASE}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // CRITICAL: Include cookies (auth tokens)
      credentials: 'include'
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // Handle 401 - token expired
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await this.refreshToken();

        if (!refreshed) {
          // Refresh failed - redirect to login
          this.handleAuthError();
          throw new Error('Authentication expired');
        }

        // Retry original request with new token
        return fetch(url, options);
      }

      return response;
    } catch (error: any) {
      console.error(`[API] Request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token cookie
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // CRITICAL: Include cookies (refresh token)
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[API] Token refresh failed');
        return false;
      }

      console.log('[API] Token refreshed');
      return true;
    } catch (error) {
      console.error('[API] Token refresh error', error);
      return false;
    }
  }

  /**
   * Handle authentication errors - redirect to login
   */
  private handleAuthError(): void {
    // Clear any client-side auth state
    localStorage.removeItem('user');

    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * GET request
   */
  async get(endpoint: string): Promise<any> {
    const response = await this.request('GET', endpoint);

    if (!response.ok) {
      throw this.handleError(response);
    }

    return response.json();
  }

  /**
   * POST request
   */
  async post(endpoint: string, data: any): Promise<any> {
    const response = await this.request('POST', endpoint, data);

    if (!response.ok) {
      throw this.handleError(response);
    }

    return response.json();
  }

  /**
   * POST with streaming response (Server-Sent Events)
   */
  async postStream(
    endpoint: string,
    data: any,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const url = `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (!response.ok) {
      throw this.handleError(response);
    }

    // Handle streaming response
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
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * PUT request
   */
  async put(endpoint: string, data: any): Promise<any> {
    const response = await this.request('PUT', endpoint, data);

    if (!response.ok) {
      throw this.handleError(response);
    }

    return response.json();
  }

  /**
   * DELETE request
   */
  async delete(endpoint: string): Promise<any> {
    const response = await this.request('DELETE', endpoint);

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
    else if (status === 429) message = 'Too many requests';
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
