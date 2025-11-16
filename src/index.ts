import dotenv from 'dotenv';
import express, { Express } from 'express';
import apiRouter from './routes';

dotenv.config();

const app: Express = express();
const PORT = 3000;

app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
