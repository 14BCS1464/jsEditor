// languageConfig.js

/**
 * Base Monaco Editor Configuration
 * These settings apply to all languages unless overridden
 */
// export const BASE_EDITOR_CONFIG = {
//   // Theme and Appearance
//   theme: "vs-dark",
//   automaticLayout: true,
  
//   // Font Settings
//   fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
//   fontSize: 14,
//   fontWeight: "400",
//   lineHeight: 22,
//   letterSpacing: 0.5,
//   fontLigatures: true, // Enable ligatures for supported fonts
  
//   // Line Numbers and Gutter
//   lineNumbers: "on",
//   lineNumbersMinChars: 3,
//   glyphMargin: true,
//   folding: true,
//   foldingStrategy: "indentation",
//   showFoldingControls: "mouseover",
  
//   // Minimap
//   minimap: {
//       enabled: true,
//       side: "right",
//       showSlider: "mouseover",
//       renderCharacters: true,
//       maxColumn: 120,
//       scale: 1
//   },
  
//   // Scrolling
//   scrollBeyondLastLine: true,
//   scrollBeyondLastColumn: 5,
//   smoothScrolling: true,
//   mouseWheelZoom: true,
//   fastScrollSensitivity: 5,
//   scrollbar: {
//       vertical: "visible",
//       horizontal: "visible",
//       verticalScrollbarSize: 12,
//       horizontalScrollbarSize: 12,
//       arrowSize: 11,
//       useShadows: true,
//       verticalHasArrows: false,
//       horizontalHasArrows: false
//   },
  
//   // Selection and Cursor
//   roundedSelection: true,
//   cursorStyle: "line",
//   cursorBlinking: "smooth",
//   cursorSmoothCaretAnimation: true,
//   cursorWidth: 2,
//   multiCursorModifier: "alt",
//   selectionHighlight: true,
//   occurrencesHighlight: true,
  
//   // Editing Behavior
//   tabSize: 2,
//   insertSpaces: true,
//   detectIndentation: true,
//   autoIndent: "advanced",
//   formatOnPaste: true,
//   formatOnType: true,
//   autoClosingBrackets: "languageDefined",
//   autoClosingQuotes: "languageDefined",
//   autoSurround: "languageDefined",
//   bracketPairColorization: {
//       enabled: true
//   },
  
//   // Word Operations
//   wordWrap: "off",
//   wordWrapColumn: 120,
//   wrappingIndent: "indent",
//   wordBasedSuggestions: true,
  
//   // Suggestions and IntelliSense
//   quickSuggestions: {
//       other: true,
//       comments: false,
//       strings: false
//   },
//   quickSuggestionsDelay: 10,
//   suggestOnTriggerCharacters: true,
//   acceptSuggestionOnCommitCharacter: true,
//   acceptSuggestionOnEnter: "on",
//   snippetSuggestions: "inline",
//   tabCompletion: "on",
//   suggest: {
//       insertMode: "replace",
//       filterGraceful: true,
//       localityBonus: true,
//       shareSuggestSelections: true,
//       showIcons: true,
//       showStatusBar: true,
//       preview: true,
//       previewMode: "subwordSmart"
//   },
  
//   // Hover and Parameters
//   hover: {
//       enabled: true,
//       delay: 300,
//       sticky: true
//   },
//   parameterHints: {
//       enabled: true,
//       cycle: true
//   },
  
//   // Code Actions and Lightbulb
//   lightbulb: {
//       enabled: true
//   },
//   codeActionsOnSave: {
//       "source.fixAll": true
//   },
  
//   // Find and Replace
//   find: {
//       seedSearchStringFromSelection: true,
//       autoFindInSelection: "never",
//       addExtraSpaceOnTop: true,
//       loop: true
//   },
  
//   // Rendering
//   renderLineHighlight: "all",
//   renderWhitespace: "selection",
//   renderControlCharacters: true,
//   renderIndentGuides: true,
//   highlightActiveIndentGuide: true,
//   renderFinalNewline: true,
  
