import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sadia.lux API Documentation',
      version: '1.0.0',
      description: 'API documentation for Sadia.lux e-commerce backend system',
      contact: {
        name: 'API Support',
        email: 'support@sadia.lux',
      },
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://sadia-backend.vercel.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['SUPERADMIN', 'ADMIN', 'CASHIER', 'USER'] },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            address: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            categoryId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderNumber: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'PAID', 'CANCELLED', 'COMPLETED'] },
            source: { type: 'string', enum: ['ONLINE', 'POS', 'TELEGRAM'] },
            total: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Products', description: 'Product management endpoints' },
      { name: 'Categories', description: 'Category management endpoints' },
      { name: 'Orders', description: 'Order management endpoints' },
      { name: 'Reviews', description: 'Review management endpoints' },
      { name: 'Admin', description: 'Admin panel endpoints' },
      { name: 'Telegram', description: 'Telegram bot endpoints' },
      { name: 'POS', description: 'Point of Sale endpoints' },
      { name: 'Inventory', description: 'Inventory management endpoints' },
      { name: 'Support', description: 'Support message endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Coupons', description: 'Coupon management endpoints' },
      { name: 'Newsletter', description: 'Newsletter subscription endpoints' },
      { name: 'Upload', description: 'File upload endpoints' },
      { name: 'Exchanges', description: 'Exchange and return endpoints' },
    ],
  },
  apis: [
    './app/api/**/*.ts',
    './app/api/**/*.tsx',
    path.resolve(process.cwd(), 'app/api/**/*.ts'),
    path.resolve(process.cwd(), 'app/api/**/*.tsx'),
  ],
};

let swaggerSpec: any;
try {
  swaggerSpec = swaggerJsdoc(options);
  
  if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
    console.warn('Swagger: No API paths found. Check if JSDoc comments are present in API route files.');
  } else {
    console.log(`Swagger: Found ${Object.keys(swaggerSpec.paths).length} API paths`);
  }
} catch (error) {
  console.error('Swagger generation error:', error);
  if (!options.definition) {
    swaggerSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Sadia.lux API Documentation',
        version: '1.0.0',
        description: 'API documentation for Sadia.lux e-commerce backend system',
      },
      servers: [{ url: 'http://localhost:3000', description: 'Development server' }],
      paths: {},
      components: {},
      tags: [],
    };
  } else {
    swaggerSpec = {
      openapi: '3.0.0',
      info: options.definition.info,
      servers: options.definition.servers,
      paths: {},
      components: options.definition.components || {},
      tags: options.definition.tags || [],
    };
  }
}

export { swaggerSpec };
