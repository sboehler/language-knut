# knut language support

This experimental extension for Visual Studio Code enables language support for the [knut](https://github.com/sboehler/knut) plain-text accounting system.

Current features:
- Syntax highlighting
- Folding with org-mode style headers
- Outline view

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
npm test        # runs eslint, tsc and the integration tests in VS Code
```

Press `F5` to launch a VS Code window with the extension loaded.

## Release Notes

### 0.0.1

Add syntax highlighting
Add folding
Add outline view
