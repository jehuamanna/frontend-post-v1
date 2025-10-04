# Current bugs

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