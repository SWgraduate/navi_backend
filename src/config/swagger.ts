import swaggerJSDoc, { Options as SwaggerJSDocOptions } from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';

const swaggerOptions: SwaggerJSDocOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Erica Capstone Design Backend API',
      version: '1.0.0',
      description: 'API documentation for the Erica Capstone Design Backend project.',
    },
    servers: [
      {
        url: 'https://erica-capstone-2026-backend.onrender.com',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);

export const swaggerUiOptions: SwaggerUiOptions = {
  swaggerOptions: {
    docExpansion: 'none',
    persistAuthorization: true,
  },
};
