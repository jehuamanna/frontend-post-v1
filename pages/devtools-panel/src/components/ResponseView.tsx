import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { HttpResponse } from '../types';
import { getResponseTabOrder, updateResponseTabOrder, type TabOrder } from '../utils/tabPersistence';

// CodeMirror theme for response viewer
const responseViewerTheme = EditorView.theme({
  "&": {
    backgroundColor: "#f9fafb",
    color: "#1f2937",
    fontSize: "14px",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
  },
  ".cm-content": {
    backgroundColor: "#f9fafb",
    caretColor: "#1f2937",
    padding: "16px"
  },
  ".cm-focused": {
    backgroundColor: "#f9fafb",
    outline: "none"
  },
  ".cm-editor.cm-focused": {
    backgroundColor: "#f9fafb"
  },
  ".cm-scroller": {
    backgroundColor: "#f9fafb"
  },
  ".cm-gutters": {
    backgroundColor: "#f3f4f6",
    color: "#9ca3af",
    border: "none",
    borderRight: "1px solid #e5e7eb"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "#9ca3af",
    fontSize: "12px"
  },
  ".cm-activeLine": {
    backgroundColor: "#f3f4f6"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e5e7eb"
  },
  ".cm-cursor": {
    display: "none" // Hide cursor since this is read-only
  }
});

// Cookie parsing utility
interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

const parseCookieString = (cookieString: string): ParsedCookie => {
  const parts = cookieString.split(';').map(part => part.trim());
  const [nameValue, ...attributes] = parts;
  
  const [name, value] = nameValue.split('=');
  const parsed: ParsedCookie = {
    name: name?.trim() || '',
    value: value?.trim() || ''
  };
  
  attributes.forEach(attr => {
    const [key, val] = attr.split('=');
    const lowerKey = key?.toLowerCase().trim();
    
    switch (lowerKey) {
      case 'domain':
        parsed.domain = val?.trim();
        break;
      case 'path':
        parsed.path = val?.trim();
        break;
      case 'expires':
        parsed.expires = val?.trim();
        break;
      case 'max-age':
        parsed.maxAge = val?.trim();
        break;
      case 'httponly':
        parsed.httpOnly = true;
        break;
      case 'secure':
        parsed.secure = true;
        break;
      case 'samesite':
        parsed.sameSite = val?.trim();
        break;
    }
  });
  
  return parsed;
};