//   // Performance
//   stablePeek: true,
//   maxTokenizationLineLength: 20000,
  
//   // Accessibility
//   accessibilitySupport: "auto",
  
//   // Other
//   dragAndDrop: true,
//   links: true,
//   colorDecorators: true,
//   contextmenu: true,
//   mouseWheelScrollSensitivity: 1,
//   readOnly: false,
//   rulers: [80, 120],
//   guides: {
//       bracketPairs: true,
//       indentation: true,
//       highlightActiveBracketPair: true
//   }
// };

/**
* Language-Specific Configurations
* These settings override BASE_EDITOR_CONFIG for specific languages
*/
export const EDITOR_CONFIGS = {
  javascript: {
      language: "javascript",
      tabSize: 2,
      formatOnType: true,
      autoIndent: "full",
      
      quickSuggestions: {
          other: true,
          comments: false,
          strings: true
      },
      // suggest: {
      //     showMethods: true,
      //     showFunctions: true,
      //     showConstructors: true,
      //     showFields: true,
      //     showVariables: true,
      //     showClasses: true,
      //     showStructs: true,
      //     showInterfaces: true,
      //     showModules: true,
      //     showProperties: true,
      //     showEvents: true,
      //     showOperators: true,
      //     showUnits: true,
      //     showValues: true,
      //     showConstants: true,
      //     showEnums: true,
      //     showEnumMembers: true,
      //     showKeywords: true,
      //     showWords: true,
      //     showColors: false,
      //     showFiles: false,
      //     showReferences: true,
      //     showFolders: false,
      //     showTypeParameters: true,
      //     showSnippets: true
      // },

    
       
       
        theme: "vs-dark",
        automaticLayout: true,
        minimap: {
            enabled: true
        },
        scrollBeyondLastLine: true,
        fontFamily: "'Fira Code', 'Consolas', monospace",
        fontSize: 14,
        lineNumbers: "on",
        roundedSelection: true,
        scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
        }
    
  },
  
  typescript: {
    target: "es2020",
    lib: ["es2020", "dom", "dom.iterable"],
    module: "esnext",
    moduleResolution: "node",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    allowSyntheticDefaultImports: true,
    allowJs: true,
    checkJs: false,
    jsx: "ts.JsxEmit.Preserve",
    declaration: false,
  
    // Editor specific settings
    tabSize: 2,
    formatOnType: true,
    autoIndent: "full",
    semanticHighlighting: {
        enabled: true
    },
    quickSuggestions: {
        other: true,
        comments: false,
        strings: true
    },
    parameterHints: {
        enabled: true
    },
    suggest: {
        includeCompletionsForModuleExports: true,
        includeAutomaticOptionalChainCompletions: true,
        includeCompletionsWithInsertText: true,
        snippetsPreventQuickSuggestions: false,
        localityBonus: true,
        shareSuggestSelections: true,
        showIcons: true,
        preview: true,
        previewMode: "subword"
    },
    inlayHints: {
        enabled: true,
        includeInlayEnumMemberValueHints: true,
        includeInlayFunctionLikeReturnTypeHints: true,
        includeInlayFunctionParameterTypeHints: true,
        includeInlayParameterNameHints: "all",
        includeInlayParameterNameHintsWhenArgumentMatchesName: true,
        includeInlayPropertyDeclarationTypeHints: true,
        includeInlayVariableTypeHints: true
    },
    diagnostics: {
        enable: true,
        strict: true
    },
    hover: {
        enabled: true,
        delay: 300,
        sticky: true
    }
},
  
  html: {
      language: "html",
      tabSize: 2,
      formatOnType: false,
      formatOnPaste: true,
      autoIndent: "full",
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      quickSuggestions: {
          other: true,
          comments: false,
          strings: true
      },
      suggest: {
          showTags: true,
          showAttributes: true
      },
      wordWrap: "on",
      wrappingIndent: "indent"
  },
  
  css: {
      language: "css",
      tabSize: 2,
      formatOnType: true,
      autoIndent: "full",
      quickSuggestions: {
          other: true,
          comments: false,
          strings: true
      },
      suggest: {
          showProperties: true,
          showValues: true,
          showColors: true,
          showUnits: true
      },
      colorDecorators: true
  },
  
  scss: {
      language: "scss",
      tabSize: 2,
      formatOnType: true,
      autoIndent: "full",
      colorDecorators: true
  },
  
  less: {
      language: "less",
      tabSize: 2,
      formatOnType: true,
      autoIndent: "full",
      colorDecorators: true
  },
  
  json: {
      language: "json",
      tabSize: 2,
      formatOnPaste: true,
      formatOnType: false,
      autoIndent: "advanced",
      minimap: { enabled: false },
      quickSuggestions: {
          other: false,
          comments: false,
          strings: true
      },
      bracketPairColorization: {
          enabled: true
      }
  },
  
  markdown: {
      language: "markdown",
      tabSize: 2,
      wordWrap: "on",
      wrappingIndent: "same",
      minimap: { enabled: false },
      formatOnType: false,
      formatOnPaste: false,
      quickSuggestions: {
          other: false,
          comments: false,
          strings: false
      },
      renderWhitespace: "none",
      lineNumbers: "off",
      glyphMargin: false,
      folding: false,
      rulers: []
  },
  
  python: {
      language: "python",
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
      formatOnType: true,
      autoIndent: "full",
      quickSuggestions: {
          other: true,
          comments: false,
          strings: true
      },
      rulers: [79, 120],
      suggest: {
          showMethods: true,
          showFunctions: true,
          showClasses: true,
          showModules: true
      }
  },
  
  java: {
      language: "java",
      tabSize: 4,
      insertSpaces: true,
      formatOnType: true,
      autoIndent: "full",
      bracketPairColorization: {
          enabled: true
      },
      quickSuggestions: {
          other: true,
          comments: false,
          strings: false
      }
  },
  
  c: {
      language: "c",
      tabSize: 4,
      insertSpaces: true,
      formatOnType: true,
      autoIndent: "full",
      suggest: {
          showFunctions: true,
          showStructs: true,
          showKeywords: true
      }
  },
  
  cpp: {
      language: "cpp",
      tabSize: 4,
      insertSpaces: true,
      formatOnType: true,
      autoIndent: "full",
      semanticHighlighting: true,
      suggest: {
          showFunctions: true,
          showClasses: true,
          showStructs: true,
          showKeywords: true
      }
  },
  
  csharp: {
      language: "csharp",
      tabSize: 4,
      insertSpaces: true,
      formatOnType: true,
      autoIndent: "full",
      semanticHighlighting: true
  },
  
  php: {
      language: "php",
      tabSize: 4,
      formatOnType: true,
      autoIndent: "full"
  },
  
  ruby: {
      language: "ruby",
      tabSize: 2,
      formatOnType: true,
      autoIndent: "full"
  },
  
  go: {
      language: "go",
      tabSize: 4,
      insertSpaces: false, // Go uses tabs
      detectIndentation: false,
      formatOnType: true,
      formatOnSave: true
  },
  
  rust: {
      language: "rust",
      tabSize: 4,
      insertSpaces: true,
      formatOnType: true,
      autoIndent: "full",
      semanticHighlighting: true
  },
  
  sql: {
      language: "sql",
      tabSize: 2,
      formatOnType: false,
      autoIndent: "advanced"
  },
  
  xml: {
      language: "xml",
      tabSize: 2,
      formatOnType: false,
      formatOnPaste: true,
      autoIndent: "full",
      wordWrap: "on"
  },
  
  yaml: {
      language: "yaml",
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      formatOnType: false,
      autoIndent: "advanced"
  },
  
  dockerfile: {
      language: "dockerfile",
      tabSize: 4,
      formatOnType: false
  },
  
  shell: {
      language: "shell",
      tabSize: 2,
      formatOnType: false
  },
  
  powershell: {
      language: "powershell",
      tabSize: 4,
      formatOnType: false
  }
};

