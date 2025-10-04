# Current bugs

## ✅ FIXED: Clear Button and New Tab Issues (2025-10-04 at 15:45)

### **Bug 1: Clear button does not clear the fields**
**Root Cause**: 
- Clear function only reset headers/body but kept URL and method
- RequestForm local state (headers, queryParams) wasn't syncing when request data was cleared

**Solution Applied**:
1. **Enhanced Clear Function** (`src/Panel.tsx`):
   - Now clears ALL fields: URL, method, headers, body, params
   - Resets method to 'GET' and tab name to 'New Request GET'
   - Clears raw command and command type

2. **Fixed RequestForm State Sync** (`src/components/RequestForm.tsx`):
   - Added proper reset logic in useEffect hooks
   - Headers reset to default when cleared: `[['Content-Type', 'application/json'], ['Authorization', '']]`
   - Query params reset to default when cleared: `[['', '']]`

### **Bug 2: New tab button does not open a fresh tab**
**Root Cause**: 
- Tab creation was working correctly
- Issue was with RequestForm not properly displaying fresh state due to state sync problems

**Solution Applied**:
- Fixed RequestForm state synchronization (same fix as Bug 1)
- New tabs now properly display with empty fields
- Tab switching correctly updates UI state

### **Technical Details**:
```typescript
// Enhanced clear function
const handleClear = useCallback(() => {
  if (activeTabId) {
    updateRequest(activeTabId, {
      url: '',
      method: 'GET', 
      headers: {},
      body: '',
      params: {}
    });
    
    updateTab(activeTabId, {
      name: 'New Request GET',
      data: {
        ...activeTab!.data,
        rawCommand: '',
        commandType: undefined
      }
    });
  }
}, [activeTabId, activeTab, updateTab, updateRequest]);

// Fixed state sync in RequestForm
React.useEffect(() => {
  const headerEntries = Object.entries(request.headers);
  if (headerEntries.length > 0) {
    setHeaders(headerEntries);
  } else {
    setHeaders([['Content-Type', 'application/json'], ['Authorization', '']]);
  }
}, [request.headers]);
```

**Result**: Both Clear button and New Tab button now work correctly with proper field reset.



## ✅ FIXED: Layout and Footer Positioning Bug

**Issue**: Footer was overlapping the request/response content area. The request and response content was spilling over the bottom of the page without proper scrollable areas.

**Root Cause**: 
- Content areas lacked proper `overflow-auto` styling
- Layout structure didn't properly constrain content height
- Headers section in RequestForm needed scrollable container

**Solution Applied** (2025-10-04 at 14:33):

### **Code Changes Made**:

1. **Fixed Panel Layout** (`src/Panel.tsx`):
   - Added `overflow-auto` to request/response content containers
   - Wrapped content in proper scrollable divs with `h-full`
   - Maintained `flex-1 min-h-0` for proper flex behavior

2. **Enhanced RequestForm Scrolling** (`src/components/RequestForm.tsx`):
   - Added `overflow-hidden` to headers container
   - Implemented `overflow-auto` for headers content area
   - Ensured proper height constraints for scrollable sections

### **Technical Details**:
- Footer now stays fixed at bottom of viewport
- Request/Response content areas are properly constrained between top controls and footer
- Both Headers and Body sections have independent vertical scrolling
- Layout maintains responsiveness across different screen sizes

**Status**: ✅ **RESOLVED** - Footer stays at bottom, content areas have proper vertical scrolling.


## ✅ FIXED: Modal State Leakage Bug

**Issue**: When opening the cURL editor and inserting cURL text, then closing and opening the fetch editor, the same cURL text was visible in the fetch modal.

**Root Cause**: Both fetch and cURL modals were sharing the same `rawInput` field in the tab data structure, causing data leakage between modal types.

**Solution Applied** (2025-10-04 at 14:25):

### **Code Changes Made**:

1. **Updated TypeScript Interface** (`src/types/index.ts`):
   - Replaced single `rawInput?: string` field with separate fields:
   - `fetchInput?: string` - Store original fetch code
   - `curlInput?: string` - Store original cURL command

2. **Fixed Tab Creation** (`src/utils/tabUtils.ts`):
   - Updated `createNewTab()` to initialize both `fetchInput` and `curlInput` as undefined

3. **Fixed Modal State Management** (`src/Panel.tsx`):
   - `handleAddFetch()` now uses `activeTab?.data.fetchInput`
   - `handleAddCurl()` now uses `activeTab?.data.curlInput`
   - `handleModalSave()` dynamically updates the correct field based on modal mode

### **Technical Details**:
- Each tab now maintains separate storage for fetch and cURL inputs
- Modal type determines which field gets updated during save operations
- Complete isolation between fetch and cURL data per tab
- Backward compatibility maintained for existing functionality

**Status**: ✅ **RESOLVED** - Fetch and cURL modals now have proper data isolation per tab.