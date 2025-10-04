import React, { useState, useCallback, useEffect } from 'react';
import { HttpRequest, HttpMethod } from '../types';

interface RequestFormProps {
  request: HttpRequest;
  onRequestChange: (updates: Partial<HttpRequest>) => void;
}

export const RequestForm: React.FC<RequestFormProps> = ({
  request,
  onRequestChange,
}) => {
  // Tab configuration with Headers always first
  const [tabOrder, setTabOrder] = useState<Array<{id: 'params' | 'headers' | 'body', label: string}>>(() => [
    { id: 'headers', label: 'Headers' },
    { id: 'params', label: 'Query Parameters' },
    { id: 'body', label: 'Body' }
  ]);
  
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('headers'); // Headers is default
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

  // Sync headers with request changes
  useEffect(() => {
    const headerEntries = Object.entries(request.headers || {});

    // Always sync with the actual request headers
    if (headerEntries.length > 0) {
      setHeaders([...headerEntries]); // Force new array
    } else {
      // When completely empty, show default empty state
      setHeaders([['', '']]);
    }
  }, [request.headers]);

  // Sync query params with request changes
  useEffect(() => {
    const paramEntries = Object.entries(request.params || {});

    // Always update params to ensure proper sync
    if (paramEntries.length > 0) {
      setQueryParams([...paramEntries]); // Force new array
    } else {
      // Reset to default when params are cleared
      setQueryParams([['', '']]);
    }
  }, [request.params]);

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

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* URL Input */}
      <div className="flex gap-3">
        <select
          value={request.method}
          onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
          className="pl-4 pr-8 py-3 border border-gray-300 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        <input
          type="text"
          value={request.url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://api.example.com/users"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
        />
      </div>

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
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            onDragEnd={() => {
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            className={`px-6 py-3 text-sm font-medium transition-colors relative cursor-move ${
              activeTab === tab.id
                ? 'bg-white border-b-2 border-gray-900 text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            } ${
              draggedTab === index ? 'opacity-50' : ''
            } ${
              dragOverTab === index && draggedTab !== index ? 'border-l-4 border-blue-500' : ''
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs text-gray-400">⋮⋮</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Headers Tab */}
        <div className={`px-6 bg-white h-full ${activeTab !== 'headers' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Headers</h3>
            <div className="flex-1 min-h-0 border border-gray-300 rounded-md bg-gray-50 shadow-sm overflow-hidden">
              <div className="h-full overflow-auto p-4">
                <div className="space-y-3">
                  {headers.map(([key, value], index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={key}
                        onChange={(e) => handleHeaderChange(index, e.target.value, value)}
                        placeholder="Header name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      <input
                        value={value}
                        onChange={(e) => handleHeaderChange(index, key, e.target.value)}
                        placeholder="Header value"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      {headers.length > 1 && (
                        <button
                          onClick={() => removeHeader(index)}
                          className="px-2 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
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
        <div className={`px-6 bg-white h-full ${activeTab !== 'params' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Query Parameters</h3>
            <div className="flex-1 min-h-0 border border-gray-300 rounded-md bg-gray-50 shadow-sm overflow-hidden">
              <div className="h-full overflow-auto p-4">
                <div className="space-y-3">
                  {queryParams.map(([key, value], index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={key}
                        onChange={(e) => handleParamChange(index, e.target.value, value)}
                        placeholder="Parameter name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      <input
                        value={value}
                        onChange={(e) => handleParamChange(index, key, e.target.value)}
                        placeholder="Parameter value"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      {queryParams.length > 1 && (
                        <button
                          onClick={() => removeParam(index)}
                          className="px-2 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
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
        <div className={`px-6 bg-white h-full ${activeTab !== 'body' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Body</h3>
            <div className="flex-1 min-h-0 border border-gray-300 rounded-md shadow-sm">
              <textarea
                value={request.body || ''}
                onChange={(e) => handleBodyChange(e.target.value)}
                className="w-full h-full p-4 text-sm font-mono resize-none border-0 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                placeholder='{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
