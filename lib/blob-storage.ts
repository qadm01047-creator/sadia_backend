import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

if (!USE_BLOB && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function cleanName(name: string): string {
  return path.basename(name).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
}

function toFolderPath(folder: string, filename: string): string {
  const f = folder.replace(/^\/+|\/+$/g, '');
  const n = cleanName(filename);
  return `${f}/${n}`;
}

function generateUniqueFilename(file: File | Blob): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 12);
  const ext =
    file instanceof File && file.name && file.name.includes('.')
      ? file.name.substring(file.name.lastIndexOf('.'))
      : '';
  return `${timestamp}-${randomString}${ext}`;
}

export async function uploadFileToBlob(
  file: File | Blob,
  filename?: string
): Promise<string> {
  try {
    const finalName = filename ? cleanName(filename) : generateUniqueFilename(file);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (USE_BLOB) {
      const blobPath = finalName.startsWith('uploads/')
        ? finalName
        : toFolderPath('uploads', finalName);

      const { url } = await put(blobPath, buffer, {
        access: 'public',
        contentType: file instanceof File ? file.type : undefined,
        addRandomSuffix: !filename,
      });

      return url;
    }

    const filePath = path.join(UPLOADS_DIR, finalName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${finalName}`;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function uploadBufferToBlob(
  buffer: Buffer,
  filename: string,
  contentType?: string
): Promise<string> {
  try {
    const cleanFilename = cleanName(filename);

    if (USE_BLOB) {
      const blobPath = cleanFilename.startsWith('uploads/')
        ? cleanFilename
        : toFolderPath('uploads', cleanFilename);

      const { url } = await put(blobPath, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
      });

      return url;
    }

    const filePath = path.join(UPLOADS_DIR, cleanFilename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${cleanFilename}`;
  } catch (error) {
    console.error('Error uploading buffer:', error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export type DatabaseFileType =
  | 'users'
  | 'products'
  | 'categories'
  | 'coupons'
  | 'orders'
  | 'orderItems'
  | 'inventory'
  | 'reviews'
  | 'supportMessages'
  | 'payments'
  | 'exchanges'
  | 'newsletterSubscriptions'
  | 'saleAnalytics'
  | 'settings';

function getDatabaseFilename(type: DatabaseFileType): string {
  switch (type) {
    case 'users':
      return 'users.json';
    case 'products':
      return 'products.json';
    case 'categories':
      return 'categories.json';
    case 'newsletterSubscriptions':
      return 'newsletterSubscriptions.json';
    case 'inventory':
      return 'inventory.json';
    case 'reviews':
      return 'reviews.json';
    case 'supportMessages':
      return 'supportMessages.json';
    case 'payments':
      return 'payments.json';
    case 'exchanges':
      return 'exchanges.json';
    case 'saleAnalytics':
      return 'saleAnalytics.json';
    case 'coupons':
      return 'coupons.json';
    case 'orders':
      return 'orders.json';
    case 'orderItems':
      return 'orderItems.json';
    case 'settings':
      return 'settings.json';
    default:
      return `${String(type)}.json`;
  }
}

export async function uploadJsonDatabase(
  type: DatabaseFileType,
  data: unknown
): Promise<string> {
  try {
    const filename = getDatabaseFilename(type);
    const blobPath = toFolderPath('database', filename);

    const json = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(json, 'utf-8');

    if (USE_BLOB) {
      const { url } = await put(blobPath, buffer, {
        access: 'public',
        contentType: 'application/json; charset=utf-8',
        addRandomSuffix: false,
      });
      return url;
    }

    const localDir = path.join(process.cwd(), 'public', 'database');
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const filePath = path.join(localDir, filename);
    fs.writeFileSync(filePath, buffer);

    return `/database/${filename}`;
  } catch (error) {
    console.error('Error uploading JSON database:', error);
    throw new Error(
      `Failed to upload JSON database: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
