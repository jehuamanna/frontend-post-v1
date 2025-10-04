import React, { useState, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { HttpRequest } from '../types';

interface FetchCurlModalProps {
  isOpen: boolean;
  mode: 'fetch' | 'curl';
  initialValue?: string;
  onClose: () => void;
  onSave: (rawInput: string, parsedRequest?: Partial<HttpRequest>) => void;
}

export const FetchCurlModal: React.FC<FetchCurlModalProps> = ({
  isOpen,
  mode,
  initialValue = '',
  onClose,
  onSave,
}) => {
  const [value, setValue] = useState(initialValue);
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isOpen]);

  const getPlaceholder = () => {
    if (mode === 'fetch') {
      return `fetch('https://api.example.com/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com'
  })
})`;
    } else {
      return `curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com"
  }'`;
    }
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
        request.url = urlMatch[1];
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
          request.body = bodyMatch[1];
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
        request.url = urlMatch[1];
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
        headerMatches.forEach(match => {
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
        request.body = bodyMatch[1];
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
      return null;
    }

    try {
      let parsed: Partial<HttpRequest> | null = null;
      
      if (mode === 'fetch') {
        parsed = parseFetchCode(input);
      } else {
        parsed = parseCurlCommand(input);
      }

      if (parsed && parsed.url) {
        setIsValid(true);
        setError('');
        return parsed;
      } else {
        setIsValid(false);
        setError(`Invalid ${mode} format. Please check your syntax.`);
        return null;
      }
    } catch (err) {
      setIsValid(false);
      setError(`Failed to parse ${mode}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    }
  }, [mode]);

  const handleSave = useCallback(() => {
    const parsed = validateAndParse(value);
    onSave(value, parsed || undefined);
    onClose();
  }, [value, validateAndParse, onSave, onClose]);

  const handleChange = useCallback((val: string) => {
    setValue(val);
    // Debounced validation
    setTimeout(() => {
      validateAndParse(val);
    }, 300);
  }, [validateAndParse]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Add {mode === 'fetch' ? 'Fetch' : 'cURL'} Command
          </h2>
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
              {mode === 'fetch' ? 'Fetch Code' : 'cURL Command'}
            </label>
            
            <div className="flex-1 min-h-0 border border-gray-300 rounded-md overflow-hidden">
              <CodeMirror
                value={value}
                onChange={handleChange}
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
            {value.trim() && isValid && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-600">
                  ✓ Valid {mode} format detected
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
