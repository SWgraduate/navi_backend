import MongoStore from 'connect-mongo';
import cors from 'cors';
import express, { Express } from 'express';
import session from 'express-session';
import { RegisterRoutes } from 'src/generated/routes';
import swaggerJson from 'src/generated/swagger.json';
import { COOKIE_CONFIG, MONGO_URI, SESSION_SECRET } from 'src/settings';
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

  app.use(session({
    secret: SESSION_SECRET,
    resave: false,          // 변경사항이 없을 때 세션을 다시 저장할지
    saveUninitialized: false, // 로그인하지 않은 빈 세션을 저장할지
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: 'sessions',
    }),
    cookie: COOKIE_CONFIG,
  }));

  // TSOA Routes 등록
  RegisterRoutes(app, { multer: uploadPdfMiddleware });

  // Swagger UI 설정
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

  app.use(errorHandler);

  return app;
};
