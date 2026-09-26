# knut language support

This experimental extension for Visual Studio Code enables language support for the [knut](https://github.com/sboehler/knut) plain-text accounting system.

Current features:
- Syntax highlighting for the current journal format, as implemented by
  [fin](https://github.com/sboehler/fin)
- Outline view over org-mode style `*` headings

The extension is not published in the market place. For now, clone this repo and build it manually:

```shell
git clone https://github.com/sboehler/language-knut
cd language-knut
npm install
npx vsce package
```

Then, install the resulting VSIX file in Visual Studio Code.

## Development

Requires Node.js 22 or later. A [Nix](https://nixos.org) flake is provided, so
`nix develop` (or `direnv allow`) gets you a shell with the right toolchain.

```shell
npm install
npm run watch   # rebuild the bundle on change
npm run lint
npm test         # grammar snapshots, then eslint, tsc and the VS Code tests
npm run test:grammar -- -u   # update the grammar snapshots after a change
```

Press `F5` to launch a VS Code window with the extension loaded.

## Release Notes

### 0.0.1

Add syntax highlighting
Add folding
Add outline view
