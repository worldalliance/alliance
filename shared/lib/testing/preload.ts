// react-dom needs DOM globals before @testing-library/react loads, so this runs
// as a preload — see `[test] preload` in the bunfig.toml of every package
// that runs React tests.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// A failed matcher prints what it received, and bun's default inspection of a
// node walks its document, window and React fibers: megabytes of text and
// seconds of CPU, enough to carry a waitFor retry past the test timeout.
Object.defineProperty(Node.prototype, Bun.inspect.custom, {
  value(this: Node) {
    return this instanceof Element ? this.outerHTML : this.nodeName;
  },
});

// Vite resolves image imports: a plain one to a URL, `?as=picture` to the
// descriptor vite-imagetools builds. Bun hands back the file path for both.
Bun.plugin({
  name: "image-imports",
  setup(build) {
    build.onLoad({ filter: /\.(avif|jpeg|jpg|png|webp)(\?|$)/ }, (args) => ({
      contents: args.path.includes("as=picture")
        ? 'export default { sources: {}, img: { src: "data:,", w: 1, h: 1 } };'
        : 'export default "data:,";',
      loader: "js",
    }));
  },
});

// A spy left standing reaches every test file that runs after it, so it is
// restored here rather than per file. Spy in `beforeEach`: one installed in
// `beforeAll` or at file scope is gone after the file's first test.
afterEach(() => jest.restoreAllMocks());
