// src/components/CodeEditor.jsx
import React from 'react';
import Editor from '@monaco-editor/react';

const CodeEditor = ({ code, setCode, language }) => {
    // Mapping our simple language name to Monaco's identifiers
    const languageMap = {
        93: 'javascript',
        71: 'python',
        52: 'cpp'
    };
    
    const editorLanguage = languageMap[language] || 'javascript';

    return (
        <div className="h-full w-full bg-gray-800 rounded-lg overflow-hidden">
            <Editor
                height="100%"
                language={editorLanguage}
                value={code}
                onChange={(value) => setCode(value || "")}
                theme="vs-dark"
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                }}
            />
        </div>
    );
};

export default CodeEditor;