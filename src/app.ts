import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { RegisterRoutes } from 'src/routes/routes';
import swaggerJson from 'src/swagger/swagger.json';
import session from 'express-session';
import MongoStore from 'connect-mongo';

export const createApp = (): Express => {
	const app: Express = express();
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	// TSOA Routes 등록
	RegisterRoutes(app);

	// Swagger UI 설정
	app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

	return app;
};
