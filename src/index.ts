import express, { Express, Request, Response } from 'express';

const app: Express = express();
const PORT = 3000;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from TS + Express');
});

app.get('/test', (req: Request, res: Response) => {
  res.json({
    message: 'Test router with TypeScript',
    time: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
