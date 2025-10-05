import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/index.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  test: false,
  testPattern: "**/*.test.ts",
  packageManager: "npm",
  typeCheck: "single",
  package: {
    // package.json properties
    name: "@ambrus-toth/undonete",
    version: Deno.args[0],
    description: "Type-safe undo/redo library",
    repository: {
      type: "git",
      url: "git+https://github.com/tothambrus11/undonete.git",
    },
    bugs: {
      url: "https://github.com/tothambrus11/undonete/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
