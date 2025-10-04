import React, { useState, useCallback, useEffect } from 'react';
import { HttpRequest, HttpMethod } from '../types';
import { getRequestTabOrder, updateRequestTabOrder, type TabOrder } from '../utils/tabPersistence';

// Copy to clipboard utility
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackErr) {
      console.error('Failed to copy to clipboard:', fallbackErr);
      return false;
    }
  }
};

interface RequestFormProps {
  request: HttpRequest;
  onRequestChange: (updates: Partial<HttpRequest>) => void;
}

export const RequestForm: React.FC<RequestFormProps> = ({
  request,
  onRequestChange,
}) => {
  // Tab configuration with persistence
  const [tabOrder, setTabOrder] = useState<TabOrder[]>(() => getRequestTabOrder());
  const [activeTab, setActiveTab] = useState<string>('headers'); // Headers is default

  // Load stored tab order on mount
  useEffect(() => {
    const storedOrder = getRequestTabOrder();
    setTabOrder(storedOrder);
  }, []);
  const [draggedTab, setDraggedTab] = useState<number | null>(null);
  const [dragOverTab, setDragOverTab] = useState<number | null>(null);

  const [headers, setHeaders] = useState(() => {
    const headerEntries = Object.entries(request.headers || {});
    return headerEntries.length > 0
      ? headerEntries
      : [['', '']]; // Start with empty headers
  });

  const [queryParams, setQueryParams] = useState(() => {
    const paramEntries = Object.entries(request.params || {});
    return paramEntries.length > 0
      ? paramEntries
      : [['', '']];
  });

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Copy feedback timeout
  useEffect(() => {
    if (copyFeedback) {
      const timer = setTimeout(() => setCopyFeedback(null), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copyFeedback]);

  // Sync headers with request changes
  useEffect(() => {
    const headerEntries = Object.entries(request.headers || {});

    // Force update headers state regardless of current state
    if (headerEntries.length > 0) {
      setHeaders([...headerEntries]);
    } else {
      // When completely empty, always reset to default empty state
      setHeaders([['', '']]);
    }
  }, [JSON.stringify(request.headers)]); // Use JSON.stringify to detect deep changes

  // Sync query params with request changes
  useEffect(() => {
    const paramEntries = Object.entries(request.params || {});

    // Force update params state
    if (paramEntries.length > 0) {
      setQueryParams([...paramEntries]);
    } else {
      // Reset to default when params are cleared
      setQueryParams([['', '']]);
    }
  }, [JSON.stringify(request.params)]); // Use JSON.stringify to detect deep changes

  const handleMethodChange = useCallback((method: HttpMethod) => {
    onRequestChange({ method });
  }, [onRequestChange]);

  const handleUrlChange = useCallback((url: string) => {
    onRequestChange({ url });
  }, [onRequestChange]);

  const handleBodyChange = useCallback((body: string) => {
    onRequestChange({ body });
  }, [onRequestChange]);

  const handleHeaderChange = useCallback((index: number, key: string, value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = [key, value];
    setHeaders(newHeaders);

    // Convert to object and update request
    const headersObj = newHeaders.reduce((acc, [k, v]) => {
      if (k.trim()) acc[k.trim()] = v;
      return acc;
    }, {} as Record<string, string>);

    onRequestChange({ headers: headersObj });
  }, [headers, onRequestChange]);

  const addHeader = useCallback(() => {
    setHeaders(prev => [...prev, ['', '']]);
  }, []);

  const removeHeader = useCallback((index: number) => {
    if (headers.length > 1) {
      const newHeaders = headers.filter((_, i) => i !== index);
      setHeaders(newHeaders);

      const headersObj = newHeaders.reduce((acc, [k, v]) => {
        if (k.trim()) acc[k.trim()] = v;
        return acc;
      }, {} as Record<string, string>);

      onRequestChange({ headers: headersObj });
    }
  }, [headers, onRequestChange]);

  const handleParamChange = useCallback((index: number, key: string, value: string) => {
    const newParams = [...queryParams];
    newParams[index] = [key, value];
    setQueryParams(newParams);

    // Convert to object and update request
    const paramsObj = newParams.reduce((acc, [k, v]) => {
      if (k.trim()) acc[k.trim()] = v;
      return acc;
    }, {} as Record<string, string>);

    onRequestChange({ params: paramsObj });
  }, [queryParams, onRequestChange]);

  const addParam = useCallback(() => {
    setQueryParams(prev => [...prev, ['', '']]);
  }, []);

  const removeParam = useCallback((index: number) => {
    if (queryParams.length > 1) {
      const newParams = queryParams.filter((_, i) => i !== index);
      setQueryParams(newParams);

      const paramsObj = newParams.reduce((acc, [k, v]) => {
        if (k.trim()) acc[k.trim()] = v;
        return acc;
      }, {} as Record<string, string>);

      onRequestChange({ params: paramsObj });
    }
  }, [queryParams, onRequestChange]);

  // Copy functions for individual fields
  const copyText = useCallback(async (text: string, fieldName: string) => {
    if (text.trim()) {
      const success = await copyToClipboard(text);
      setCopyFeedback(success ? `${fieldName} copied!` : 'Copy failed');
    }
  }, []);

  return (
    <div className="h-full flex flex-col space-y-3">
      {/* URL Input */}
      <div className="flex gap-3">
        <select
          value={request.method}
          onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
          className="pl-3 pr-6 py-2 border border-gray-300 rounded text-xs font-medium bg-white text-gray-900 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        <div className="flex-1 relative">
          <input
            type="text"
            value={request.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://api.example.com/users"
            className="w-full px-3 py-2 pr-6 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
          />
          {request.url && (
            <button
              onClick={() => copyText(request.url, 'URL')}
              className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy URL"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Copy Feedback */}
      {copyFeedback && (
        <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-md shadow-lg z-50">
          {copyFeedback}
        </div>
      )}

      {/* Tab Navigation - All Draggable (X-axis only) */}
      <div
        className="flex border-b border-gray-300 bg-gray-50 relative"
        onDragOver={(e) => {
          // Only allow drops within the tab container
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          // Prevent drops outside of individual tabs
          e.preventDefault();
        }}
      >
        {tabOrder.map((tab, index) => (
          <button
            key={tab.id}
            draggable={true} // All tabs are now draggable
            onClick={() => setActiveTab(tab.id)}
            onDragStart={(e) => {
              setDraggedTab(index);
              e.dataTransfer.effectAllowed = 'move';

              // Create a transparent 1x1 pixel drag image to hide the default ghost
              const canvas = document.createElement('canvas');
              canvas.width = 1;
              canvas.height = 1;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.globalAlpha = 0;
                ctx.fillRect(0, 0, 1, 1);
              }
              e.dataTransfer.setDragImage(canvas, 0, 0);
              e.dataTransfer.setData('text/plain', '');
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverTab(index);
            }}
            onDragLeave={() => {
              setDragOverTab(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedTab === null || draggedTab === index) return;

              const newTabOrder = [...tabOrder];
              const draggedItem = newTabOrder[draggedTab];
              newTabOrder.splice(draggedTab, 1);
              newTabOrder.splice(index, 0, draggedItem);

              setTabOrder(newTabOrder);
              
              // Persist the new tab order
              updateRequestTabOrder(newTabOrder);
              
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            onDragEnd={() => {
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            className={`px-4 py-2 text-xs font-medium transition-colors relative cursor-move ${activeTab === tab.id
                ? 'bg-white border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              } ${draggedTab === index ? 'opacity-50' : ''
              } ${dragOverTab === index && draggedTab !== index ? 'border-l-4 border-blue-500' : ''
              }`}
          >
            {tab.label}
            <span className="ml-1 text-xs text-gray-400">⋮⋮</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {/* Headers Tab */}
        <div className={`px-3 bg-white h-full ${activeTab !== 'headers' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-900">Headers</h3>
            </div>
            <div className="flex-1 min-h-0 border border-gray-300 rounded bg-gray-50 overflow-hidden">
              <div className="h-full overflow-auto p-2">
                <div className="space-y-2">
                  {headers.map(([key, value], index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <input
                          value={key}
                          onChange={(e) => handleHeaderChange(index, e.target.value, value)}
                          placeholder="Header name"
                          className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                        />
                        {key.trim() && (
                          <button
                            onClick={() => copyText(key, 'Header name')}
                            className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy header name"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          value={value}
                          onChange={(e) => handleHeaderChange(index, key, e.target.value)}
                          placeholder="Header value"
                          className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                        />
                        {value.trim() && (
                          <button
                            onClick={() => copyText(value, 'Header value')}
                            className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy header value"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {headers.length > 1 && (
                        <button
                          onClick={() => removeHeader(index)}
                          className="px-1.5 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addHeader}
                    className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                  >
                    + Add Header
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Query Parameters Tab */}
        <div className={`px-3 bg-white h-full ${activeTab !== 'params' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-900">Query Parameters</h3>
            </div>
            <div className="flex-1 min-h-0 border border-gray-300 rounded bg-gray-50 overflow-hidden">
              <div className="h-full overflow-auto p-2">
                <div className="space-y-2">
                  {queryParams.map(([key, value], index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <input
                          value={key}
                          onChange={(e) => handleParamChange(index, e.target.value, value)}
                          placeholder="Parameter name"
                          className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                        />
                        {key.trim() && (
                          <button
                            onClick={() => copyText(key, 'Parameter name')}
                            className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy parameter name"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          value={value}
                          onChange={(e) => handleParamChange(index, key, e.target.value)}
                          placeholder="Parameter value"
                          className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                        />
                        {value.trim() && (
                          <button
                            onClick={() => copyText(value, 'Parameter value')}
                            className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy parameter value"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {queryParams.length > 1 && (
                        <button
                          onClick={() => removeParam(index)}
                          className="px-1.5 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addParam}
                    className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                  >
                    + Add Parameter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body Tab */}
        <div className={`px-3 bg-white h-full ${activeTab !== 'body' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-900">Body</h3>
            </div>
            <div className="flex-1 min-h-0 border border-gray-300 rounded relative">
              <textarea
                value={request.body || ''}
                onChange={(e) => handleBodyChange(e.target.value)}
                className="w-full h-full p-2 pr-8 text-xs font-mono resize-none border-0 rounded bg-white text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                placeholder='{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
              />
              {request.body && (
                <button
                  onClick={() => copyText(request.body || '', 'Body')}
                  className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy body content"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
