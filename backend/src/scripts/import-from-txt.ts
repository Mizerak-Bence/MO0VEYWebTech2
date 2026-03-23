import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { config } from '../config';
import { UserModel } from '../models/User';
import { PalinkaModel } from '../models/Palinka';
import { buildPalinkaName } from '../palinka-name';

const defaultDistillationStyle = 'Kétlépcsős lepárlás';

type ParsedVolume = {
  liters: number;
  minLiters?: number;
  maxLiters?: number;
  raw: string;
};

const parseNumberHu = (input: string): number | null => {
  const normalized = input.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const parseCapacityFromFilename = (filename: string): number | null => {
  const lowered = filename.toLowerCase();
  if (lowered.includes('05l')) return 0.5;
  if (lowered.includes('0,5l')) return 0.5;
  if (lowered.includes('0.5l')) return 0.5;
  if (lowered.includes('1,5l')) return 1.5;
  if (lowered.includes('1.5l')) return 1.5;
  if (lowered.includes('1l')) return 1;
  return null;
};

const parseDate = (text: string): Date | null => {
  // matches e.g. 24/12/06 or 25/10/16
  const m = text.match(/\b(\d{2})\/(\d{2})\/(\d{2})\b/);
  if (!m) return null;
  const year = 2000 + Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

const parseAbv = (text: string): number | null => {
  const m = text.match(/\b(\d{1,3})\s*°/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
};

const parseVolume = (text: string): ParsedVolume | null => {
  // supports: "0,6-0,7l", "0,3l", "2-3dl", "0,2dl"
  const mRange = text.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(dl|l)\b/i);
  if (mRange) {
    const a = parseNumberHu(mRange[1]);
    const b = parseNumberHu(mRange[2]);
    if (a == null || b == null) return null;
    const unit = mRange[3].toLowerCase();
    const mul = unit === 'dl' ? 0.1 : 1;
    const minLiters = Math.min(a, b) * mul;
    const maxLiters = Math.max(a, b) * mul;
    return {
      raw: mRange[0],
      liters: (minLiters + maxLiters) / 2,
      minLiters,
      maxLiters,
    };
  }

  const mSingle = text.match(/(\d+(?:[.,]\d+)?)\s*(dl|l)\b/i);
  if (mSingle) {
    const a = parseNumberHu(mSingle[1]);
    if (a == null) return null;
    const unit = mSingle[2].toLowerCase();
    const mul = unit === 'dl' ? 0.1 : 1;
    const liters = a * mul;
    return { raw: mSingle[0], liters, minLiters: liters, maxLiters: liters };
  }

  return null;
};

const parseFruitType = (text: string): string => {
  // take first token-ish segment before date/degree/volume
  const cut = text
    .split(/\b\d{2}\/\d{2}\/\d{2}\b/)[0]
    .split(/\b\d{1,3}\s*°/)[0]
    .split(/\b\d+(?:[.,]\d+)?\s*(?:dl|l)\b/i)[0]
    .trim();

  const cleaned = cut.replace(/^\[.*?\]\s*/g, '').trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 60) : 'ismeretlen';
};

const repoRootFromBackend = () => path.resolve(__dirname, '..', '..', '..');

const usage = () => {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  npm run dev   (API)  // separate terminal',
      '  node scripts:',
      '  npx tsx src/scripts/import-from-txt.ts --username <u> --password <p> [--dry-run]',
      '',
      'Reads *.txt files from repo root and imports palinka entries into MongoDB.',
    ].join('\n')
  );
};

const main = async () => {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const idx = args.indexOf(name);
    if (idx === -1) return null;
    return args[idx + 1] ?? null;
  };

  const username = getArg('--username');
  const password = getArg('--password');
  const dryRun = args.includes('--dry-run');

  if (!username || !password) {
    usage();
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);

  let user = await UserModel.findOne({ username });
  if (!user) {
    const userCount = await UserModel.countDocuments();
    const passwordHash = await bcrypt.hash(password, 10);
    user = await UserModel.create({ username, role: userCount === 0 ? 'admin' : 'user', passwordHash });
    // eslint-disable-next-line no-console
    console.log(`Created user: ${username}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`Using existing user: ${username}`);
  }

  const repoRoot = repoRootFromBackend();
  const files = (await fs.readdir(repoRoot)).filter((f) => f.toLowerCase().endsWith('.txt'));
  if (files.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No .txt files found in repo root.');
    return;
  }

  let total = 0;
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(repoRoot, file);
    const content = await fs.readFile(filePath, 'utf8');
    const capacity = parseCapacityFromFilename(file);

    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter((l) => !/^_+$/.test(l));

    let idx = 0;
    for (const line of lines) {
      if (!line.startsWith('[')) continue;
      idx += 1;
      total += 1;

      const fruitType = parseFruitType(line);
      const madeDate = parseDate(line);
      const abv = line.includes('?°') ? null : parseAbv(line);
      const vol = parseVolume(line);

      if (!vol) {
        skipped += 1;
        // eslint-disable-next-line no-console
        console.log(`SKIP (no volume parsed) [${file}] ${line}`);
        continue;
      }

      // Keep volume range only if it looks plausible for the container
      const minLiters = capacity != null && vol.minLiters != null && vol.minLiters > capacity + 0.05 ? undefined : vol.minLiters;
      const maxLiters = capacity != null && vol.maxLiters != null && vol.maxLiters > capacity + 0.05 ? undefined : vol.maxLiters;

      const name = buildPalinkaName({
        fruitType,
        distillationStyle: defaultDistillationStyle,
        volumeLiters: vol.liters,
        containerCapacityLiters: capacity ?? undefined,
        abvPercent: abv,
        madeDate,
      });

      const doc = {
        ownerId: user._id,
        name,
        fruitType,
        abvPercent: abv ?? undefined,
        volumeLiters: vol.liters,
        volumeMinLiters: minLiters,
        volumeMaxLiters: maxLiters,
        containerCapacityLiters: capacity ?? undefined,
        distillationStyle: defaultDistillationStyle,
        madeDate: madeDate ?? undefined,
        notes: vol.raw !== line ? `${vol.raw} | ${line}`.slice(0, 500) : line.slice(0, 500),
        sourceFile: file,
        sourceLine: line.slice(0, 500),
      };

      if (dryRun) {
        imported += 1;
        continue;
      }

      try {
        await PalinkaModel.create(doc);
        imported += 1;
      } catch (err: any) {
        if (err?.code === 11000) {
          skipped += 1;
          // eslint-disable-next-line no-console
          console.log(`DUPLICATE [${file}] ${name}`);
          continue;
        }
        throw err;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Done. total=${total} imported=${imported} skipped=${skipped} dryRun=${dryRun}`);
};

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
