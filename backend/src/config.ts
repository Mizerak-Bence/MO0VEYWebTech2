import 'dotenv/config';
import { defaultConfig } from './config.defaults';

export const config = {
  port: Number(process.env.PORT ?? defaultConfig.port),
  mongoUri: process.env.MONGO_URI ?? defaultConfig.mongoUri,
  jwtSecret: process.env.JWT_SECRET ?? defaultConfig.jwtSecret,
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? defaultConfig.frontendOrigin,
  systemAdmin: {
    username: process.env.SYSTEM_ADMIN_USERNAME ?? defaultConfig.systemAdmin.username,
    password: process.env.SYSTEM_ADMIN_PASSWORD ?? defaultConfig.systemAdmin.password,
    displayName: process.env.SYSTEM_ADMIN_DISPLAY_NAME ?? defaultConfig.systemAdmin.displayName,
  },
} as const;
