import 'dotenv/config';

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 3001),
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200',
} as const;
