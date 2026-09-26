# Change Log

## [Unreleased]

- Rename the extension to `language-fin`, after
  [fin](https://github.com/sboehler/fin), whose journal format it supports.
  The language id is now `fin`, the grammar scope `source.fin`, and `.fin` the
  extension it applies to. Journals named `.knut` are no longer recognized.
- Rename the settings: `knut.finPath` is now `fin.executable`, `knut.journal`
  is `fin.journal`, and `knut.diagnostics.enable` is `fin.diagnostics.enable`.
- Report what `fin` finds in the journal as diagnostics, on open and on save.
  `fin.journal` points at the root journal, which gets the checks that need the
  whole journal: accounts booked to before they are opened, and balance
  assertions that do not hold.
- Format with `fin format`, so format-on-save works.
- Make the path of an `include` directive clickable.
- Rewrite the grammar for the current journal format: the `open`, `close`,
  `balance`, `price`, `include` and `virtual` directives, `@accrue` and
  `@performance` annotations, both transaction notations including `->`/`<-`
  bookings, accounts, commodities, quantities and `//` comments.
- Drop the folding provider.
- Require VS Code 1.90 or later.
- Modernize the toolchain: TypeScript 5, ESLint 10 flat config, webpack 5,
  `@vscode/vsce` and `@vscode/test-cli`.

## [0.0.1]

- Initial release
