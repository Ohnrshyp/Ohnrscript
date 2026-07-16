#!/usr/bin/env node
// lsp/server.js
// Ohnrscript Language Server Protocol (LSP) Implementation
//
// This LSP server leverages the real Ohnrscript self-hosted parser to provide:
//   - Real-time diagnostics (parse errors)
//   - Go-to-definition (functions, variables, classes)
//   - Hover information (declaration kind, scope)
//   - Document symbols (outline view)
//   - Find all references
//
// It connects to the editor over STDIO using the official LSP protocol.

'use strict';

const {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    DiagnosticSeverity,
    SymbolKind,
    CompletionItemKind,
} = require('vscode-languageserver/node');

const { TextDocument } = require('vscode-languageserver-textdocument');
const path = require('path');
const fs = require('fs');

// ============================================================
// 1. LSP Connection & Document Manager
// ============================================================
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

// Per-document symbol tables
// Map<uri, { symbols: Symbol[], parseOk: boolean }>
const documentData = new Map();

// ============================================================
// 2. Load the Real Ohnrscript Parser
// ============================================================
let parser = null;
let parserAvailable = false;

function loadParser() {
    try {
        const compilerRoot = path.resolve(__dirname, '../compiler/src');
        // Clear any cached modules to get a fresh parser state
        for (const key of Object.keys(require.cache)) {
            if (key.includes('compiler/src')) {
                delete require.cache[key];
            }
        }
        parser = require(path.join(compilerRoot, 'frontend/parser.ohn'));
        parserAvailable = true;
        connection.console.log('Ohnrscript parser loaded successfully.');
    } catch (e) {
        connection.console.warn('Could not load Ohnrscript parser: ' + e.message);
        connection.console.warn('Falling back to regex-based analysis.');
        parserAvailable = false;
    }
}

// ============================================================
// 3. Symbol Extraction (Regex-Based — Reliable Fallback)
// ============================================================
// Even with the real parser, we use regex for symbol extraction because
// the DOD arena parser doesn't expose named symbol metadata directly.
// This is the standard approach used by most LSP v1 implementations.

/**
 * @typedef {Object} OhnSymbol
 * @property {string} name
 * @property {'function'|'variable'|'class'|'method'|'parameter'|'extern'} kind
 * @property {number} line       - 0-indexed line number
 * @property {number} character  - 0-indexed column
 * @property {number} endLine
 * @property {number} endCharacter
 * @property {string} detail     - hover info
 * @property {string[]} [parameters] - for functions
 */