// Helper function to detect if content is HTML
const isHtmlContent = (body: string, contentType?: string): boolean => {
  if (contentType?.includes('text/html') || contentType?.includes('application/xhtml')) {
    return true;
  }
  // Also check if body looks like HTML
  const trimmed = body.trim();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || 
         (trimmed.includes('<') && trimmed.includes('>') && trimmed.includes('</'));
};

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
  const [htmlViewMode, setHtmlViewMode] = useState<'raw' | 'rendered'>('raw');

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
    if (!body) return '';
    
    try {
      // Handle JSON content
      if (contentType?.includes('application/json') || contentType?.includes('text/json')) {
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
      }
      
      // Handle HTML content
      if (contentType?.includes('text/html') || contentType?.includes('application/xhtml')) {
        // Simple HTML formatting - add line breaks between tags
        let formatted = body
          .replace(/></g, '>\n<')
          .replace(/^\s+|\s+$/g, '');
        
        // Add basic indentation
        const lines = formatted.split('\n');
        let indentLevel = 0;
        const indentedLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          
          // Decrease indent for closing tags
          if (trimmed.startsWith('</')) {
            indentLevel = Math.max(0, indentLevel - 1);
          }
          
          const indentedLine = '  '.repeat(indentLevel) + trimmed;
          
          // Increase indent for opening tags (but not self-closing)
          if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
            indentLevel++;
          }
          
          return indentedLine;
        });
        
        return indentedLines.filter(line => line.length > 0).join('\n');
      }
      
      // Handle XML content
      if (contentType?.includes('application/xml') || contentType?.includes('text/xml')) {
        return body
          .replace(/></g, '>\n<')
          .replace(/^\s+|\s+$/g, '')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
      }
      
    } catch (error) {
      console.warn('Failed to format response body:', error);
      // If formatting fails, return original body
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
            <div className="h-full flex flex-col">
              {/* HTML View Mode Toggle (only show for HTML content) */}
              {isHtmlContent(response.body, response.contentType) && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-xs font-medium text-gray-700">View:</span>
                  <div className="flex bg-white border border-gray-300 rounded overflow-hidden">
                    <button
                      onClick={() => setHtmlViewMode('raw')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        htmlViewMode === 'raw'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Raw HTML
                    </button>
                    <button
                      onClick={() => setHtmlViewMode('rendered')}
                      className={`px-3 py-1 text-xs font-medium transition-colors border-l border-gray-300 ${
                        htmlViewMode === 'rendered'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Rendered
                    </button>
                  </div>
                  <div className="flex-1"></div>
                  <span className="text-xs text-gray-500">
                    {response.contentType || 'text/html'}
                  </span>
                </div>
              )}

              {/* Content Display */}
              <div className="flex-1 min-h-0">
                {isHtmlContent(response.body, response.contentType) && htmlViewMode === 'rendered' ? (
                  /* Rendered HTML View */
                  <div className="h-full border border-gray-300 rounded-md overflow-hidden shadow-sm bg-white">
                    <div className="h-full flex">
                      {/* Rendered Preview */}
                      <div className="flex-1 overflow-auto">
                        <iframe
                          srcDoc={response.body}
                          className="w-full h-full border-0"
                          sandbox="allow-same-origin"
                          title="HTML Preview"
                        />
                      </div>
                      {/* Raw HTML Side Panel */}
                      <div className="w-1/3 border-l border-gray-300 bg-gray-50">
                        <div className="h-full overflow-hidden">
                          <div className="p-2 bg-gray-100 border-b border-gray-300">
                            <span className="text-xs font-medium text-gray-700">Raw HTML</span>
                          </div>
                          <div className="h-full overflow-auto">
                            <CodeMirror
                              value={formatResponseBody(response.body, response.contentType)}
                              readOnly={true}
                              extensions={[javascript(), responseViewerTheme]}
                              basicSetup={{
                                lineNumbers: true,
                                foldGutter: false,
                                dropCursor: false,
                                allowMultipleSelections: false,
                                indentOnInput: false,
                                bracketMatching: true,
                                closeBrackets: false,
                                autocompletion: false,
                                highlightSelectionMatches: false,
                                searchKeymap: false
                              }}
                              className="h-full text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Raw/Code View */
                  <div className="h-full border border-gray-300 rounded-md overflow-hidden shadow-sm">
                    <CodeMirror
                      value={formatResponseBody(response.body, response.contentType)}
                      readOnly={true}
                      extensions={[javascript(), responseViewerTheme]}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        dropCursor: false,
                        allowMultipleSelections: false,
                        indentOnInput: false,
                        bracketMatching: true,
                        closeBrackets: false,
                        autocompletion: false,
                        highlightSelectionMatches: false,
                        searchKeymap: true
                      }}
                      className="h-full"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Headers Tab */}
          {activeTab === 'headers' && (
            <div className="h-full">
              <div className="h-full border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
                <div className="space-y-2">
                  {Object.entries(response.headers).map(([key, value], index) => (
                    <div key={`${key}-${index}`} className="flex gap-2 items-center">
                      <div className="flex-1 relative">
                        <input
                          value={key}
                          readOnly
                          className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                          placeholder="Header name"
                        />
                        <button
                          onClick={() => navigator.clipboard?.writeText(key)}
                          className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy header name"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex-1 relative">
                        <input
                          value={value}
                          readOnly
                          className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                          placeholder="Header value"
                        />
                        <button
                          onClick={() => navigator.clipboard?.writeText(value)}
                          className="absolute right-1 top-1 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy header value"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {Object.keys(response.headers).length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No headers in response
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cookies Tab */}
          {activeTab === 'cookies' && (
            <div className="h-full">
              <div className="h-full border border-gray-300 rounded-md bg-white overflow-hidden shadow-sm">
                {response.cookies && response.cookies.length > 0 ? (
                  <div className="h-full overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Value</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Domain</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Path</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Expires</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Flags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {response.cookies.map((cookieString, index) => {
                          const parsedCookie = parseCookieString(cookieString);
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-xs font-mono text-gray-900 max-w-xs truncate" title={parsedCookie.name}>
                                {parsedCookie.name}
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-gray-700 max-w-xs truncate" title={parsedCookie.value}>
                                {parsedCookie.value}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-700">
                                {parsedCookie.domain || '-'}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-700">
                                {parsedCookie.path || '/'}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-700">
                                {parsedCookie.expires || (parsedCookie.maxAge ? `Max-Age: ${parsedCookie.maxAge}` : 'Session')}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {parsedCookie.httpOnly && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">HttpOnly</span>
                                  )}
                                  {parsedCookie.secure && (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Secure</span>
                                  )}
                                  {parsedCookie.sameSite && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                      SameSite={parsedCookie.sameSite}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : response.headers['set-cookie'] ? (
                  <div className="p-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">Raw Cookie Header</h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p className="font-mono text-xs break-all">{response.headers['set-cookie']}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No Cookies</h3>
                      <p className="mt-1 text-sm text-gray-500">This response does not contain any cookies.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
