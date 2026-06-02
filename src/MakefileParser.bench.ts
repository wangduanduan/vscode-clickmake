/*
    MakefileParser 微基准 + 实现对比

    对比两种解析实现：
      A) split 版（现行）：text.split(/\r\n|\r|\n/) 后逐行 indexOf/substring
      B) FSM 版：单遍 charCodeAt 扫描，不预先切出整行数组，只为命中的 target 名字分配字符串

    预热消除 JIT 抖动，多轮采样后报告 median，并给出 FSM 相对 split 的加速比。
    先做等价性校验，确保两实现输出完全一致再比性能。

    运行：npm run bench
*/

import { parseMakefile, parseMakefileFsm, MakefileTarget } from './MakefileParser';

/* ---------- 等价性校验 ---------- */
function makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}
function randomMakefileish(rng: () => number): string {
    const charset = 'abcXYZ:=#\t \r\n0_-./';
    const len = Math.floor(rng() * 60);
    let out = '';
    for (let i = 0; i < len; i++) { out += charset[Math.floor(rng() * charset.length)]; }
    return out;
}
function assertEquivalent(): void {
    const rng = makeRng(98765);
    for (let iter = 0; iter < 20000; iter++) {
        const text = randomMakefileish(rng);
        const a = JSON.stringify(parseMakefile(text));
        const b = JSON.stringify(parseMakefileFsm(text));
        if (a !== b) {
            console.error('等价性校验失败！输入=', JSON.stringify(text));
            console.error('  split:', a);
            console.error('  fsm  :', b);
            throw new Error('两实现输出不一致，性能对比无意义');
        }
    }
    console.log('等价性校验通过（20000 组随机输入，两实现输出一致）\n');
}

/* ---------- 基准 ---------- */
function makeInput(lineCount: number): string {
    const lines: string[] = new Array(lineCount);
    for (let i = 0; i < lineCount; i++) {
        if (i % 10 === 0) { lines[i] = `target${i}: dep_a dep_b`; }
        else if (i % 10 === 1) { lines[i] = `VAR${i} = some/value/${i}`; }
        else if (i % 10 === 5) { lines[i] = ''; }
        else { lines[i] = '\t@echo "building ${@}"'; }
    }
    return lines.join('\n');
}

function median(samples: number[]): number {
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function timeIt(fn: (t: string) => MakefileTarget[], text: string, rounds: number): number {
    for (let i = 0; i < Math.max(5, Math.floor(rounds / 10)); i++) { fn(text); } // 预热
    const samples: number[] = new Array(rounds);
    let sink = 0;
    for (let i = 0; i < rounds; i++) {
        const start = performance.now();
        sink += fn(text).length; // 防 DCE
        samples[i] = performance.now() - start;
    }
    if (sink < 0) { throw new Error('unreachable'); }
    return median(samples);
}

function compare(label: string, lineCount: number, rounds: number): void {
    const text = makeInput(lineCount);
    const a = timeIt(parseMakefile, text, rounds);
    const b = timeIt(parseMakefileFsm, text, rounds);
    const speedup = a / b;
    console.log(
        `${label.padEnd(10)} | split ${a.toFixed(3)}ms  | fsm ${b.toFixed(3)}ms  | ` +
        `加速 ${speedup.toFixed(2)}x`,
    );
}

assertEquivalent();
console.log('split vs fsm （median）\n' + '-'.repeat(72));
compare('1K 行', 1_000, 2000);
compare('10K 行', 10_000, 1000);
compare('100K 行', 100_000, 200);
compare('1M 行', 1_000_000, 30);
console.log('-'.repeat(72));
