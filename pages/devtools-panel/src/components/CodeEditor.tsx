import React, { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import * as MonacoAPI from 'monaco-editor/esm/vs/editor/editor.api';
// Register editor contributions for word navigation commands
// These side-effect imports ensure commands like 'cursorWordLeft/Right' are available
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations';
import 'monaco-editor/esm/vs/editor/contrib/wordPartOperations/browser/wordPartOperations';
// Register language tokenizers/contributions to enable syntax colors
// Import worker asset URLs (no blob:) and construct Workers manually to satisfy CSP
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

// Ensure Monaco workers are loaded from the app bundle (CSP-safe for extensions)
// Do this once at module load
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
self.MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
        if (label === 'json') return new Worker(jsonWorkerUrl as string, { type: 'module' });
        if (label === 'css' || label === 'scss' || label === 'less') return new Worker(cssWorkerUrl as string, { type: 'module' });
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new Worker(htmlWorkerUrl as string, { type: 'module' });
        if (label === 'typescript' || label === 'javascript') return new Worker(tsWorkerUrl as string, { type: 'module' });
        return new Worker(editorWorkerUrl as string, { type: 'module' });
    },
};

// Provide ESM monaco instance globally so the React wrapper can use it directly (no AMD loader)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (!(self as any).monaco) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (self as any).monaco = MonacoAPI;
}


interface CodeEditorProps {
    value: string;
    onChange: (val: string) => void;
    language?: string;
    height?: string | number;
    className?: string;
    onCtrlEnter?: () => void;
    readOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, language = 'plaintext', height = '100%', className = '', onCtrlEnter, readOnly = false }) => {
    const memoHeight = useMemo(() => (typeof height === 'number' ? `${height}px` : height), [height]);
    // Normalize language ids to Monaco's registered languages
    const normalizedLanguage = useMemo(() => {
        if (language === 'bash') return 'shell';
        return language;
    }, [language]);



    return (
        <Editor

            height={memoHeight}
            language={normalizedLanguage}
            value={value}
            onChange={(val: string | undefined) => onChange(val ?? '')}
            theme="vs-light"
            options={{
                wordWrap: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                'semanticHighlighting.enabled': true,
                lineNumbers: 'on',
                readOnly,
            }}
            className={className}
        />
    );
};

export default CodeEditor;
