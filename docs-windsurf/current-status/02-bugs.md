# Current bugs

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