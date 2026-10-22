/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

declare module "*as=picture" {
  const picture: import("vite-imagetools").Picture;
  export default picture;
}
