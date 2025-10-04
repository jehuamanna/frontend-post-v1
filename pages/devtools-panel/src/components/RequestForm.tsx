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
  const [headers, setHeaders] = useState(() => {
    const headerEntries = Object.entries(request.headers);
    return headerEntries.length > 0 
      ? headerEntries 
      : [['Content-Type', 'application/json'], ['Authorization', '']];
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
    console.log('Headers changed:', request.headers, 'entries:', headerEntries);
    
    // Always sync with the actual request headers
    if (headerEntries.length > 0) {
      setHeaders([...headerEntries]); // Force new array
    } else {
      // When completely empty, show default empty state
      console.log('Resetting headers to empty state');
      setHeaders([['', '']]);
    }
  }, [request.headers]);

  // Sync query params with request changes
  useEffect(() => {
    const paramEntries = Object.entries(request.params || {});
    console.log('Params changed:', request.params, 'entries:', paramEntries);
    
    // Always update params to ensure proper sync
    if (paramEntries.length > 0) {
      setQueryParams([...paramEntries]); // Force new array
    } else {
      // Reset to default when params are cleared
      console.log('Resetting params to default');
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

      {/* Query Parameters, Headers and Body sections */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Parameters section */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Query Parameters</h3>
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

        {/* Headers section */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Headers</h3>
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

        {/* Body section */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Body</h3>
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
  );
};
