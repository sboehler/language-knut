{
  description = "fin";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }@inputs:
  let
    supportedSystems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];

    forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

    nixpkgsFor = forAllSystems (system: import nixpkgs {
      inherit system;
      config = { };
    });

    # What package.json holds, so that the name and the version are kept in the
    # one place vsce reads them from.
    manifest = nixpkgs.lib.importJSON ./package.json;

    # What the extension is built from. The rest of the working tree, .direnv,
    # node_modules and the VS Code under .vscode-test above all, has no
    # business in the store.
    source = nixpkgs.lib.fileset.toSource {
      root = ./.;
      fileset = nixpkgs.lib.fileset.unions [
        ./build
        ./src
        ./syntaxes
        ./.vscodeignore
        ./CHANGELOG.md
        ./LICENSE
        ./README.md
        ./language-configuration.json
        ./package-lock.json
        ./package.json
        ./tsconfig.json
      ];
    };
  in {
    packages = forAllSystems (system:
    let
      pkgs = nixpkgsFor.${system};
      vsix = "${manifest.name}-${manifest.version}.vsix";
    in {
      default = self.packages.${system}.vsix;

      # The extension, packaged as vsce packages it: install the result with
      # `code --install-extension`.
      vsix = pkgs.buildNpmPackage {
        pname = manifest.name;
        inherit (manifest) version;
        src = source;

        nodejs = pkgs.nodejs_24;

        # The lock file is read as it stands, so that a dependency bump needs
        # no hash updated here.
        npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
        npmConfigHook = pkgs.importNpmLock.npmConfigHook;

        # vsce runs the vscode:prepublish script itself, which is what bundles
        # the extension, so there is nothing to build before it. The tests are
        # left to CI: they download VS Code and want a display to run it in.
        buildPhase = ''
          runHook preBuild
          node_modules/.bin/vsce package --out ${vsix}
          runHook postBuild
        '';

        installPhase = ''
          runHook preInstall
          install -Dm444 ${vsix} -t $out
          runHook postInstall
        '';

        meta = {
          inherit (manifest) description;
          homepage = manifest.repository.url;
          license = pkgs.lib.licenses.asl20;
        };
      };
    });

    devShells = forAllSystems (system:
    let
      pkgs = nixpkgsFor.${system};
    in {
      default = pkgs.mkShell {
        name = "fin";
        buildInputs = with pkgs; [
          nodejs_24
        ];
      };
    });
  };
}
