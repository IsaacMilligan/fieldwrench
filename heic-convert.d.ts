declare module "heic-convert" {
  function convert(opts: {
    buffer: Buffer;
    format: "JPEG" | "PNG";
    quality: number;
  }): Promise<ArrayBuffer>;
  export default convert;
}
