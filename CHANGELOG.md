# Change Log

## [Unreleased]

- Rewrite the grammar for the current journal format, as implemented by
  [fin](https://github.com/sboehler/fin): the `open`, `close`, `balance`,
  `price`, `include` and `virtual` directives, `@accrue` and `@performance`
  annotations, both transaction notations including `->`/`<-` bookings,
  accounts, commodities, quantities and `//` comments.
- Also recognize `.fin` files, the extension fin uses.
- Drop the folding provider.
- Require VS Code 1.90 or later.
- Modernize the toolchain: TypeScript 5, ESLint 10 flat config, webpack 5,
  `@vscode/vsce` and `@vscode/test-cli`.

## [0.0.1]

- Initial release
