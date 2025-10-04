# CodeMirror Theme Implementation Guide

**Project**: Chrome DevTools HTTP Request Extension  
**Date**: 2025-10-04  
**Status**: ✅ Implemented and Working

## Overview

This document outlines the implementation of custom CodeMirror theming to match our application's design system. The solution follows CodeMirror's official documentation and uses the proper `EditorView.theme()` API instead of CSS overrides.

## Problem Statement

The default CodeMirror editor had a light blue background that didn't match our clean white design system. Initial attempts using CSS `!important` rules were ineffective due to CodeMirror's CSS-in-JS system with generated class names.

## Solution Architecture

### 1. Dependencies Added

```json
{
  "dependencies": {
    "@codemirror/view": "^6.x.x"  // Added for EditorView.theme()
  }
}
```

### 2. Theme Implementation

**File**: `pages/devtools-panel/src/components/FetchCurlModal.tsx`

```typescript
import { EditorView } from '@codemirror/view';

// Create custom CodeMirror theme using EditorView.theme()
const customTheme = EditorView.theme({
  "&": {
    backgroundColor: "white",
    color: "#1f2937", // gray-800 (darker for better contrast)
    fontSize: "12px",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
  },
  ".cm-content": {
    backgroundColor: "white",
    caretColor: "#1f2937"
  },
  ".cm-focused": {
    backgroundColor: "white"
  },
  ".cm-editor.cm-focused": {
    backgroundColor: "white",
    outline: "none"
  },
  ".cm-scroller": {
    backgroundColor: "white"
  },
  ".cm-gutters": {
    backgroundColor: "white", // Changed from gray-50 to white
    color: "#9ca3af", // gray-400 (lighter than before)
    border: "none",
    borderRight: "1px solid #f3f4f6" // gray-100 (very light border)
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: "#9ca3af", // gray-400 (lighter line numbers)
    fontSize: "12px"
  },
  ".cm-activeLine": {
    backgroundColor: "transparent"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent"
  }
});
```

### 3. Theme Application

```typescript
<CodeMirror
  value={value}
  onChange={handleChange}
  onBlur={handleBlur}
  placeholder={getPlaceholder()}
  extensions={[javascript(), customTheme]} // Theme added as extension
  basicSetup={{
    lineNumbers: true,
    foldGutter: true,
    dropCursor: false,
    allowMultipleSelections: false,
  }}
  className="h-full"
/>
```

## Design System Integration

### Color Palette Used

| Element | Color | Tailwind Class | Hex Value |
|---------|-------|----------------|-----------|
| Background | White | `bg-white` | `#ffffff` |
| Text | Gray 800 | `text-gray-800` | `#1f2937` |
| Gutters | White | `bg-white` | `#ffffff` |
| Line Numbers | Gray 400 | `text-gray-400` | `#9ca3af` |
| Gutter Border | Gray 100 | `border-gray-100` | `#f3f4f6` |

### Typography

- **Font Family**: System monospace stack matching Tailwind's `font-mono`
- **Font Size**: `12px` (equivalent to Tailwind's `text-xs`)
- **Line Height**: Default CodeMirror line height for optimal readability

## Key Features Achieved

### ✅ Visual Consistency
- **Clean White Background**: No more blue background
- **Subtle Gutters**: Light gray gutters with proper borders
- **Professional Appearance**: Matches Chrome DevTools aesthetic

### ✅ Technical Benefits
- **Proper Specificity**: Uses CodeMirror's CSS-in-JS system correctly
- **No CSS Conflicts**: Generated class names prevent style collisions
- **Performance**: No CSS `!important` overrides needed
- **Maintainable**: Theme defined in JavaScript, easy to modify

### ✅ User Experience
- **Seamless Integration**: Editor looks like part of the application
- **Consistent Typography**: Same fonts and sizes as rest of interface
- **Focus States**: Proper focus handling without distracting outlines

## Implementation Steps

1. **Install Dependencies**:
   ```bash
   pnpm add @codemirror/view --filter @extension/devtools-panel
   ```

2. **Import Required Modules**:
   ```typescript
   import { EditorView } from '@codemirror/view';
   ```

3. **Create Theme**:
   - Define theme using `EditorView.theme()`
   - Use design system colors
   - Target specific CodeMirror CSS classes

4. **Apply Theme**:
   - Add theme to `extensions` array
   - Remove any CSS override attempts
   - Test across different states (focused, unfocused, etc.)

## Best Practices Followed

### 1. Official API Usage
- Used `EditorView.theme()` instead of CSS overrides
- Followed CodeMirror documentation exactly
- Leveraged CSS-in-JS system properly

### 2. Design System Adherence
- Used exact Tailwind color values
- Matched typography specifications
- Maintained consistent spacing

### 3. Performance Optimization
- No CSS `!important` rules
- No style tag injections
- Leveraged CodeMirror's built-in optimization

## Future Enhancements

### Potential Improvements
1. **Dark Theme Support**: Add dark theme variant
2. **Syntax Highlighting**: Custom highlight styles for different languages
3. **Error States**: Theme variations for validation errors
4. **Accessibility**: Enhanced contrast ratios for better accessibility

### Reusability
This theme can be extracted into a shared utility for use in other CodeMirror instances:

```typescript
// utils/codeMirrorTheme.ts
export const createCustomTheme = (options = {}) => {
  return EditorView.theme({
    // Theme definition with customizable options
  });
};
```

## Testing Checklist

- [x] White background in all states
- [x] Proper gutter styling
- [x] Consistent typography
- [x] Focus states work correctly
- [x] Line numbers visible and styled
- [x] No CSS conflicts with other components
- [x] Responsive behavior maintained

## Related Files

- `pages/devtools-panel/src/components/FetchCurlModal.tsx` - Main implementation
- `pages/devtools-panel/package.json` - Dependencies
- `docs-windsurf/ui/01-code-mirror-styling.md` - CodeMirror documentation reference

## References

- [CodeMirror Theming Documentation](https://codemirror.net/docs/ref/#view.EditorView^theme)
- [CodeMirror Styling Guide](https://codemirror.net/examples/styling/)
- [CSS-in-JS Style Module](https://github.com/marijnh/style-mod#documentation)

---

**Status**: ✅ Complete and Production Ready  
**Next Steps**: Ready for body editor CodeMirror upgrade using same theme
