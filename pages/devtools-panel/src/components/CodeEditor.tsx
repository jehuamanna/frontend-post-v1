
import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';

interface CodeEditorProps {
    value?: string;
    onChange?: (val: string, viewUpdate?: any) => void;
    language?: string;
    onCtrlEnter?: () => void;
    height?: string;
    className?: string;
    readOnly?: boolean;
}

function CodeEditor({
    value: propValue,
    onChange: propOnChange,
    language = 'javascript',
    onCtrlEnter,
    height = "200px",
    className = "",
    readOnly = false
}: CodeEditorProps) {
    const [internalValue, setInternalValue] = React.useState("console.log('hello world!');");

    const value = propValue !== undefined ? propValue : internalValue;

    const onChange = React.useCallback((val: string, viewUpdate?: any) => {
        if (propOnChange) {
            propOnChange(val, viewUpdate);
        } else {
            console.log('val:', val);
            setInternalValue(val);
        }
    }, [propOnChange]);

    const extensions = React.useMemo(() => {
        const exts = [];
        if (language === 'javascript') {
            exts.push(javascript({ jsx: true }));
        }
        return exts;
    }, [language]);

    return (
        <div className={`h-full flex flex-col ${className}`} style={{ height: height === "100%" ? "100%" : height }}>
            <CodeMirror
                value={value}
                height="100%"
                extensions={extensions}
                onChange={onChange}
                editable={!readOnly}
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                }}
                style={{ height: "100%", flex: 1 }}
            />
        </div>
    );
}
export default CodeEditor;