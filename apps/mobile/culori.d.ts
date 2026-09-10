// `uniwindResolve.test.ts` imports uniwind's source, so tsc walks it, and
// `native-utils.ts` there imports culori, which ships no types.
declare module "culori";
