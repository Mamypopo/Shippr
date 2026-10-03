/**
 * Account management from the command line.
 *
 * There is no self-serve signup and no password-reset email, so this is how
 * accounts come into existence and how a forgotten password is fixed. The
 * first ADMIN has to be created here, or there would be no way in at all.
 *
 *   npm run user create <username> <role>   # prompts for the password
 *   npm run user passwd <username>
 *   npm run user list
 *   npm run user disable <username>
 *   npm run user enable <username>
 *   npm run user unlock <username>
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  checkPasswordStrength,
  checkUsername,
  hashPassword,
  normalizeUsername,
} from "../src/lib/password";
import type { UserRole } from "../src/generated/prisma/enums";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("ตั้งค่า DATABASE_URL ใน .env ก่อน");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const CR = "\r";
const LF = "\n";
const CTRL_C = "\u0003";
const DEL = "\u007f";
const BACKSPACE = "\b";

/**
 * Read a password without echoing it.
 *
 * Taking it as a command-line argument would leave the password in shell
 * history and in the process list, so it is always prompted for, in raw mode
 * so nothing is printed as it is typed.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      reject(
        new Error("ต้องรันคำสั่งนี้ในเทอร์มินัลจริง เพื่อรับรหัสผ่านโดยไม่แสดงบนหน้าจอ"),
      );
      return;
    }

    process.stdout.write(question);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    const finish = (result: string | null, error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write(LF);
      if (error) reject(error);
      else resolve(result ?? "");
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === CR || char === LF) {
          finish(value);
          return;
        }
        if (char === CTRL_C) {
          finish(null, new Error("ยกเลิก"));
          return;
        }
        if (char === DEL || char === BACKSPACE) {
          value = value.slice(0, -1);
          continue;
        }
        // Drop the remaining control characters rather than storing them.
        if (char >= " ") value += char;
      }
    };

    stdin.on("data", onData);
  });
}

async function readNewPassword(): Promise<string> {
  const password = await promptHidden("รหัสผ่านใหม่: ");
  const strength = checkPasswordStrength(password);
  if (!strength.ok) throw new Error(strength.message);

  const again = await promptHidden("พิมพ์อีกครั้งเพื่อยืนยัน: ");
  if (password !== again) throw new Error("รหัสผ่านสองครั้งไม่ตรงกัน");

  return password;
}

const ROLES: UserRole[] = ["VIEWER", "ANALYST", "ADMIN"];

async function create(rawUsername: string, rawRole = "VIEWER"): Promise<void> {
  const username = normalizeUsername(rawUsername);
  const check = checkUsername(username);
  if (!check.ok) throw new Error(check.message);

  const role = rawRole.toUpperCase() as UserRole;
  if (!ROLES.includes(role)) {
    throw new Error(`role ต้องเป็นหนึ่งใน ${ROLES.join(", ")}`);
  }

  const existing = await prisma.userProfile.findUnique({ where: { username } });
  if (existing) throw new Error(`มีผู้ใช้ "${username}" อยู่แล้ว`);

  const password = await readNewPassword();

  await prisma.userProfile.create({
    data: { username, passwordHash: await hashPassword(password), role },
  });

  console.log(`สร้างผู้ใช้ "${username}" สิทธิ์ ${role} เรียบร้อย`);
}

async function passwd(rawUsername: string): Promise<void> {
  const username = normalizeUsername(rawUsername);
  const user = await prisma.userProfile.findUnique({ where: { username } });
  if (!user) throw new Error(`ไม่พบผู้ใช้ "${username}"`);

  const password = await readNewPassword();

  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  // Changing a password has to end every existing session, or one that was
  // stolen keeps working after the password it came from is gone.
  const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`เปลี่ยนรหัสผ่านของ "${username}" แล้ว และปิด session ที่ค้างอยู่ ${count} รายการ`);
}

async function list(): Promise<void> {
  const users = await prisma.userProfile.findMany({
    orderBy: { username: "asc" },
    select: {
      username: true,
      role: true,
      isActive: true,
      lockedUntil: true,
      lastLoginAt: true,
      _count: { select: { sessions: true } },
    },
  });

  if (users.length === 0) {
    console.log("ยังไม่มีผู้ใช้ สร้างคนแรกด้วย: npm run user create <username> ADMIN");
    return;
  }

  console.table(
    users.map((u) => ({
      username: u.username,
      role: u.role,
      status: !u.isActive
        ? "ปิดใช้งาน"
        : u.lockedUntil && u.lockedUntil > new Date()
          ? "ถูกล็อกชั่วคราว"
          : "ใช้งานได้",
      sessions: u._count.sessions,
      lastLogin: u.lastLoginAt?.toISOString().slice(0, 16).replace("T", " ") ?? "ยังไม่เคย",
    })),
  );
}

async function setActive(rawUsername: string, isActive: boolean): Promise<void> {
  const username = normalizeUsername(rawUsername);
  const user = await prisma.userProfile.findUnique({ where: { username } });
  if (!user) throw new Error(`ไม่พบผู้ใช้ "${username}"`);

  await prisma.userProfile.update({ where: { id: user.id }, data: { isActive } });
  if (!isActive) await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`${isActive ? "เปิด" : "ปิด"}ใช้งานบัญชี "${username}" แล้ว`);
}

async function unlock(rawUsername: string): Promise<void> {
  const username = normalizeUsername(rawUsername);
  const user = await prisma.userProfile.findUnique({ where: { username } });
  if (!user) throw new Error(`ไม่พบผู้ใช้ "${username}"`);

  await prisma.userProfile.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  console.log(`ปลดล็อก "${username}" แล้ว`);
}

const USAGE = `
คำสั่งจัดการผู้ใช้

  npm run user create <username> [VIEWER|ANALYST|ADMIN]
  npm run user passwd <username>
  npm run user list
  npm run user disable <username>
  npm run user enable <username>
  npm run user unlock <username>

ผู้ใช้คนแรกต้องสร้างที่นี่ และควรเป็น ADMIN
  npm run user create napat ADMIN
`;

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const requireName = () => {
    if (!args[0]) throw new Error("ระบุชื่อผู้ใช้ด้วย");
    return args[0];
  };

  switch (command) {
    case "create":
      return create(requireName(), args[1]);
    case "passwd":
      return passwd(requireName());
    case "list":
      return list();
    case "disable":
      return setActive(requireName(), false);
    case "enable":
      return setActive(requireName(), true);
    case "unlock":
      return unlock(requireName());
    default:
      console.log(USAGE);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
