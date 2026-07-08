import express from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import authRoutes from './routes/auth.js';
import githubRoutes from './routes/github.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Server Running');
});

app.use(authRoutes);
app.use(githubRoutes);

app.listen(CONFIG.PORT, () => {
  console.log(`Backend running on http://localhost:${CONFIG.PORT}`);
});
