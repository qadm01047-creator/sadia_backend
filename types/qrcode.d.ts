declare module 'qrcode' {
  interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    width?: number;
  }

  interface QRCode {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
    toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>;
    toString(text: string, options?: QRCodeOptions): Promise<string>;
  }

  const QRCode: QRCode;
  export default QRCode;
}
