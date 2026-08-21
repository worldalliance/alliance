/**
 * Local declaration for html-encoding-sniffer v4: DefinitelyTyped stops at
 * v3 (`@types/html-encoding-sniffer@3.0.2`) and v4 ships no types of its
 * own, so depending on the @types package would silently pin type
 * definitions one major behind the runtime. The v4 API is unchanged from
 * v3; this mirrors `lib/html-encoding-sniffer.js`.
 */
declare module "html-encoding-sniffer" {
  interface Options {
    /**
     * An encoding label obtained from the "transport layer" (probably an
     * HTTP `Content-Type` header), which overrides everything but a BOM.
     */
    transportLayerEncodingLabel?: string | undefined;

    /**
     * The ultimate fallback when no valid encoding is supplied by the
     * transport layer and none is sniffed from the bytes.
     *
     * @default 'windows-1252'
     */
    defaultEncoding?: string | undefined;
  }

  /**
   * Determine the encoding of an (X)HTML byte stream per the HTML
   * Standard's encoding sniffing algorithm: BOM, then the transport-layer
   * label, then a `<meta charset>` prescan of the first 1024 bytes.
   *
   * @returns The canonical encoding name for use with `whatwg-encoding`
   *          or similar (e.g. iconv-lite).
   */
  function sniffHTMLEncoding(htmlBytes: Uint8Array, options?: Options): string;

  export = sniffHTMLEncoding;
}
