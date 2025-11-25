import dotenv from 'dotenv';
import express, { Express } from 'express';
import swaggerJSDoc from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import {
  apiRouter,
  indexRouter,
} from './routes';

dotenv.config();

const app: Express = express();
const PORT = 3000;

app.use('/', indexRouter);
app.use('/api', apiRouter);

// 들어오는 JSON 요청 body를 자동으로 파싱해서 req.body에 넣어주는 미들웨어 등록
app.use(express.json()); 

// Swagger UI 설정
app.use('/api-docs', swaggerJSDoc.serve, swaggerJSDoc.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
