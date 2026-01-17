/**
 * Utility functions for handling product image URLs
 * Ensures blob storage URLs are used when available
 */

/**
 * Check if a URL is already a full blob storage URL
 */
export function isBlobStorageUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('https://') && url.includes('blob.vercel-storage.com');
}

/**
 * Check if a URL is a localhost URL that should be avoided
 */
export function isLocalhostUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Normalize image URL - if it's a blob storage URL, return as-is
 * If it's a relative path and blob storage is configured, it should already be in blob storage
 * Otherwise return as-is (will be handled by frontend)
 */
export function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  // If already a blob storage URL, return as-is
  if (isBlobStorageUrl(url)) {
    return url;
  }
  
  // If it's a localhost URL, this is a problem - log warning
  if (isLocalhostUrl(url)) {
    console.warn(`⚠️  Warning: Product image URL contains localhost: ${url}`);
    console.warn('   This suggests blob storage was not used during upload.');
  }
  
  // Return as-is - if it's a relative path like /uploads/..., 
  // it should have been uploaded to blob storage during import
  // and stored as a blob URL. If it wasn't, the import needs to be re-run.
  return url;
}

/**
 * Normalize product images array
 */
export function normalizeProductImages(images: any[] | undefined): any[] {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map(img => ({
    ...img,
    url: normalizeImageUrl(img.url),
  }));
}

/**
 * Normalize a product's image URLs
 */
export function normalizeProduct(product: any): any {
  if (!product) return product;
  
  return {
    ...product,
    images: normalizeProductImages(product.images),
  };
}

/**
 * Normalize an array of products
 */
export function normalizeProducts(products: any[]): any[] {
  if (!Array.isArray(products)) return [];
  
  return products.map(normalizeProduct);
}
