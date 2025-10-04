
import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import './CodeEditor.css';

interface CodeEditorProps {
    value?: string;
    onChange?: (val: string, viewUpdate?: any) => void;
    language?: string;
    onCtrlEnter?: () => void;
    height?: string;
    className?: string;
    readOnly?: boolean;
    formatJson?: boolean;
    wordWrap?: boolean;
}

function CodeEditor({
    value: propValue,
    onChange: propOnChange,
    language = 'javascript',
    onCtrlEnter,
    height = "200px",
    className = "",
    readOnly = false,
    formatJson = false,
    wordWrap = false
}: CodeEditorProps) {
    const [internalValue, setInternalValue] = React.useState("console.log('hello world!');");
    const [containerHeight, setContainerHeight] = React.useState<number>(400);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const value = propValue !== undefined ? propValue : internalValue;

    React.useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerHeight(rect.height - 2); // Subtract border
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    const onChange = React.useCallback((val: string, viewUpdate?: any) => {
        if (propOnChange) {
            propOnChange(val, viewUpdate);
        } else {
            console.log('val:', val);
            setInternalValue(val);
        }
    }, [propOnChange]);

    const formatJsonValue = React.useCallback((jsonString: string) => {
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed, null, 2);
        } catch (error) {
            console.error('Invalid JSON:', error);
            return jsonString;
        }
    }, []);

    const handleFormatJson = React.useCallback(() => {
        if (formatJson && value) {
            console.log(value)
            const formatted = formatJsonValue(value);
            console.log(formatted)
            onChange(formatted);
        }
    }, [formatJson, value, formatJsonValue, onChange]);

    const extensions = React.useMemo(() => {
        const exts = [];
        if (language === 'javascript' || language === 'json') {
            exts.push(javascript({ jsx: true }));
        }
        return exts;
    }, [language]);

    return (
        <div className={`h-full flex flex-col ${className}`} style={{ height: height === "100%" ? "100%" : height }}>
            {formatJson && (
                <div className="mb-2 flex justify-end">
                    <button
                        onClick={handleFormatJson}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Format JSON
                    </button>
                </div>
            )}
            <div className="flex-1" style={{ height: '100%' }} ref={containerRef}>
                <div
                    className={`codemirror-container ${wordWrap ? 'word-wrap' : ''}`}
                    style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '4px',
                        position: 'relative'
                    }}
                >
                    <CodeMirror
                        value={value}
                        extensions={extensions}
                        onChange={onChange}
                        editable={!readOnly}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            dropCursor: false,
                            allowMultipleSelections: false,
                            searchKeymap: true,
                            tabSize: 2,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
export default CodeEditor;