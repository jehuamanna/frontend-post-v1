import React, { useState, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { HttpRequest } from '../types';

interface FetchCurlModalProps {
  isOpen: boolean;
  initialValue?: string;
  onClose: () => void;
  onSave: (rawCommand: string, parsedRequest?: Partial<HttpRequest>, commandType?: 'fetch' | 'curl') => void;
}

export const FetchCurlModal: React.FC<FetchCurlModalProps> = ({
  isOpen,
  initialValue = '',
  onClose,
  onSave,
}) => {
  const [value, setValue] = useState(initialValue);
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string>('');
  const [detectedType, setDetectedType] = useState<'fetch' | 'curl' | null>(null);

  useEffect(() => {
    setValue(initialValue);
    if (initialValue) {
      const type = detectCommandType(initialValue);
      setDetectedType(type);
    }
  }, [initialValue, isOpen]);

  const detectCommandType = (input: string): 'fetch' | 'curl' | null => {
    const trimmed = input.trim();
    if (trimmed.startsWith('curl')) {
      return 'curl';
    } else if (trimmed.includes('fetch(')) {
      return 'fetch';
    }
    return null;
  };

  const getPlaceholder = () => {
    return `// Enter fetch command or cURL command

// Fetch example:
fetch('https://api.example.com/users?page=1&limit=10', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com'
  })
})

// cURL example:
curl -X POST "https://api.example.com/users?page=1&limit=10" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com"
  }'`;
  };

  const parseFetchCode = (fetchCode: string): Partial<HttpRequest> | null => {
    try {
      // Simple regex-based parsing for fetch calls
      const urlMatch = fetchCode.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/);
      const methodMatch = fetchCode.match(/method\s*:\s*['"`](\w+)['"`]/i);
      const bodyMatch = fetchCode.match(/body\s*:\s*JSON\.stringify\s*\(\s*({[\s\S]*?})\s*\)/);
      const headersMatch = fetchCode.match(/headers\s*:\s*({[\s\S]*?})/);

      const request: Partial<HttpRequest> = {};

      if (urlMatch) {
        const fullUrl = urlMatch[1];
        // Extract query parameters from URL
        const [baseUrl, queryString] = fullUrl.split('?');
        request.url = baseUrl;
        
        if (queryString) {
          const params: Record<string, string> = {};
          const paramPairs = queryString.split('&');
          paramPairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
              params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
          });
          request.params = params;
        }
      }

      if (methodMatch) {
        request.method = methodMatch[1].toUpperCase() as any;
      } else {
        request.method = 'GET';
      }

      if (headersMatch) {
        try {
          // Simple header parsing
          const headerStr = headersMatch[1];
          const headers: Record<string, string> = {};
          const headerMatches = headerStr.match(/['"`]([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g);
          if (headerMatches) {
            headerMatches.forEach(match => {
              const [, key, value] = match.match(/['"`]([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/) || [];
              if (key && value) {
                headers[key] = value;
              }
            });
          }
          request.headers = headers;
        } catch {
          request.headers = {};
        }
      }

      if (bodyMatch) {
        try {
          let bodyContent = bodyMatch[1];
          // Try to format JSON body
          try {
            const parsed = JSON.parse(bodyContent);
            request.body = JSON.stringify(parsed, null, 2);
          } catch {
            // If not valid JSON, keep as-is
            request.body = bodyContent;
          }
        } catch {
          // If JSON parsing fails, keep as string
        }
      }

      return request;
    } catch (err) {
      console.error('Failed to parse fetch code:', err);
      return null;
    }
  };

  const parseCurlCommand = (curlCommand: string): Partial<HttpRequest> | null => {
    try {
      const request: Partial<HttpRequest> = {
        method: 'GET',
        headers: {},
        body: '',
      };

      // Extract URL
      const urlMatch = curlCommand.match(/curl\s+(?:-[^\s]+\s+)*['"`]?([^'"`\s]+)['"`]?/);
      if (urlMatch) {
        const fullUrl = urlMatch[1];
        // Extract query parameters from URL
        const [baseUrl, queryString] = fullUrl.split('?');
        request.url = baseUrl;
        
        if (queryString) {
          const params: Record<string, string> = {};
          const paramPairs = queryString.split('&');
          paramPairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
              params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
          });
          request.params = params;
        }
      }

      // Extract method
      const methodMatch = curlCommand.match(/-X\s+(\w+)/i);
      if (methodMatch) {
        request.method = methodMatch[1].toUpperCase() as any;
      }

      // Extract headers
      const headers: Record<string, string> = {};
      const headerMatches = curlCommand.match(/-H\s+['"`]([^'"`]+)['"`]/g);
      if (headerMatches) {
        headerMatches.forEach((match: string) => {
          const headerMatch = match.match(/-H\s+['"`]([^'"`]+)['"`]/);
          if (headerMatch) {
            const [key, ...valueParts] = headerMatch[1].split(':');
            if (key && valueParts.length > 0) {
              headers[key.trim()] = valueParts.join(':').trim();
            }
          }
        });
      }
      request.headers = headers;

      // Extract body
      const bodyMatch = curlCommand.match(/-d\s+['"`]([^'"`]+)['"`]/s);
      if (bodyMatch) {
        let bodyContent = bodyMatch[1];
        // Try to format JSON body
        try {
          const parsed = JSON.parse(bodyContent);
          request.body = JSON.stringify(parsed, null, 2);
        } catch {
          // If not valid JSON, keep as-is
          request.body = bodyContent;
        }
      }

      return request;
    } catch (err) {
      console.error('Failed to parse cURL command:', err);
      return null;
    }
  };

  const validateAndParse = useCallback((input: string) => {
    if (!input.trim()) {
      setIsValid(true);
      setError('');
      setDetectedType(null);
      return { parsed: null, type: null };
    }

    const commandType = detectCommandType(input);
    setDetectedType(commandType);

    if (!commandType) {
      setIsValid(false);
      setError('Unable to detect command type. Please enter a valid fetch or cURL command.');
      return { parsed: null, type: null };
    }

    try {
      let parsed: Partial<HttpRequest> | null = null;
      
      if (commandType === 'fetch') {
        parsed = parseFetchCode(input);
      } else {
        parsed = parseCurlCommand(input);
      }

      if (parsed && parsed.url) {
        setIsValid(true);
        setError('');
        return { parsed, type: commandType };
      } else {
        setIsValid(false);
        setError(`Invalid ${commandType} format. Please check your syntax.`);
        return { parsed: null, type: commandType };
      }
    } catch (err) {
      setIsValid(false);
      setError(`Failed to parse ${commandType}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return { parsed: null, type: commandType };
    }
  }, []);

  const handleAutoSave = useCallback(() => {
    const result = validateAndParse(value);
    onSave(value, result.parsed || undefined, result.type || undefined);
  }, [value, validateAndParse, onSave]);

  const handleBlur = useCallback(() => {
    handleAutoSave();
  }, [handleAutoSave]);

  const handleChange = useCallback((val: string) => {
    setValue(val);
    // Debounced validation and auto-save
    setTimeout(() => {
      const result = validateAndParse(val);
      if (result.parsed) {
        onSave(val, result.parsed, result.type || undefined);
      }
    }, 500);
  }, [validateAndParse, onSave]);

  // Handle click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleAutoSave();
      onClose();
    }
  }, [handleAutoSave, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Request Command Editor
            </h2>
            {detectedType && (
              <p className="text-sm text-gray-500 mt-1">
                Detected: {detectedType.toUpperCase()} command
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-6">
          <div className="h-full flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Enter fetch or cURL command
            </label>
            
            <div className="flex-1 min-h-0 border border-gray-300 rounded-md overflow-hidden">
              <CodeMirror
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={getPlaceholder()}
                extensions={[javascript()]}
                theme="light"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  dropCursor: false,
                  allowMultipleSelections: false,
                }}
                className="h-full"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Validation status */}
            {value.trim() && isValid && detectedType && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">
                  ✓ Valid {detectedType} command detected
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Auto-saves on blur • Click outside to close
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
