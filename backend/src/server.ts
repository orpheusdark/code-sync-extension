import express, { Request, Response } from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import authRoutes from './routes/auth.js';
import githubRoutes from './routes/github.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.send('Server Running');
});

app.use(authRoutes);
app.use(githubRoutes);

const PORT = Number(process.env.PORT) || CONFIG.PORT;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});