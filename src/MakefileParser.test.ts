/*
    MakefileParser 单元 / 性能 / 模糊测试

    解析函数是纯函数、不依赖 vscode，因此本测试用普通 mocha 在 node 下直接运行，
    无需启动 VSCode（test-electron）。

    两种实现（split / fsm）都是生产代码，单元与模糊用例对两者各跑一遍，
    并额外做一轮“两实现输出必须一致”的交叉校验。

    运行：npm run test:unit
*/

import * as assert from 'assert';
import {
    parseMakefile,
    parseMakefileFsm,
    MakefileTarget,
    ParserKind,
} from './MakefileParser';

// 待测的两种实现
const IMPLS: { kind: ParserKind; fn: (t: string) => MakefileTarget[] }[] = [
    { kind: 'split', fn: parseMakefile },
    { kind: 'fsm', fn: parseMakefileFsm },
];

// 用简单的可重复 PRNG，保证失败可复现（不依赖 Math.random 的不确定性）。
function makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function randomLine(rng: () => number): string {
    const charset = 'abcXYZ:=#\t \r\n0_-./';
    const len = Math.floor(rng() * 40);
    let out = '';
    for (let i = 0; i < len; i++) {
        out += charset[Math.floor(rng() * charset.length)];
    }
    return out;
}

function randomText(rng: () => number): string {
    const lineCount = Math.floor(rng() * 30);
    const lines: string[] = [];
    for (let i = 0; i < lineCount; i++) { lines.push(randomLine(rng)); }
    return lines.join('\n');
}

// 单元 + 模糊用例对每种实现各跑一遍
for (const { kind, fn } of IMPLS) {

    suite(`parseMakefile[${kind}] - 单元测试`, () => {

        test('单个 target', () => {
            assert.deepStrictEqual(fn('build:'), [
                { name: 'build', line: 0 },
            ]);
        });

        test('多个 target，行号正确', () => {
            const text = [
                'build:',      // 0
                '\tgcc a.c',   // 1
                '',            // 2
                'clean:',      // 3
                '\trm -f a',   // 4
            ].join('\n');
            assert.deepStrictEqual(fn(text), [
                { name: 'build', line: 0 },
                { name: 'clean', line: 3 },
            ]);
        });

        test('带依赖的 target 只取冒号前的名字', () => {
            assert.deepStrictEqual(fn('all: build test'), [
                { name: 'all', line: 0 },
            ]);
        });

        test('忽略变量赋值（含等号）', () => {
            assert.deepStrictEqual(fn('OUR_URL=https://google.com'), []);
        });

        test('忽略缩进的命令行（行首是 tab/空格）', () => {
            assert.deepStrictEqual(fn('\tcurl http://x:80'), []);
            assert.deepStrictEqual(fn('    echo hi:'), []);
        });

        test('忽略注释行', () => {
            assert.deepStrictEqual(fn('# this: is a comment'), []);
        });

        test('忽略空行与空白文本', () => {
            assert.deepStrictEqual(fn(''), []);
            assert.deepStrictEqual(fn('\n\n\n'), []);
        });

        test('忽略没有冒号的行', () => {
            assert.deepStrictEqual(fn('justaword'), []);
        });

        test('既有冒号又有等号的行被忽略（与原逻辑一致）', () => {
            assert.deepStrictEqual(fn('target: VAR=1'), []);
        });

        test('兼容 CRLF 换行，名字不残留 \\r', () => {
            const text = 'build:\r\n\tgcc a.c\r\nclean:\r\n';
            assert.deepStrictEqual(fn(text), [
                { name: 'build', line: 0 },
                { name: 'clean', line: 2 },
            ]);
        });

        test('兼容老式 Mac 的孤立 \\r 换行', () => {
            const text = 'build:\rclean:\r';
            assert.deepStrictEqual(fn(text), [
                { name: 'build', line: 0 },
                { name: 'clean', line: 1 },
            ]);
        });

        test('贴近真实的 Makefile（对应 examples/Makefile）', () => {
            const text = [
                '',                              // 0
                '',                              // 1
                '',                              // 2
                'OUR_URL=https://google.com',    // 3
                '',                              // 4
                'info:',                         // 5
                '\t@echo "info: ${OUR_URL}"',    // 6
                '\tcurl http://www.google.com',  // 7
            ].join('\n');
            assert.deepStrictEqual(fn(text), [
                { name: 'info', line: 5 },
            ]);
        });
    });

    suite(`parseMakefile[${kind}] - 模糊测试`, () => {

        test('随机畸形输入：不抛异常，且输出满足不变量', () => {
            const rng = makeRng(12345);

            for (let iter = 0; iter < 5000; iter++) {
                const text = randomText(rng);
                const split = text.split(/\r\n|\r|\n/); // 与解析实现的切分规则一致

                let targets: MakefileTarget[];
                assert.doesNotThrow(() => {
                    targets = fn(text);
                }, `在输入 ${JSON.stringify(text)} 上抛异常`);

                for (const t of targets!) {
                    assert.ok(
                        t.line >= 0 && t.line < split.length,
                        `行号越界: ${t.line} / ${split.length}`,
                    );
                    const expected = split[t.line].substring(0, split[t.line].indexOf(':'));
                    assert.strictEqual(t.name, expected, `名字与源行不一致，输入=${JSON.stringify(text)}`);
                    assert.ok(!t.name.includes('\n') && !t.name.includes('\r'),
                        `名字含换行符: ${JSON.stringify(t.name)}`);
                }
            }
        });
    });
}

suite('parseMakefile - 两实现交叉等价校验', () => {

    test('随机输入下 split 与 fsm 输出完全一致', () => {
        const rng = makeRng(98765);
        for (let iter = 0; iter < 20000; iter++) {
            const text = randomText(rng);
            assert.deepStrictEqual(
                parseMakefileFsm(text),
                parseMakefile(text),
                `两实现输出不一致，输入=${JSON.stringify(text)}`,
            );
        }
    });
});

suite('parseMakefile - 性能测试', () => {

    test('10 万行大文件应快速完成', () => {
        const lines: string[] = [];
        for (let i = 0; i < 100_000; i++) {
            // 每 10 行放一个 target，其余是命令/变量/空行
            if (i % 10 === 0) {
                lines.push(`target${i}:`);
            } else if (i % 10 === 1) {
                lines.push(`VAR${i}=value`);
            } else {
                lines.push('\t@echo work');
            }
        }
        const text = lines.join('\n');

        const start = performance.now();
        const targets = parseMakefile(text);
        const elapsed = performance.now() - start;

        assert.strictEqual(targets.length, 10_000);
        // 阈值给得很宽松，只为兜住明显的性能退化（如意外的 O(n^2)）。
        assert.ok(elapsed < 1000, `解析耗时 ${elapsed.toFixed(1)}ms，超过 1000ms 阈值`);
        // eslint-disable-next-line no-console
        console.log(`    ↳ 10 万行解析耗时 ${elapsed.toFixed(1)}ms`);
    });
});
