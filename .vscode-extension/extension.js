const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
    // The LSP server lives in the lsp/ directory at the repo root.
    // When installed from VSIX, it will be bundled alongside the extension.
    const serverModule = context.asAbsolutePath(path.join('lsp', 'server.js'));

    const serverOptions = {
        run: { module: serverModule, transport: TransportKind.stdio },
        debug: { module: serverModule, transport: TransportKind.stdio },
    };

    const clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'ohnrscript' }],
    };

    client = new LanguageClient(
        'ohnrscript-lsp',
        'Ohnrscript Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
}

function deactivate() {
    if (client) {
        return client.stop();
    }
}

module.exports = { activate, deactivate };