// /**
// * Language Metadata
// * Additional information about each language
// */
// export const LANGUAGE_METADATA = {
//   javascript: {
//       name: "JavaScript",
//       icon: "📜",
//       extension: ".js",
//       canExecute: true,
//       supportsLinting: true,
//       defaultCode: `// JavaScript\nconsole.log("Hello, JavaScript!");`,
//       mimeType: "text/javascript"
//   },
  
//   typescript: {
//       name: "TypeScript",
//       icon: "🔷",
//       extension: ".ts",
//       canExecute: true,
//       supportsLinting: true,
//       defaultCode: `// TypeScript\nconst greeting: string = "Hello, TypeScript!";\nconsole.log(greeting);`,
//       mimeType: "text/typescript"
//   },
  
//   html: {
//       name: "HTML",
//       icon: "🌐",
//       extension: ".html",
//       canExecute: true,
//       supportsLinting: true,
//       defaultCode: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello, HTML!</h1>\n</body>\n</html>`,
//       mimeType: "text/html"
//   },
  
//   css: {
//       name: "CSS",
//       icon: "🎨",
//       extension: ".css",
//       canExecute: true,
//       supportsLinting: true,
//       defaultCode: `/* CSS */\nbody {\n  font-family: Arial, sans-serif;\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n  color: white;\n  padding: 20px;\n}`,
//       mimeType: "text/css"
//   },
  
