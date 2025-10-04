import { HttpRequest, HttpResponse } from '../types';

export interface RequestOptions {
  timeout?: number;
  followRedirects?: boolean;
}

export class HttpClient {
  private static defaultTimeout = 30000; // 30 seconds

  static async executeRequest(
    request: HttpRequest,
    options: RequestOptions = {}
  ): Promise<HttpResponse> {
    const startTime = Date.now();
    
    try {
      // Validate request
      if (!request.url) {
        throw new Error('URL is required');
      }

      // Build full URL with query parameters
      const url = this.buildUrl(request.url, request.params || {});
      
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: this.prepareHeaders(request.headers || {}),
        signal: AbortSignal.timeout(options.timeout || this.defaultTimeout),
      };

      // Add body for methods that support it
      if (this.methodSupportsBody(request.method) && request.body) {
        fetchOptions.body = request.body;
      }

      // Execute the request
      const response = await fetch(url, fetchOptions);
      const endTime = Date.now();
      
      // Parse response
      const responseData = await this.parseResponse(response);
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: this.parseResponseHeaders(response.headers),
        body: responseData.body,
        size: responseData.size,
        time: endTime - startTime,
        url: response.url,
        ok: response.ok,
      };
      
    } catch (error) {
      const endTime = Date.now();
      
      // Handle different types of errors
      let errorMessage = 'Unknown error occurred';
      let status = 0;
      
      if (error instanceof TypeError) {
        errorMessage = 'Network error - Check your connection or URL';
        status = 0;
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        errorMessage = 'Request timeout';
        status = 408;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        status,
        statusText: errorMessage,
        headers: {},
        body: errorMessage,
        size: 0,
        time: endTime - startTime,
        url: request.url,
        ok: false,
        error: errorMessage,
      };
    }
  }

  private static buildUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (key.trim() && value !== undefined) {
        url.searchParams.set(key, value);
      }
    });
    
    return url.toString();
  }

  private static prepareHeaders(headers: Record<string, string>): Record<string, string> {
    const prepared: Record<string, string> = {};
    
    Object.entries(headers).forEach(([key, value]) => {
      if (key.trim() && value !== undefined) {
        prepared[key.trim()] = value;
      }
    });
    
    return prepared;
  }

  private static methodSupportsBody(method: string): boolean {
    const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
    return methodsWithBody.includes(method.toUpperCase());
  }

  private static async parseResponse(response: Response): Promise<{
    body: string;
    size: number;
  }> {
    const contentType = response.headers.get('content-type') || '';
    
    try {
      // Get response as text first to calculate size
      const text = await response.text();
      const size = new Blob([text]).size;
      
      // Try to format JSON responses
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(text);
          return {
            body: JSON.stringify(parsed, null, 2),
            size,
          };
        } catch {
          // If JSON parsing fails, return as text
          return { body: text, size };
        }
      }
      
      // Return as text for other content types
      return { body: text, size };
      
    } catch (error) {
      return {
        body: `Error reading response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        size: 0,
      };
    }
  }

  private static parseResponseHeaders(headers: Headers): Record<string, string> {
    const parsed: Record<string, string> = {};
    
    headers.forEach((value, key) => {
      parsed[key] = value;
    });
    
    return parsed;
  }

  // Utility method to format response time
  static formatTime(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }

  // Utility method to format response size
  static formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  // Utility method to get status color class
  static getStatusColor(status: number): string {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-blue-600';
    if (status >= 400 && status < 500) return 'text-orange-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  }
}
