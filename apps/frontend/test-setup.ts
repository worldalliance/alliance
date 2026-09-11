// react-dom needs DOM globals before @testing-library/react loads, so this runs
// as a preload — see `[test] preload` in bunfig.toml.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

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
