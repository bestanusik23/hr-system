// node scripts/gen_seed_users.js
// Generates PBKDF2-SHA256 hashes for seed users using Node's crypto module.
// Run once, paste the output SQL into D1 Console.

import { webcrypto } from "crypto";
const crypto = webcrypto;

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100_000 },
    key, 256,
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
}

const users = [
  { username: "hr01",      password: "HR@2026!",      full_name: "เจ้าหน้าที่ HR",                    role: "hr",       role_title: "เจ้าหน้าที่ทรัพยากรบุคคล", color: "#0038C6", initial: "HR" },
  { username: "head01",    password: "Head@2026!",    full_name: "หัวหน้าแผนกเภสัชกรรม",              role: "head",     role_title: "หัวหน้าแผนก",               color: "#16A34A", initial: "HD" },
  { username: "deputy01",  password: "Deputy@2026!",  full_name: "รองผอ.ฝ่ายเทคนิคบริการ",            role: "deputy",   role_title: "รองผู้อำนวยการ",            color: "#7C3AED", initial: "DP" },
  { username: "deputyhr",  password: "DepHR@2026!",   full_name: "รองผอ.ฝ่ายบริหารค่าตอบแทนฯ",       role: "deputyHR", role_title: "รองผู้อำนวยการ (HR)",       color: "#E0533D", initial: "DH" },
  { username: "admin",     password: "Admin@2026!",   full_name: "ผู้ดูแลระบบ",                       role: "admin",    role_title: "Administrator",              color: "#0891B2", initial: "AD" },
];

const lines = ["-- Seed users (run in D1 Console after 0002_seed.sql)"];
for (const u of users) {
  const salt = randomSalt();
  const hash = await hashPassword(u.password, salt);
  lines.push(
    `INSERT INTO users (username, password_hash, password_salt, full_name, role, role_title, color, initial) VALUES ('${u.username}','${hash}','${salt}','${u.full_name}','${u.role}','${u.role_title}','${u.color}','${u.initial}');`
  );
}
console.log(lines.join("\n"));
console.log("\n-- Default passwords (change after first login):");
for (const u of users) console.log(`--  ${u.username}: ${u.password}`);
