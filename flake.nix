{
  description = "HolyC to WebAssembly Browser Compiler";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = {
    self,
    nixpkgs,
  }: let
    supportedSystems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];
    forEachSupportedSystem = f:
      nixpkgs.lib.genAttrs supportedSystems (system:
        f {
          pkgs = import nixpkgs {inherit system;};
          inherit system;
        });
  in {
    packages = forEachSupportedSystem ({pkgs, ...}: rec {
      holyc-translator = pkgs.buildNpmPackage {
        pname = "holyc-translator";
        version = "1.0.0";

        src = ./.;

        npmDepsHash = "sha256-dpBJQ5ZuGCr1nEudeKcEme2n0doXvat8h28k/x9VIlo=";

        npmBuildScript = "build";

        installPhase = ''
                      runHook preInstall

                      mkdir -p $out/share/holyc-translator
                      cp -r dist/* $out/share/holyc-translator/

                      mkdir -p $out/bin
                      cat << 'EOF' > $out/bin/holyc-translator
          #!/usr/bin/env sh
          PORT="''${PORT:-3000}"
          HOST="''${HOST:-127.0.0.1}"
          STATIC_DIR="$(cd "$(dirname "$0")/../share/holyc-translator" && pwd)"
          export STATIC_DIR

          exec ${pkgs.nodejs}/bin/node -e '
            const http = require("http");
            const fs = require("fs");
            const path = require("path");
            const baseDir = process.env.STATIC_DIR;
            const mimeTypes = {
              ".html": "text/html; charset=utf-8",
              ".js": "text/javascript; charset=utf-8",
              ".mjs": "text/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".json": "application/json; charset=utf-8",
              ".wasm": "application/wasm",
              ".ttf": "font/ttf",
              ".png": "image/png",
              ".svg": "image/svg+xml",
              ".ico": "image/x-icon"
            };
            const port = parseInt(process.env.PORT || "3000", 10);
            const host = process.env.HOST || "127.0.0.1";
            http.createServer((req, res) => {
              let safePath = path.normalize(decodeURI(req.url.split("?")[0]));
              if (safePath === "/" || safePath === "") safePath = "/index.html";
              const filePath = path.join(baseDir, safePath);
              if (!filePath.startsWith(baseDir)) {
                res.writeHead(403);
                return res.end("Forbidden");
              }
              fs.readFile(filePath, (err, data) => {
                if (err) {
                  if (err.code === "ENOENT") {
                    fs.readFile(path.join(baseDir, "index.html"), (e, indexData) => {
                      if (e) {
                        res.writeHead(404);
                        res.end("Not Found");
                      } else {
                        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                        res.end(indexData);
                      }
                    });
                  } else {
                    res.writeHead(500);
                    res.end("Internal Server Error");
                  }
                  return;
                }
                const ext = path.extname(filePath);
                const contentType = mimeTypes[ext] || "application/octet-stream";
                res.writeHead(200, { "Content-Type": contentType });
                res.end(data);
              });
            }).listen(port, host, () => {
              console.log(`HolyC Translator running at http://''${host}:''${port}`);
            });
          '
          EOF
                      chmod +x $out/bin/holyc-translator

                      runHook postInstall
        '';

        meta = {
          description = "HolyC to WebAssembly Browser Compiler";
          mainProgram = "holyc-translator";
        };
      };

      default = holyc-translator;
    });

    apps = forEachSupportedSystem ({system, ...}: {
      default = {
        type = "app";
        program = "${self.packages.${system}.default}/bin/holyc-translator";
        meta = {
          description = "Run HolyC to WebAssembly Browser Compiler";
        };
      };
    });

    devShells = forEachSupportedSystem ({pkgs, ...}: {
      default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs
          typescript
        ];
        shellHook = ''
          echo "HolyC to WebAssembly Browser Compiler dev environment loaded."
          echo "Commands:"
          echo "  npm install  - Install local npm dependencies"
          echo "  npm run dev  - Start Astro development server"
          echo "  npm run build - Build production static assets"
        '';
      };
    });
  };
}
