export const defaultConfig = {
  port: 3001,
  mongoUri: 'mongodb://127.0.0.1:27017/palinka',
  jwtSecret: 'palinka-dev-secret',
  frontendOrigin: 'http://localhost:4200',
  systemAdmin: {
    username: 'admin',
    password: 'admin123',
    displayName: 'Rendszer Admin',
  },
} as const;
