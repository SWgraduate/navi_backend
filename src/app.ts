import cors from 'cors';
import express, { Express } from 'express';
import { RegisterRoutes } from 'src/generated/routes';
import swaggerJson from 'src/generated/swagger.json';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler';
import { uploadPdfMiddleware } from './middleware/uploadPdfMiddleware';

export const createApp = (): Express => {
  const app: Express = express();

  app.set('trust proxy', 1);

  app.use(cors({
    origin: ['http://localhost:3000', 'https://navi-frontend-one.vercel.app'],
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // TSOA Routes 등록
  RegisterRoutes(app, { multer: uploadPdfMiddleware });

  // Swagger UI 설정
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

  app.use(errorHandler);

  return app;
};
