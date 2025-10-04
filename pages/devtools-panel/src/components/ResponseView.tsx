import React, { useState, useEffect } from 'react';
import { HttpResponse } from '../types';
import { getResponseTabOrder, updateResponseTabOrder, type TabOrder } from '../utils/tabPersistence';

interface ResponseViewProps {
  response: HttpResponse | null;
  isLoading: boolean;
  error?: string;
}

export const ResponseView: React.FC<ResponseViewProps> = ({
  response,
  isLoading,
  error,
}) => {
  // Tab configuration for response sections with persistence
  const [tabOrder, setTabOrder] = useState<TabOrder[]>(() => getResponseTabOrder());
  const [activeTab, setActiveTab] = useState<string>('body'); // Body is default

  // Load stored tab order on mount
  useEffect(() => {
    const storedOrder = getResponseTabOrder();
    setTabOrder(storedOrder);
  }, []);
  const [draggedTab, setDraggedTab] = useState<number | null>(null);
  const [dragOverTab, setDragOverTab] = useState<number | null>(null);

  // Drag and drop handlers for tab reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTab(index);
    // Create invisible drag image
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.globalAlpha = 0;
      ctx.fillRect(0, 0, 1, 1);
    }
    e.dataTransfer.setDragImage(canvas, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverTab(index);
  };

  const handleDragLeave = () => {
    setDragOverTab(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedTab === null) return;
    
    const newTabOrder = [...tabOrder];
    const draggedItem = newTabOrder[draggedTab];
    
    // Remove dragged item
    newTabOrder.splice(draggedTab, 1);
    
    // Insert at new position
    newTabOrder.splice(dropIndex, 0, draggedItem);
    
    setTabOrder(newTabOrder);
    
    // Persist the new tab order
    updateResponseTabOrder(newTabOrder);
    
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
    setDragOverTab(null);
  };
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Executing request...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-red-600 font-medium">Request Failed</p>
          <p className="text-gray-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-600">No response yet</p>
          <p className="text-gray-500 text-sm mt-1">Execute a request to see the response</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) {
      return 'bg-green-50 text-green-800 border-green-200';
    } else if (status >= 400) {
      return 'bg-red-50 text-red-800 border-red-200';
    } else {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  const formatResponseBody = (body: string, contentType?: string) => {
    try {
      if (contentType?.includes('application/json')) {
        return JSON.stringify(JSON.parse(body), null, 2);
      }
    } catch {
      // If JSON parsing fails, return original body
    }
    return body;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Response status */}
      <div className="flex items-center gap-6 mb-4">
        <span className={`px-3 py-2 border rounded-md text-sm font-semibold shadow-sm ${getStatusColor(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="text-sm text-gray-700 font-medium">
          Response time: {response.duration || response.time}ms
        </span>
        <span className="text-sm text-gray-700 font-medium">
          Size: {(response.size / 1024).toFixed(1)}KB
        </span>
        {response.contentType && (
          <span className="text-sm text-gray-700 font-medium">
            Type: {response.contentType}
          </span>
        )}
      </div>

      {/* Response tabs */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Tab navigation */}
        <div 
          className="flex border-b border-gray-300 bg-gray-50"
          style={{ contain: 'layout' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
        >
          {tabOrder.map((tab, index) => (
            <button
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium transition-colors cursor-move select-none ${
                activeTab === tab.id
                  ? 'bg-white border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              } ${
                draggedTab === index ? 'opacity-50' : ''
              } ${
                dragOverTab === index ? 'bg-blue-100' : ''
              }`}
            >
              {tab.label}
              <span className="ml-1 text-xs text-gray-400">⋮⋮</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-auto bg-white p-4">
          {/* Body Tab */}
          {activeTab === 'body' && (
            <div className="h-full">
              <div className="h-full border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
                <pre className="text-sm font-mono text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {formatResponseBody(response.body, response.contentType)}
                </pre>
              </div>
            </div>
          )}

          {/* Headers Tab */}
          {activeTab === 'headers' && (
            <div className="h-full">
              <div className="h-full border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
                <div className="space-y-2 text-sm">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-semibold text-gray-900">{key}:</span>{' '}
                      <span className="text-gray-700">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Cookies Tab */}
          {activeTab === 'cookies' && (
            <div className="h-full">
              <div className="h-full border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
                <div className="space-y-2 text-sm">
                  {response.cookies && response.cookies.length > 0 ? (
                    response.cookies.map((cookie, index) => (
                      <div key={index} className="border-b border-gray-200 pb-2 last:border-b-0">
                        <span className="text-gray-700 font-mono text-xs break-all">{cookie}</span>
                      </div>
                    ))
                  ) : response.headers['set-cookie'] ? (
                    <div>
                      <span className="font-semibold text-gray-900">set-cookie:</span>{' '}
                      <span className="text-gray-700">{response.headers['set-cookie']}</span>
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">No cookies in response</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
