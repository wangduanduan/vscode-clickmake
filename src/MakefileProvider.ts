import * as vscode from 'vscode';
import { EXT_NAME } from './Config';
import { parseMakefileBy, ParserKind } from './MakefileParser';
/*
    MakefileProvider
    https://code.visualstudio.com/api/references/vscode-api
 */
export class MakefileProvider implements vscode.CodeLensProvider {

    // 按文件缓存已计算的 CodeLens，避免每次按键都全文扫描。
    private cache: Map<string, vscode.CodeLens[]> = new Map();
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // 保存后让该文件的缓存失效，并通知 VSCode 重新调用 provideCodeLenses。
        vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
            this.cache.delete(document.uri.toString());
            this._onDidChangeCodeLenses.fire();
        });

        // 文档关闭时清理缓存，避免占用内存。
        vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
            this.cache.delete(document.uri.toString());
        });

        vscode.workspace.onDidChangeConfiguration((_) => {
            console.log("onDidChangeConfiguration");
            this.cache.clear();
            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        if (!this.enabled()) { return []; }

        const key = document.uri.toString();
        const cached = this.cache.get(key);
        if (cached !== undefined) { return cached; }

        const codeLenses = this.computeCodeLenses(document);
        this.cache.set(key, codeLenses);
        return codeLenses;
    }

    /*
        解析 Makefile 得到 target 列表，再为每个 target 生成一个 CodeLens。
        解析逻辑见 MakefileParser.parseMakefile（纯函数，可单独测试）。
    */
    private computeCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        return parseMakefileBy(this.parserKind(), document.getText()).map((target) => {
            const position = new vscode.Position(target.line, 0);
            const range = document.getWordRangeAtPosition(position) as vscode.Range;
            return new vscode.CodeLens(range, {
                title: ` ▶ make ${target.name}`,
                tooltip: "runs target in terminal",
                command: `${EXT_NAME}.make`,
                arguments: [target.name, document.fileName]
            });
        });
    }

    /*
        @return: true if the codelens are enabled, false otherwise.
    */
    private enabled(): boolean {
        return vscode.workspace.getConfiguration(EXT_NAME).get("enabled", true);
    }

    /*
        @return: 用户选择的解析实现，默认 'split'。
    */
    private parserKind(): ParserKind {
        return vscode.workspace.getConfiguration(EXT_NAME).get<ParserKind>("parser", "split");
    }
}

