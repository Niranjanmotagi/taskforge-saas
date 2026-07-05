import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '@/config/env';

/**
 * OpenAPI spec assembled from JSDoc @openapi blocks in route files.
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'TaskForge API',
      version: '1.0.0',
      description:
        'Enterprise project management platform API. All endpoints return the envelope `{ success, data, meta? }` or `{ success: false, error }`.',
      contact: { name: 'TaskForge Engineering' },
    },
    servers: [{ url: `${env.API_URL}/api/v1`, description: env.NODE_ENV }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/routes/*.ts'],
});