//   scss: {
//       name: "SCSS",
//       icon: "💅",
//       extension: ".scss",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// SCSS\n$primary-color: #667eea;\n\nbody {\n  color: $primary-color;\n}`,
//       mimeType: "text/x-scss"
//   },
  
//   less: {
//       name: "Less",
//       icon: "💄",
//       extension: ".less",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// Less\n@primary-color: #667eea;\n\nbody {\n  color: @primary-color;\n}`,
//       mimeType: "text/x-less"
//   },
  
//   json: {
//       name: "JSON",
//       icon: "📋",
//       extension: ".json",
//       canExecute: true,
//       supportsLinting: true,
//       defaultCode: `{\n  "name": "example",\n  "version": "1.0.0",\n  "description": "JSON Example"\n}`,
//       mimeType: "application/json"
//   },
  
//   markdown: {
//       name: "Markdown",
//       icon: "📝",
//       extension: ".md",
//       canExecute: true,
//       supportsLinting: false,
//       defaultCode: `# Markdown\n\n## Features\n\n- Lists\n- **Bold** and *italic*\n- Code blocks\n\n\`\`\`javascript\nconsole.log("Hello!");\n\`\`\``,
//       mimeType: "text/markdown"
//   },
  
//   python: {
//       name: "Python",
//       icon: "🐍",
//       extension: ".py",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `# Python\nprint("Hello, Python!")\n\n# Note: Python execution requires backend server`,
//       mimeType: "text/x-python"
//   },
  
//   java: {
//       name: "Java",
//       icon: "☕",
//       extension: ".java",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// Java\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n    }\n}`,
//       mimeType: "text/x-java"
//   },
  
//   c: {
//       name: "C",
//       icon: "©️",
//       extension: ".c",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// C\n#include <stdio.h>\n\nint main() {\n    printf("Hello, C!\\n");\n    return 0;\n}`,
//       mimeType: "text/x-c"
//   },
  
//   cpp: {
//       name: "C++",
//       icon: "⚡",
//       extension: ".cpp",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// C++\n#include <iostream>\n\nint main() {\n    std::cout << "Hello, C++!" << std::endl;\n    return 0;\n}`,
//       mimeType: "text/x-c++src"
//   },
  
//   csharp: {
//       name: "C#",
//       icon: "🎯",
//       extension: ".cs",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// C#\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, C#!");\n    }\n}`,
//       mimeType: "text/x-csharp"
//   },
  
//   php: {
//       name: "PHP",
//       icon: "🐘",
//       extension: ".php",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `<?php\n// PHP\necho "Hello, PHP!";\n?>`,
//       mimeType: "text/x-php"
//   },
  
//   ruby: {
//       name: "Ruby",
//       icon: "💎",
//       extension: ".rb",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `# Ruby\nputs "Hello, Ruby!"`,
//       mimeType: "text/x-ruby"
//   },
  
