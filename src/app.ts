import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import { RegisterRoutes } from 'src/routes/routes';
import swaggerJson from 'src/swagger/swagger.json';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { MONGO_URI, SESSION_SECRET } from 'src/settings';

export const createApp = (): Express => {
    const app: Express = express();

    app.use(cors({
        origin: ['http://localhost:3000', 'https://navi-frontend-one.vercel.app'],
        credentials: true,
    }));

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
            // 크로스 도메인(Vercel 프론트엔드 - Render 백엔드) 환경 배포 시 아래 두 주석을 해제 고려 (26. 3. 10. 태영)
            // sameSite: 'none',
            // secure: true
        },
    }));

    // TSOA Routes 등록
    RegisterRoutes(app);

    // Swagger UI 설정
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

    return app;
};
