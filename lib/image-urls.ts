export function isBlobStorageUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('https://') && url.includes('blob.vercel-storage.com');
}

export function isLocalhostUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  if (isBlobStorageUrl(url)) {
    return url;
  }
  
  if (isLocalhostUrl(url)) {
    console.warn(`⚠️  Warning: Product image URL contains localhost: ${url}`);
    console.warn('   This suggests blob storage was not used during upload.');
  }
  
  return url;
}

export function normalizeProductImages(images: any[] | undefined): any[] {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map(img => ({
    ...img,
    url: normalizeImageUrl(img.url),
  }));
}

export function normalizeProduct(product: any): any {
  if (!product) return product;
  
  return {
    ...product,
    images: normalizeProductImages(product.images),
  };
}

export function normalizeProducts(products: any[]): any[] {
  if (!Array.isArray(products)) return [];
  
  return products.map(normalizeProduct);
}
