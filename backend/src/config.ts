import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT || 3000);

export const CONFIG = {
  PORT: port,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || 'Ov23liFtzyAJzfzRmUfN',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  API_BASE_URL: `http://localhost:${port}`
};
