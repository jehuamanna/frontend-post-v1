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
  timestamp: number;
  duration: number; // in milliseconds
  size: number; // Response size in bytes
  contentType?: string; // Extracted from headers for convenience
}

export interface Tab {
  id: string;
  name: string;
  data: {
    request: HttpRequest;
    response: HttpResponse | null;
    rawInput?: string; // Store original cURL/fetch for reference
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