function extractSymbols(text) {
    const symbols = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // ── Function Declarations ──
        // function foo(a, b, c) {
        const fnMatch = line.match(/^\s*function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/);
        if (fnMatch) {
            const col = line.indexOf('function');
            const params = fnMatch[2].split(',').map(p => p.trim()).filter(Boolean);
            symbols.push({
                name: fnMatch[1],
                kind: 'function',
                line: i,
                character: col,
                endLine: i,
                endCharacter: col + 'function'.length + 1 + fnMatch[1].length,
                detail: `function ${fnMatch[1]}(${fnMatch[2].trim()})`,
                parameters: params,
            });

            // Also register each parameter as a symbol
            for (const p of params) {
                const pName = p.replace(/\s*[:=].*/, '').trim();
                if (pName) {
                    symbols.push({
                        name: pName,
                        kind: 'parameter',
                        line: i,
                        character: line.indexOf(pName, col),
                        endLine: i,
                        endCharacter: line.indexOf(pName, col) + pName.length,
                        detail: `(parameter) ${pName} — in ${fnMatch[1]}()`,
                    });
                }
            }
            continue;
        }

        // ── Class Declarations ──
        // class Foo {
        const classMatch = line.match(/^\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (classMatch) {
            const col = line.indexOf('class');
            symbols.push({
                name: classMatch[1],
                kind: 'class',
                line: i,
                character: col,
                endLine: i,
                endCharacter: col + 'class'.length + 1 + classMatch[1].length,
                detail: `class ${classMatch[1]}`,
            });
            continue;
        }

        // ── Variable Declarations ──
        // const foo = ...; let bar = ...; var baz = ...;
        const varMatch = line.match(/^\s*(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*/);
        if (varMatch) {
            const col = line.indexOf(varMatch[1]);
            const nameCol = line.indexOf(varMatch[2], col);
            // Determine the value preview (truncated)
            const eqIdx = line.indexOf('=', nameCol);
            let valuePreview = '';
            if (eqIdx !== -1) {
                valuePreview = line.substring(eqIdx + 1).trim();
                if (valuePreview.endsWith(';')) valuePreview = valuePreview.slice(0, -1).trim();
                if (valuePreview.length > 60) valuePreview = valuePreview.substring(0, 57) + '...';
            }
            symbols.push({
                name: varMatch[2],
                kind: 'variable',
                line: i,
                character: nameCol,
                endLine: i,
                endCharacter: nameCol + varMatch[2].length,
                detail: `${varMatch[1]} ${varMatch[2]}${valuePreview ? ' = ' + valuePreview : ''}`,
            });
            continue;
        }

        // ── Extern Declarations ──
        // extern function tlsBind(...)
        const externMatch = line.match(/^\s*extern\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/);
        if (externMatch) {
            const col = line.indexOf('extern');
            symbols.push({
                name: externMatch[1],
                kind: 'extern',
                line: i,
                character: col,
                endLine: i,
                endCharacter: col + line.trimStart().length,
                detail: `extern function ${externMatch[1]}(${externMatch[2].trim()})`,
            });
            continue;
        }

        // ── Method Definitions (inside classes) ──
        // methodName(args) {
        const methodMatch = line.match(/^\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/);
        if (methodMatch && !line.match(/^\s*(if|while|for|function|class|return|const|let|var)\s/)) {
            const col = line.indexOf(methodMatch[1]);
            symbols.push({
                name: methodMatch[1],
                kind: 'method',
                line: i,
                character: col,
                endLine: i,
                endCharacter: col + methodMatch[1].length,
                detail: `(method) ${methodMatch[1]}(${methodMatch[2].trim()})`,
            });
        }
    }

    return symbols;
}

// ============================================================
// 4. Diagnostics via Real Parser
// ============================================================

function validateDocument(textDocument) {
    const text = textDocument.getText();
    const diagnostics = [];

    // Try the real parser first
    if (parserAvailable) {
        try {
            // Clear parser state
            for (const key of Object.keys(require.cache)) {
                if (key.includes('compiler/src')) {
                    delete require.cache[key];
                }
            }
            const freshParser = require(path.resolve(__dirname, '../compiler/src/frontend/parser.ohn'));
            const sourceBuffer = new Uint8Array(Buffer.from(text, 'utf-8'));
            freshParser.parse(sourceBuffer);
            // If we get here, parse succeeded — no errors
        } catch (e) {
            // Parse failed — extract error info
            const msg = e.message || String(e);

            // Try to extract line/column from the error message
            let line = 0;
            let col = 0;
            const posMatch = msg.match(/(?:at byte|offset|position)\s+(\d+)/i);
            if (posMatch) {
                const byteOffset = parseInt(posMatch[1], 10);
                // Convert byte offset to line/col
                const prefix = text.substring(0, byteOffset);
                const lines = prefix.split('\n');
                line = Math.max(0, lines.length - 1);
                col = lines[lines.length - 1].length;
            }

            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line, character: col },
                    end: { line, character: col + 10 },
                },
                message: msg,
                source: 'ohnrscript',
            });
        }
    }

    // Additional lint-style checks (always run)
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Warn on console.log in production code
        if (line.includes('console.log') && !textDocument.uri.includes('test')) {
            const col = line.indexOf('console.log');
            diagnostics.push({
                severity: DiagnosticSeverity.Information,
                range: {
                    start: { line: i, character: col },
                    end: { line: i, character: col + 'console.log'.length },
                },
                message: 'Consider removing console.log before production.',
                source: 'ohnrscript',
            });
        }
    }

    // Extract and cache symbols
    const symbols = extractSymbols(text);
    documentData.set(textDocument.uri, { symbols, parseOk: diagnostics.length === 0 });

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// ============================================================
// 5. LSP Capabilities & Handlers
// ============================================================

connection.onInitialize(() => {
    loadParser();

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ['.'],
            },
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
        },
    };
});

// ── Hover ──
connection.onHover((params) => {
    const data = documentData.get(params.textDocument.uri);
    if (!data) return null;

    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const word = getWordAtPosition(doc, params.position);
    if (!word) return null;

    // Find the best matching symbol
    const sym = data.symbols.find(s => s.name === word);
    if (!sym) return null;

    return {
        contents: {
            kind: 'markdown',
            value: `\`\`\`ohnrscript\n${sym.detail}\n\`\`\``,
        },
    };
});

