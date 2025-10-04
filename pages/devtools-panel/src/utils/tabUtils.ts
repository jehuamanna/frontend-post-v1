import { Tab, HttpRequest, HttpMethod } from '../types';

export const createDefaultRequest = (): HttpRequest => ({
  url: '',
  method: 'GET',
  headers: {},
  body: '',
  params: {},
});

export const createNewTab = (name?: string, request?: Partial<HttpRequest>): Tab => {
  const id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const defaultRequest = createDefaultRequest();
  const finalRequest = { ...defaultRequest, ...request };
  
  return {
    id,
    name: name || `New Request ${finalRequest.method}`,
    data: {
      request: finalRequest,
      response: null,
      fetchInput: undefined,
      curlInput: undefined,
    },
    isActive: false,
    isLoading: false,
    abortController: undefined,
    lastError: undefined,
  };
};

export const getMethodColor = (method: HttpMethod): string => {
  const colors: Record<HttpMethod, string> = {
    GET: 'bg-green-100 text-green-800 border-green-200',
    POST: 'bg-orange-100 text-orange-800 border-orange-200',
    PUT: 'bg-blue-100 text-blue-800 border-blue-200',
    PATCH: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    DELETE: 'bg-red-100 text-red-800 border-red-200',
    HEAD: 'bg-purple-100 text-purple-800 border-purple-200',
    OPTIONS: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colors[method];
};

export const getStatusColor = (status?: number): string => {
  if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
  
  if (status >= 200 && status < 300) {
    return 'bg-green-100 text-green-800 border-green-200';
  } else if (status >= 400) {
    return 'bg-red-100 text-red-800 border-red-200';
  } else {
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};

export const formatTabName = (name: string, method: HttpMethod): string => {
  // Remove existing method suffix if present
  const cleanName = name.replace(/\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/, '');
  return `${cleanName} ${method}`;
};

export const truncateTabName = (name: string, maxLength: number = 20): string => {
  return name.length > maxLength ? `${name.substring(0, maxLength)}...` : name;
};
