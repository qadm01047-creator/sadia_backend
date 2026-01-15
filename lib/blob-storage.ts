import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

// Check if Vercel Blob token is available
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// Local storage directory
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure uploads directory exists
if (!USE_BLOB && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Upload file to Vercel Blob Storage or local filesystem (fallback)
 * @param file - File to upload
 * @param filename - Optional custom filename (will generate if not provided)
 * @returns URL of the uploaded file
 */
export async function uploadFileToBlob(
  file: File | Blob,
  filename?: string
): Promise<string> {
  try {
    // Generate filename if not provided
    let blobFilename: string;
    
    if (filename) {
      // Clean filename - remove path separators and keep only the base name
      const cleanFilename = path.basename(filename);
      blobFilename = cleanFilename;
    } else {
      let blobFilename;

     switch (dataType) {
       case 'user':
       blobFilename = 'users.json';
       break;
     case 'product':
      blobFilename = 'products.json';
      break;
      case 'category':
      blobFilename = 'categories.json';
      break;
      // добавь остальные типы данных по аналогии
      default:
    throw new Error('Unknown data type');
     }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Use Vercel Blob if token is available, otherwise use local storage
    if (USE_BLOB) {
      const blobPath = blobFilename.startsWith('uploads/') ? blobFilename : `uploads/${blobFilename}`;
      const { url } = await put(blobPath, buffer, {
        access: 'public',
        contentType: file instanceof File ? file.type : undefined,
      });
      return url;
    } else {
      // Fallback to local file storage
      const filePath = path.join(UPLOADS_DIR, blobFilename);
      fs.writeFileSync(filePath, buffer);
      
      // Return relative URL that Next.js can serve
      return `/uploads/${blobFilename}`;
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload file buffer to Vercel Blob Storage or local filesystem (fallback)
 * @param buffer - Buffer to upload
 * @param filename - Filename for the blob
 * @param contentType - Optional content type
 * @returns URL of the uploaded file
 */
export async function uploadBufferToBlob(
  buffer: Buffer,
  filename: string,
  contentType?: string
): Promise<string> {
  try {
    // Clean filename
    const cleanFilename = path.basename(filename);

    // Use Vercel Blob if token is available, otherwise use local storage
    if (USE_BLOB) {
      const blobPath = cleanFilename.startsWith('uploads/') ? cleanFilename : `uploads/${cleanFilename}`;
      const { url } = await put(blobPath, buffer, {
        access: 'public',
        contentType,
      });
      return url;
    } else {
      // Fallback to local file storage
      const filePath = path.join(UPLOADS_DIR, cleanFilename);
      fs.writeFileSync(filePath, buffer);
      
      // Return relative URL that Next.js can serve
      return `/uploads/${cleanFilename}`;
    }
  } catch (error) {
    console.error('Error uploading buffer:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

