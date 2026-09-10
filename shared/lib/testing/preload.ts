// react-dom needs DOM globals before @testing-library/react loads, so this runs
// as a preload — see `[test] preload` in the bunfig.toml of every package
// that runs React tests.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// A spy left standing reaches every test file that runs after it, so it is
// restored here rather than per file. Spy in `beforeEach`: one installed in
// `beforeAll` or at file scope is gone after the file's first test.
afterEach(() => jest.restoreAllMocks());
