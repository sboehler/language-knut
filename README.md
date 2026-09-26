# fin language support

This experimental extension for Visual Studio Code enables language support for the [fin](https://github.com/sboehler/fin) plain-text accounting system.

Current features:
- Syntax highlighting for the journal format, as implemented by
  [fin](https://github.com/sboehler/fin)
- Diagnostics: what `fin` finds in the journal, in the Problems panel
- Formatting with `fin format`, so format-on-save works
- Ctrl-click an `include` path to open the file it names
- Outline view over org-mode style `*` headings
- Completion of account names, from the `open` directives of the journal

The highlighting, the outline and the completions work on their own; everything
else needs the `fin` binary, see [Configuration](#configuration).

The extension is not published in the market place. For now, clone this repo and build it manually:

```shell
git clone https://github.com/sboehler/language-fin
cd language-fin
npm install
npx vsce package
```

Then, install the resulting VSIX file in Visual Studio Code.

## Configuration

| Setting | What it does |
| --- | --- |
| `fin.executable` | The `fin` binary. A bare name is looked up on `PATH`. Defaults to `fin`. |
| `fin.journal` | The root journal, as a path relative to the workspace folder. See below. |
| `fin.diagnostics.enable` | Whether to check journals at all. Defaults to `true`. |

With `fin.journal` set, journals are checked with `fin balance` over that file.
That follows `include`s, so it also reports accounts booked to before they are
opened, and balance assertions that do not hold. An error found in an included
file is reported against that file.

Left empty, only the edited file is checked, with `fin parse`, which reports
syntax errors alone. That is the safe default: an included fragment does not
open the accounts it books to, so checking one on its own would invent errors.

`fin` reads from disk, so journals are checked when opened and when saved, not
while being typed into.

Account names are completed from the `open` directives the journal holds, which
the extension reads itself: with `fin.journal` set, from the root journal and
everything it includes, and otherwise from the edited file, its includes, and
every other `.fin` file in the workspace. An account is offered as soon as it is
opened, before the file it is opened in has been saved.

## Development

Requires Node.js 22 or later. A [Nix](https://nixos.org) flake is provided, so
`nix develop` (or `direnv allow`) gets you a shell with the right toolchain.

```shell
npm install
npm run watch                # rebuild the bundle on change
npm run lint
npm test                     # grammar snapshots, then tsc, eslint and the VS Code tests
npm run test:grammar -- -u   # update the grammar snapshots after a change
```

The tests that drive `fin` are skipped unless `FIN_TEST_BIN` points at a built
binary:

```shell
FIN_TEST_BIN=../fin/target/release/fin npm test
```

Press `F5` to launch a VS Code window with the extension loaded.

## Release Notes

### 0.0.1

Add syntax highlighting
Add outline view
