import React from 'react';
import { HttpResponse } from '../types';

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
    <div className="h-full flex flex-col space-y-6">
      {/* Response status */}
      <div className="flex items-center gap-6">
        <span className={`px-3 py-2 border rounded-md text-sm font-semibold shadow-sm ${getStatusColor(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="text-sm text-gray-700 font-medium">
          Response time: {response.duration}ms
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

      {/* Response sections */}
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-6">
        {/* Body */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Body</h3>
          <div className="flex-1 min-h-0 border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
            <pre className="text-sm font-mono text-gray-800 leading-relaxed whitespace-pre-wrap">
              {formatResponseBody(response.body, response.contentType)}
            </pre>
          </div>
        </div>

        {/* Headers */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Headers</h3>
          <div className="flex-1 min-h-0 border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
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

        {/* Cookies */}
        <div className="flex flex-col min-h-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cookies</h3>
          <div className="flex-1 min-h-0 border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
            <div className="space-y-2 text-sm">
              {response.headers['set-cookie'] ? (
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
      </div>
    </div>
  );
};