// ── Go To Definition ──
connection.onDefinition((params) => {
    const data = documentData.get(params.textDocument.uri);
    if (!data) return null;

    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;

    const word = getWordAtPosition(doc, params.position);
    if (!word) return null;

    // Find the definition (first declaration) of the symbol
    const sym = data.symbols.find(s =>
        s.name === word && (s.kind === 'function' || s.kind === 'variable' || s.kind === 'class' || s.kind === 'extern')
    );
    if (!sym) return null;

    return {
        uri: params.textDocument.uri,
        range: {
            start: { line: sym.line, character: sym.character },
            end: { line: sym.endLine, character: sym.endCharacter },
        },
    };
});

// ── Find All References ──
connection.onReferences((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];

    const word = getWordAtPosition(doc, params.position);
    if (!word) return [];

    const text = doc.getText();
    const locations = [];
    const lines = text.split('\n');

    // Regex search for all occurrences of the word as a whole word
    const wordRegex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
        let match;
        while ((match = wordRegex.exec(lines[i])) !== null) {
            locations.push({
                uri: params.textDocument.uri,
                range: {
                    start: { line: i, character: match.index },
                    end: { line: i, character: match.index + word.length },
                },
            });
        }
    }

    return locations;
});

// ── Document Symbols (Outline) ──
connection.onDocumentSymbol((params) => {
    const data = documentData.get(params.textDocument.uri);
    if (!data) return [];

    return data.symbols
        .filter(s => s.kind !== 'parameter')
        .map(s => ({
            name: s.name,
            kind: symbolKindMap(s.kind),
            range: {
                start: { line: s.line, character: s.character },
                end: { line: s.endLine, character: s.endCharacter },
            },
            selectionRange: {
                start: { line: s.line, character: s.character },
                end: { line: s.endLine, character: s.endCharacter },
            },
        }));
});

// ── Completions ──
connection.onCompletion((params) => {
    const data = documentData.get(params.textDocument.uri);
    const items = [];

    // Ohnrscript keywords
    const keywords = [
        'const', 'let', 'var', 'function', 'class', 'if', 'else',
        'while', 'for', 'return', 'new', 'throw', 'break', 'continue',
        'extern', 'slots', 'true', 'false', 'null', 'undefined',
        'typeof', 'this',
    ];

    for (const kw of keywords) {
        items.push({
            label: kw,
            kind: CompletionItemKind.Keyword,
        });
    }

    // Add symbols from the current document
    if (data) {
        for (const sym of data.symbols) {
            items.push({
                label: sym.name,
                kind: sym.kind === 'function' ? CompletionItemKind.Function
                    : sym.kind === 'class' ? CompletionItemKind.Class
                    : sym.kind === 'method' ? CompletionItemKind.Method
                    : sym.kind === 'extern' ? CompletionItemKind.Interface
                    : CompletionItemKind.Variable,
                detail: sym.detail,
            });
        }
    }

    return items;
});

// ============================================================
// 6. Utility Functions
// ============================================================

function getWordAtPosition(doc, position) {
    const text = doc.getText();
    const lines = text.split('\n');
    const line = lines[position.line];
    if (!line) return null;

    // Walk backwards from cursor to find word start
    let start = position.character;
    while (start > 0 && /[a-zA-Z0-9_$]/.test(line[start - 1])) {
        start--;
    }

    // Walk forwards to find word end
    let end = position.character;
    while (end < line.length && /[a-zA-Z0-9_$]/.test(line[end])) {
        end++;
    }

    const word = line.substring(start, end);
    return word.length > 0 ? word : null;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function symbolKindMap(kind) {
    switch (kind) {
        case 'function': return SymbolKind.Function;
        case 'variable': return SymbolKind.Variable;
        case 'class': return SymbolKind.Class;
        case 'method': return SymbolKind.Method;
        case 'extern': return SymbolKind.Interface;
        default: return SymbolKind.Variable;
    }
}

// ============================================================
// 7. Document Lifecycle
// ============================================================

documents.onDidChangeContent((change) => {
    validateDocument(change.document);
});

documents.onDidClose((event) => {
    documentData.delete(event.document.uri);
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// ============================================================
// 8. Start
// ============================================================
documents.listen(connection);
connection.listen();
