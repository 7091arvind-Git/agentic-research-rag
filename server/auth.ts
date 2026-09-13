import crypto from "crypto";
import { User } from "./types";

interface StoredUser extends User {
  passwordHash: string;
  salt: string;
}

// In-memory persistent database for users & sessions
const users: Map<string, StoredUser> = new Map();
const sessions: Map<string, string> = new Map(); // token -> userId

function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

// Initialize with a demo student user for instant evaluation
const demoSalt = "demo-salt-college-project";
const demoUser: StoredUser = {
  id: "usr_demo_1",
  name: "Alex Turner",
  email: "demo@college.edu",
  createdAt: new Date().toISOString(),
  salt: demoSalt,
  passwordHash: hashPassword("demo123", demoSalt),
};
users.set(demoUser.email.toLowerCase(), demoUser);

export function registerUser(name: string, email: string, password: string): { user: User; token: string } {
  const normalizedEmail = email.trim().toLowerCase();
  if (users.has(normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }
  if (!name || name.trim().length < 2) {
    throw new Error("Name must be at least 2 characters.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const id = "usr_" + crypto.randomBytes(8).toString("hex");

  const newUser: StoredUser = {
    id,
    name: name.trim(),
    email: normalizedEmail,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash,
  };

  users.set(normalizedEmail, newUser);

  const token = "tok_" + crypto.randomBytes(24).toString("hex");
  sessions.set(token, newUser.id);

  return {
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      createdAt: newUser.createdAt,
    },
    token,
  };
}

export function loginUser(email: string, password: string): { user: User; token: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.get(normalizedEmail);
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const calculatedHash = hashPassword(password, user.salt);
  if (calculatedHash !== user.passwordHash) {
    throw new Error("Invalid email or password.");
  }

  const token = "tok_" + crypto.randomBytes(24).toString("hex");
  sessions.set(token, user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    token,
  };
}

export function getUserFromToken(token: string): User | null {
  if (!token) return null;
  const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
  const userId = sessions.get(cleanToken);
  if (!userId) return null;

  for (const u of users.values()) {
    if (u.id === userId) {
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
      };
    }
  }
  return null;
}

export function logoutUser(token: string): void {
  const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
  sessions.delete(cleanToken);
}
