/*
    MakefileParser

    纯函数解析模块：不依赖 vscode，可在普通 Node 环境直接 import，
    便于做单元测试、性能测试和模糊测试（fuzzing）。
*/

export interface MakefileTarget {
    /** target 名字（冒号之前的部分） */
    name: string;
    /** target 所在行号，0 起始 */
    line: number;
}

/** 可选的解析实现：'split' 简单易读（默认），'fsm' 单遍扫描、约快 3 倍但更复杂。 */
export type ParserKind = 'split' | 'fsm';

/*
    按指定实现解析 Makefile。两种实现输出完全一致（见 MakefileParser.bench.ts 的等价性校验），
    仅性能与代码复杂度不同。

    @param kind 解析实现：'split'（默认）或 'fsm'
    @param text Makefile 全文
*/
export function parseMakefileBy(kind: ParserKind, text: string): MakefileTarget[] {
    return kind === 'fsm' ? parseMakefileFsm(text) : parseMakefile(text);
}

/*
    实现 A（默认）：split 版。

    先按换行切出整行数组，再逐行判断。简单直观，适合绝大多数 Makefile。

    规则（保持与原 provideCodeLenses 一致）：
      - 行首必须是字母（a-z / A-Z），排除缩进的命令行、注释、空行
      - 行内不能有等号（=），排除变量赋值
      - 行内必须有冒号（:），target 名取冒号之前的内容

    @param text Makefile 全文
    @return 解析出的 target 列表
*/
export function parseMakefile(text: string): MakefileTarget[] {
    const targets: MakefileTarget[] = [];
    // 兼容三种换行：Windows(\r\n)、Unix(\n)、老式 Mac(\r)，避免孤立 \r 混入 target 名字。
    const lines = text.split(/\r\n|\r|\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const first = line[0];

        const isLetter =
            (first >= 'a' && first <= 'z') || (first >= 'A' && first <= 'Z');
        if (!isLetter) { continue; }

        if (line.indexOf("=") !== -1) { continue; } // 不能是变量赋值

        const indexOfColon = line.indexOf(":");
        if (indexOfColon === -1) { continue; } // 必须有冒号

        targets.push({ name: line.substring(0, indexOfColon), line: i });
    }

    return targets;
}

/*
    实现 B（可选）：FSM / 单遍字符扫描版。

    单遍 charCodeAt 扫描，不预先切出整行数组，只为命中的 target 名字分配字符串，
    在超大文件上约比 split 版快 3 倍（见 npm run bench）。输出与 parseMakefile 完全一致。

    @param text Makefile 全文
    @return 解析出的 target 列表
*/
export function parseMakefileFsm(text: string): MakefileTarget[] {
    const targets: MakefileTarget[] = [];
    const len = text.length;
    let line = 0;
    let i = 0;

    while (i < len) {
        const lineStart = i;
        const first = text.charCodeAt(i);
        const isLetter =
            (first >= 97 && first <= 122) || (first >= 65 && first <= 90); // a-z / A-Z

        let colon = -1;
        let hasEq = false;
        let j = i;

        if (isLetter) {
            while (j < len) {
                const c = text.charCodeAt(j);
                if (c === 10 || c === 13) { break; }              // \n / \r
                if (c === 61) { hasEq = true; }                   // =
                else if (c === 58 && colon === -1) { colon = j; } // :
                j++;
            }
            if (colon !== -1 && !hasEq) {
                targets.push({ name: text.substring(lineStart, colon), line });
            }
        } else {
            while (j < len) {                                     // 非字母行：快进到行尾
                const c = text.charCodeAt(j);
                if (c === 10 || c === 13) { break; }
                j++;
            }
        }

        if (j < len) {
            // \r\n 视为单个换行；其余 \r 或 \n 各算一个
            if (text.charCodeAt(j) === 13 && j + 1 < len && text.charCodeAt(j + 1) === 10) {
                j += 2;
            } else {
                j += 1;
            }
            line++;
        }
        i = j;
    }

    return targets;
}
