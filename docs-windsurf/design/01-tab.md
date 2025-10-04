# Tabs.

Tabs should hold this data structure:
``` typescript
interface HttpRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers: Record<string, string>;
  body?: string;
  params?: Record<string, string>; // Query parameters
}

interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  duration: number; // in milliseconds
  size: number; // Response size in bytes
  contentType?: string; // Extracted from headers for convenience
}

interface Tab {
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
```


# This we need from a tab

## Design Requirements

### Visual Design
- **Tab Header**: Show tab name with truncation for long names
- **Status Indicators**: Visual icons for request status (loading, success, error)
- **Active State**: Clear visual distinction for the currently active tab
- **Close Button**: X button to close individual tabs
- **Tab Reordering**: Drag and drop to reorder tabs
- **Overflow Handling**: Scroll or dropdown when too many tabs

### Color Coding

#### Request Status
- **Loading**: Blue/gray indicator while request is executing
- **Success**: Green indicator for successful responses (2xx status)
- **Error**: Red indicator for failed requests (4xx, 5xx, network errors)
- **Neutral**: Default gray for new/unsent requests

#### HTTP Method Colors (appended to tab names)
- **GET**: Green badge/pill (e.g., "User API GET")
- **POST**: Orange badge/pill (e.g., "Create User POST")
- **PUT**: Blue badge/pill (e.g., "Update User PUT")
- **PATCH**: Yellow badge/pill (e.g., "Partial Update PATCH")
- **DELETE**: Red badge/pill (e.g., "Delete User DELETE")
- **HEAD**: Purple badge/pill (e.g., "Check Headers HEAD")
- **OPTIONS**: Gray badge/pill (e.g., "CORS Check OPTIONS")

## UI Components

### Tab Bar
- Horizontal scrollable tab container
- Add new tab button (+)
- Tab context menu (right-click options)
- Keyboard navigation (Ctrl+Tab, Ctrl+W to close)

### Individual Tab
- Tab name (editable on double-click) + HTTP method badge
- Status icon (loading spinner, success checkmark, error X)
- Close button (visible on hover)
- Tooltip showing full request URL on hover

#### Tab Name Format Examples:
- "User Profile **GET**" (green badge)
- "Login **POST**" (orange badge)  
- "Update Settings **PUT**" (blue badge)
- "Remove Item **DELETE**" (red badge)

## Functionality Requirements

### Core Actions
- **Create Tab**: Add new empty tab with default GET request
- **Switch Tab**: Click to activate different tab
- **Close Tab**: Remove tab and clean up resources
- **Rename Tab**: Double-click to edit tab name
- **Duplicate Tab**: Copy existing tab with same request config

### Tab Management Rules
- **No Tab Limit**: Users can create unlimited tabs
- **Always One Tab**: When closing the last tab, automatically create a new empty tab
- **Single Tab Protection**: Cannot close the only remaining tab if it's unsaved/new
- **Hydration**: DevTools reopens with all previously saved tabs restored

### Request Management
- **Execute Request**: Send HTTP request and display response
- **Cancel Request**: Abort ongoing request using AbortController
- **Auto-save**: Persist all changes to Chrome storage automatically
- **Load State**: Restore tabs when DevTools reopens

### User Experience
- **Keyboard Shortcuts**: 
  - Ctrl+T: New tab
  - Ctrl+W: Close current tab
  - Ctrl+Tab: Switch between tabs
  - Ctrl+Enter: Execute request
- **Context Menu**: Right-click options with bulk actions:
  - Duplicate tab
  - Close tab
  - Close other tabs
  - Close all tabs
  - Close tabs to the right
- **Undo/Redo**: For accidental tab closures
- **Tab Persistence**: Remember tabs across browser sessions

### Error Handling
- **Network Errors**: Display clear error messages
- **Invalid URLs**: Validate and show warnings
- **CORS Issues**: Explain CORS problems to users
- **Timeout Handling**: Show timeout errors with retry options

### Performance
- **Lazy Loading**: Only render active tab content
- **Memory Management**: Clean up AbortControllers and event listeners
- **Debounced Saving**: Avoid excessive storage writes
- **Response Caching**: Cache responses for quick tab switching

## Integration Features

### Import/Export
- **Import cURL**: Parse and create tab from cURL command
- **Import Postman**: Support Postman collection import
- **Export**: Save tabs as collection or individual requests

### Developer Tools Integration
- **Network Panel Sync**: Import requests from Chrome Network tab
- **Console Integration**: Log request/response details to console
- **DevTools Theme**: Match Chrome DevTools styling

### Advanced Features
- **Request History**: Track previous executions per tab
- **Environment Variables**: Support for dynamic values
- **Request Chaining**: Use response data in subsequent requests
- **Bulk Operations**: Execute multiple tabs simultaneously