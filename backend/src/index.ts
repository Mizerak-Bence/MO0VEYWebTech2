import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config';
import { authRouter } from './routes/auth';
import { palinkasRouter } from './routes/palinkas';

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: false,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/palinkas', palinkasRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  await mongoose.connect(config.mongoUri);
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${config.port}`);
  });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API', err);
  process.exit(1);
});
