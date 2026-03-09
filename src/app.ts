import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { RegisterRoutes } from 'src/routes/routes';
import swaggerJson from 'src/swagger/swagger.json';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { MONGO_URI, SESSION_SECRET } from 'src/settings';
import { uploadPdfMiddleware } from './middleware/uploadPdfMiddleware';
import { errorHandler } from './middleware/errorHandler';

export const createApp = (): Express => {
    const app: Express = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(session({
        secret: SESSION_SECRET,
        resave: false, // 변경사항이 없을 때 세션을 다시 저장할지
        saveUninitialized: false, // 로그인하지 않은 빈 세션을 저장할지
        store: MongoStore.create({
            mongoUrl: MONGO_URI,
            collectionName: 'sessions', // DB에 sessions라는 컬렉션이 자동 생성됨
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24, // 하루(24시간) 동안 로그인 유지
            httpOnly: true, // 자바스크립트에서 쿠키 탈취 방지 (XSS 보안)
            // secure: true // 나중에 배포해서 HTTPS를 쓸 때는 주석을 해제 (로컬은 false)
        },
    }));

    // TSOA Routes 등록
    RegisterRoutes(app, { multer: uploadPdfMiddleware });

    // Swagger UI 설정
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

    app.use(errorHandler);

    return app;
};
