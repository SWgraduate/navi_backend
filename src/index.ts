import dotenv from 'dotenv';
import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { RegisterRoutes } from './routes/routes';
import swaggerJson from './swagger/swagger.json';
import { connectDB } from './config/database';

dotenv.config();

// MongoDB 연결
connectDB();

const app: Express = express();
const PORT = 3000;

// 들어오는 JSON 요청 body를 자동으로 파싱해서 req.body에 넣어주는 미들웨어 등록
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TSOA Routes 등록
RegisterRoutes(app);

// Swagger UI 설정
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJson));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});