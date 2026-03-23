import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User';
import { config } from '../config';

export const ensureSystemAdmin = async () => {
  const passwordHash = await bcrypt.hash(config.systemAdmin.password, 10);

  await UserModel.findOneAndUpdate(
    { username: config.systemAdmin.username },
    {
      username: config.systemAdmin.username,
      displayName: config.systemAdmin.displayName,
      role: 'admin',
      isSystemAdmin: true,
      passwordHash,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};