//   go: {
//       name: "Go",
//       icon: "🔵",
//       extension: ".go",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, Go!")\n}`,
//       mimeType: "text/x-go"
//   },
  
//   rust: {
//       name: "Rust",
//       icon: "🦀",
//       extension: ".rs",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `// Rust\nfn main() {\n    println!("Hello, Rust!");\n}`,
//       mimeType: "text/x-rust"
//   },
  
//   sql: {
//       name: "SQL",
//       icon: "🗄️",
//       extension: ".sql",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `-- SQL\nSELECT * FROM users WHERE active = 1;`,
//       mimeType: "text/x-sql"
//   },
  
//   xml: {
//       name: "XML",
//       icon: "📄",
//       extension: ".xml",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <element>Hello, XML!</element>\n</root>`,
//       mimeType: "text/xml"
//   },
  
//   yaml: {
//       name: "YAML",
//       icon: "⚙️",
//       extension: ".yaml",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `# YAML\nname: example\nversion: 1.0.0\nservices:\n  - web\n  - database`,
//       mimeType: "text/x-yaml"
//   },
  
//   dockerfile: {
//       name: "Dockerfile",
//       icon: "🐳",
//       extension: "",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `# Dockerfile\nFROM node:16-alpine\nWORKDIR /app\nCOPY package.json .\nRUN npm install\nCOPY . .\nCMD ["npm", "start"]`,
//       mimeType: "text/x-dockerfile"
//   },
  
//   shell: {
//       name: "Shell Script",
//       icon: "🐚",
//       extension: ".sh",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `#!/bin/bash\n# Shell Script\necho "Hello, Shell!"`,
//       mimeType: "text/x-sh"
//   },
  
//   powershell: {
//       name: "PowerShell",
//       icon: "⚡",
//       extension: ".ps1",
//       canExecute: false,
//       supportsLinting: true,
//       defaultCode: `# PowerShell\nWrite-Host "Hello, PowerShell!"`,
//       mimeType: "text/x-powershell"
//   }
// };

// /**
// * Theme Configurations
// */
// export const THEMES = {
//   dark: {
//       id: "vs-dark",
//       name: "Dark",
//       base: "vs-dark"
//   },
//   light: {
//       id: "vs",
//       name: "Light",
//       base: "vs"
//   },
//   highContrast: {
//       id: "hc-black",
//       name: "High Contrast",
//       base: "hc-black"
//   }
// };

// /**
// * Get merged configuration for a specific language
// * @param {string} languageId - The language identifier
// * @returns {object} Merged configuration object
// */
// export function getEditorConfig(languageId) {
//   const baseConfig = { ...BASE_EDITOR_CONFIG };
//   const languageConfig = EDITOR_CONFIGS[languageId] || {};
  
//   return {
//       ...baseConfig,
//       ...languageConfig
//   };
// }

// /**
// * Get language metadata
// * @param {string} languageId - The language identifier
// * @returns {object} Language metadata
// */
// export function getLanguageMetadata(languageId) {
//   return LANGUAGE_METADATA[languageId] || {
//       name: languageId,
//       icon: "📄",
//       extension: `.${languageId}`,
//       canExecute: false,
//       supportsLinting: false,
//       defaultCode: `// ${languageId}`,
//       mimeType: "text/plain"
//   };
// }

// /**
// * Get all supported languages
// * @returns {Array} Array of language IDs
// */
// export function getSupportedLanguages() {
//   return Object.keys(LANGUAGE_METADATA);
// }

// /**
// * Detect language from file extension
// * @param {string} filename - The filename
// * @returns {string} Language ID
// */
// export function detectLanguageFromFilename(filename) {
//   const ext = filename.split('.').pop().toLowerCase();
  
//   for (const [langId, metadata] of Object.entries(LANGUAGE_METADATA)) {
//       if (metadata.extension === `.${ext}`) {
//           return langId;
//       }
//   }
  
//   return 'javascript'; // Default fallback
// }