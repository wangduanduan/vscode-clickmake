# clickmake 

This extension allows you to run a `Makefile` `target` from within the
editor by clicking above the `target`. It will execute the following command in the terminal:

```bash
make -C "${makefileDir}" -f ${filename} ${target}
```

* `makefileDir` - the directory of the Makefile that is being edited
* `filename` - file where you clicked the TARGET
* `target`  - the text found using the following logic: 
  *  any line starting with an alphabeticnumeric string followed by a colon and not including `=`

> `make -C` is used to change directory (instead of a shell `cd ... && ...`) so the
> command works in shells that do not support `&&`, such as nushell.

## Features

![screenshot](https://raw.githubusercontent.com/lfmunoz/clickmake/main/media/screenshot.png)


## Requirements

* Tested on vscode 1.72.2

## Extension Settings

* `clickmake.enabled` (boolean, default `true`) — enable or disable processing of Makefiles.
* `clickmake.parser` (`"split"` | `"fsm"`, default `"split"`) — which parsing implementation to use:
  * `split` — simple line-split parser. Readable and fast enough for normal Makefiles.
  * `fsm` — single-pass scanner. ~3x faster on very large files, with identical output.

CodeLenses are cached per document and only recomputed after the file is saved (or when
configuration changes), so editing does not re-parse on every keystroke.

## Development

Parsing lives in [`src/MakefileParser.ts`](src/MakefileParser.ts) as pure, vscode-independent
functions, so it can be unit/perf/fuzz tested without launching VSCode.

```bash
npm run test:unit   # unit + fuzz + cross-implementation equivalence tests (mocha, no electron)
npm run bench       # split vs fsm micro-benchmark (bun)
npm run test        # full integration tests (launches VSCode via @vscode/test-electron)
```

## Known Issues

* Command executed and the text displayed above the target are not yet configurable.

## Release Notes

### 0.4.2

* CodeLenses are now cached and only recomputed on save instead of on every keystroke
* Parsing extracted into a pure, testable module with unit / fuzz / benchmark coverage
* Added `clickmake.parser` setting to choose between the `split` (default) and `fsm` parsers
* Line endings now handled robustly (`\r\n`, `\n`, and lone `\r`)
* Removed unimplemented settings (`cacheSize`, `commandTemplate`, `titleTemplate`)


-----------------------------------------------------------------------------------------------------------

# Contributing

Feedback and pull requests are welcomed. 

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating extensions.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

