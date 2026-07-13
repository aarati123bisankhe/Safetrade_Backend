declare module "multer" {
  const multer: any;
  export default multer;
  export class MulterError extends Error {
    code: string;
  }
}
