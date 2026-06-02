
.PHONY: build compile watch test test-all bench clean package publish info

# 生产打包（bun 打成单文件 out/main.js）
build:
	npm run bundle

# 仅类型检查 / 编译（tsc -> out/）
compile:
	npm run compile

# 监听编译
watch:
	npm run watch

# 单元 + 模糊 + 两实现等价校验（mocha，不启动 VSCode，快）
test:
	npm run test:unit

# 完整集成测试（通过 @vscode/test-electron 启动 VSCode）
test-all:
	npm run test

# split vs fsm 解析性能基准（bun）
bench:
	npm run bench

clean:
	-rm -rf out
	-mkdir out

# 打包并本地安装 vsix
# 依赖 test：test:unit 内部已做 tsc 全量类型检查 + 单元/模糊/等价测试，
# 一步完成「类型门禁 + 测试门禁」，且 vsce 自身只 bundle 不查类型。
package: test
	rm -rf *.vsix
	npm run package
	code --install-extension *.vsix

publish:
	npm run publish

# Node.js at least 14.x.x
# https://marketplace.visualstudio.com/manage/publishers/lfm
# vsce login lfm
info:
	node --version
	nvm use v16.14.0
