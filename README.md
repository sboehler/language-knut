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
npm install -g vsce
vsce package
```

Then, install the VSIX file in Visual Studio Code.

## Release Notes

### 0.0.1

Add syntax highlighting 
Add folding
Add outline view
