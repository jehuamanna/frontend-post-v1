// Chrome Extension HTTP Client
// Implements the DevTools Panel side of the Chrome Runtime Port communication
// Based on the inspiration architecture for bypassing CORS restrictions

interface FetchRequest {
  type: 'EXECUTE_FETCH';
  url: string;
  options: RequestInit;
  requestId: string;
}

interface FetchResponse {
  type: 'FETCH_RESULT' | 'FETCH_ERROR';
  result?: {
    body: string;
    headers: Record<string, string>;
    cookies: string[];
    status: number;
    statusText: string;
    size: number;
    time: number;
    url: string;
    ok: boolean;
    contentType?: string;
  };
  error?: string;
  requestId: string;
}

interface FetchResult {
  body: string;
  headers: Record<string, string>;
  cookies: string[];
  status: number;
  statusText: string;
  size: number;
  time: number;
  url: string;
  ok: boolean;
  contentType?: string;
}

class ChromeHttpClient {
  private port: chrome.runtime.Port | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: FetchResult) => void;
    reject: (reason: Error) => void;
    abortController?: AbortController;
  }>();

  constructor() {
    this.ensureConnection();
  }

  // Establish connection to background script
  private ensureConnection(): Promise<chrome.runtime.Port> {
    return new Promise((resolve, reject) => {
      if (this.port && !this.isPortDisconnected(this.port)) {
        console.log('🔗 Reusing existing port connection');
        resolve(this.port);
        return;
      }

      try {
        console.log('🔌 Establishing new connection to background script...');
        
        // Check if chrome.runtime is available
        if (!chrome || !chrome.runtime) {
          throw new Error('Chrome runtime not available - not running in extension context');
        }

        // Establish new connection to background script
        this.port = chrome.runtime.connect({ name: 'devtools-panel' });
        console.log('✅ Port connection established:', this.port.name);
        
        this.setupPortHandlers(this.port);
        resolve(this.port);
      } catch (error) {
        console.error('❌ Failed to connect to background script:', error);
        reject(new Error(`Failed to connect to background script: ${error}`));
      }
    });
  }

  // Check if port is disconnected
  private isPortDisconnected(port: chrome.runtime.Port): boolean {
    try {
      return !port || !port.name;
    } catch (error) {
      return true;
    }
  }

  // Set up port event handlers
  private setupPortHandlers(port: chrome.runtime.Port) {
    console.log('🔧 Setting up port handlers for:', port.name);
    
    // Handle messages from background script
    port.onMessage.addListener((message: FetchResponse) => {
      console.log('📨 Received message from background:', message.type, message.requestId);
      this.handleResponse(message);
    });

    // Handle port disconnection
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.warn('🔌 Port disconnected:', error?.message || 'Unknown reason');
      console.warn('Pending requests count:', this.pendingRequests.size);
      
      // Reject all pending requests
      this.pendingRequests.forEach((request, requestId) => {
        const errorMsg = error?.message 
          ? `Port disconnected: ${error.message}` 
          : `Port disconnected during request ${requestId}`;
        request.reject(new Error(errorMsg));
      });
      
      // Clear pending requests
      this.pendingRequests.clear();
      
      // Reset port reference
      this.port = null;
    });
  }

  // Handle response messages from background script
  private handleResponse(message: FetchResponse) {
    const { requestId, type, result, error } = message;
    
    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest) {
      console.warn(`Received response for unknown request: ${requestId}`);
      return;
    }

    // Remove from pending requests
    this.pendingRequests.delete(requestId);

    if (type === 'FETCH_RESULT' && result) {
      console.log(`✅ Request ${requestId} completed successfully`);
      pendingRequest.resolve(result);
    } else if (type === 'FETCH_ERROR') {
      console.error(`❌ Request ${requestId} failed:`, error);
      pendingRequest.reject(new Error(error || 'Unknown error'));
    }
  }

  // Generate unique request ID
  private generateRequestId(url: string): string {
    return `${url}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // Execute HTTP request through background script
  async fetch(url: string, options: RequestInit = {}): Promise<FetchResult> {
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Ensure connection to background script
    console.log('🔄 Ensuring connection to background script...');
    const port = await this.ensureConnection();
    
    // Generate unique request ID
    const requestId = this.generateRequestId(url);
    
    console.log(`🚀 [${requestId}] Executing request: ${options.method || 'GET'} ${url}`);
    console.log(`📋 [${requestId}] Request options:`, this.sanitizeOptions(options));

    // Create AbortController for cancellation support
    const abortController = new AbortController();

    // Create promise for async response handling
    const requestPromise = new Promise<FetchResult>((resolve, reject) => {
      // Store request handlers with abort controller
      this.pendingRequests.set(requestId, { resolve, reject, abortController });
      console.log(`📝 [${requestId}] Added to pending requests (total: ${this.pendingRequests.size})`);
      
      // Send request to background script
      const message: FetchRequest = {
        type: 'EXECUTE_FETCH',
        url,
        options: this.sanitizeOptions(options),
        requestId
      };
      
      try {
        console.log(`📤 [${requestId}] Sending message to background script...`);
        port.postMessage(message);
        console.log(`✅ [${requestId}] Message sent successfully`);
      } catch (error) {
        console.error(`❌ [${requestId}] Failed to send message:`, error);
        // Clean up if message sending fails
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send request: ${error}`));
      }
      
      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          console.warn(`⏰ [${requestId}] Request timeout after 30 seconds`);
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request timeout after 30 seconds`));
        }
      }, 30000);
    });

    return requestPromise;
  }

  // Cancel a specific request by ID
  cancelRequest(requestId: string): boolean {
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      console.log(`🚫 [${requestId}] Cancelling request`);
      
      // Trigger abort controller if available
      if (pendingRequest.abortController) {
        pendingRequest.abortController.abort();
      }
      
      // Remove from pending requests and reject
      this.pendingRequests.delete(requestId);
      pendingRequest.reject(new Error('Request cancelled by user'));
      
      return true;
    }
    return false;
  }

  // Cancel all pending requests
  cancelAllRequests(): number {
    const count = this.pendingRequests.size;
    console.log(`🚫 Cancelling ${count} pending requests`);
    
    this.pendingRequests.forEach((request, requestId) => {
      if (request.abortController) {
        request.abortController.abort();
      }
      request.reject(new Error('Request cancelled by user'));
    });
    
    this.pendingRequests.clear();
    return count;
  }

  // Get list of pending request IDs
  getPendingRequestIds(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  // Sanitize request options for message passing
  private sanitizeOptions(options: RequestInit): RequestInit {
    const sanitized: RequestInit = {
      method: options.method,
      headers: options.headers,
      body: options.body
    };

    // Remove undefined values to reduce message size
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key as keyof RequestInit] === undefined) {
        delete sanitized[key as keyof RequestInit];
      }
    });

    return sanitized;
  }

  // Clean up resources
  disconnect() {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
    
    // Reject any pending requests
    this.pendingRequests.forEach((request, requestId) => {
      request.reject(new Error(`Client disconnected during request ${requestId}`));
    });
    
    this.pendingRequests.clear();
  }

  // Get connection status
  isConnected(): boolean {
    return this.port !== null && !this.isPortDisconnected(this.port);
  }
}

// Export singleton instance
export const chromeHttpClient = new ChromeHttpClient();

// Export types for use in other components
export type { FetchResult };
