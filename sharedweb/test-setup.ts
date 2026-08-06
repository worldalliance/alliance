// react-dom needs DOM globals before @testing-library/react loads, so this runs
// as a preload — see `[test] preload` in bunfig.toml.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
