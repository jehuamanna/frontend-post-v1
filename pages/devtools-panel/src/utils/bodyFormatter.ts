/**
 * Shared utility for formatting request/response body content
 * Supports JSON, HTML, and XML formatting with proper indentation
 */

export const formatBody = (body: string, contentType?: string): string => {
  if (!body) return '';

  try {
    // Handle JSON content
    if (contentType?.includes('application/json') || contentType?.includes('text/json') || isJsonContent(body)) {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    }

    // Handle HTML content
    if (contentType?.includes('text/html') || contentType?.includes('application/xhtml') || isHtmlContent(body)) {
      // Enhanced HTML formatting with proper indentation
      let formatted = body
        .replace(/></g, '>\n<')
        .replace(/^\s+|\s+$/g, '');

      // List of void elements that don't have closing tags
      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

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

        // Increase indent for opening tags (but not self-closing or void elements)
        if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.startsWith('<!')) {
          // Extract tag name
          const tagMatch = trimmed.match(/<(\w+)/);
          const tagName = tagMatch?.[1]?.toLowerCase();

          // Only increase indent if it's not a void element
          if (tagName && !voidElements.includes(tagName)) {
            indentLevel++;
          }
        }

        return indentedLine;
      });

      return indentedLines.filter(line => line.length > 0).join('\n');
    }

    // Handle XML content
    if (contentType?.includes('application/xml') || contentType?.includes('text/xml') || isXmlContent(body)) {
      return body
        .replace(/></g, '>\n<')
        .replace(/^\s+|\s+$/g, '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
    }

  } catch (error) {
    console.warn('Failed to format body content:', error);
    // If formatting fails, return original body
  }

  return body;
};

/**
 * Helper function to detect if content is JSON
 */
const isJsonContent = (body: string): boolean => {
  const trimmed = body.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
};

/**
 * Helper function to detect if content is HTML
 */
const isHtmlContent = (body: string): boolean => {
  const trimmed = body.trim();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') ||
    (trimmed.includes('<') && trimmed.includes('>') && trimmed.includes('</'));
};

/**
 * Helper function to detect if content is XML
 */
const isXmlContent = (body: string): boolean => {
  const trimmed = body.trim();
  return trimmed.startsWith('<?xml') || 
    (trimmed.includes('<') && trimmed.includes('>') && !isHtmlContent(body));
};

/**
 * Get content type from body content analysis
 */
export const detectContentType = (body: string): string => {
  if (isJsonContent(body)) return 'application/json';
  if (isHtmlContent(body)) return 'text/html';
  if (isXmlContent(body)) return 'application/xml';
  return 'text/plain';
};
