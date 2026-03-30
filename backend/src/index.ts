import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config';
import { authRouter } from './routes/auth';
import { chatsRouter } from './routes/chats';
import { palinkasRouter } from './routes/palinkas';
import { ensureSystemAdmin } from './services/system-admin';

const app = express();
const frontendDistPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist', 'palinka-nyilvantarto', 'browser');
const hasBuiltFrontend = fs.existsSync(frontendDistPath);

app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: false,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/palinkas', palinkasRouter);

if (hasBuiltFrontend) {
  app.use(express.static(frontendDistPath));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

const start = async () => {
  await mongoose.connect(config.mongoUri);
  await ensureSystemAdmin();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      hasBuiltFrontend
        ? `App listening on http://localhost:${config.port}`
        : `API listening on http://localhost:${config.port}`
    );
  });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API', err);
  process.exit(1);
});
