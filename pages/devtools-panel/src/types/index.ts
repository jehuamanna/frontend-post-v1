export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers: Record<string, string>;
  body?: string;
  params?: Record<string, string>; // Query parameters
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number; // Response size in bytes
  time: number; // Request duration in milliseconds
  url: string; // Final URL after redirects
  ok: boolean; // Whether the response was successful (status 200-299)
  error?: string; // Error message if request failed
  cookies: string[]; // Array of cookie strings from Chrome Cookies API
  contentType?: string; // Content-Type header for easier access
  duration?: number; // Alias for time (for compatibility)
}

export interface Tab {
  id: string;
  name: string;
  data: {
    request: HttpRequest;
    response: HttpResponse | null;
    rawCommand?: string; // Store original command (fetch or cURL)
    commandType?: 'fetch' | 'curl'; // Detected command type
  };
  isActive: boolean;
  
  // Request state
  isLoading: boolean; // Currently executing request
  abortController?: AbortController; // For canceling ongoing requests
  
  // Error handling
  lastError?: string; // Last execution error message
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TabContextType {
  tabs: Tab[];
  activeTabId: string;
  createTab: (name?: string, request?: Partial<HttpRequest>) => string;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  updateRequest: (tabId: string, request: Partial<HttpRequest>) => void;
  updateResponse: (tabId: string, response: HttpResponse | null) => void;
}
