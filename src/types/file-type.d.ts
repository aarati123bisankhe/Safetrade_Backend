declare module "file-type" {
  export type FileTypeResult = {
    ext: string;
    mime: string;
  };

  export function fileTypeFromBuffer(
    input: Uint8Array | ArrayBuffer,
  ): Promise<FileTypeResult | undefined>;
}
