/**
 * One-time admin bootstrap.
 * Usage (on server with env set):
 *   node scripts/create-admin.js
 *
 * Requires: MONGO_URI, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { resolveMongoUri } from "../intelligence/config/mongoUri.js";

dotenv.config();

const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || "").toLowerCase().trim();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";

if (!process.env.MONGO_URI || !email || !password) {
  console.error(
    "Set MONGO_URI, ADMIN_BOOTSTRAP_EMAIL, and ADMIN_BOOTSTRAP_PASSWORD first."
  );
  process.exit(1);
}

if (password.length < 10) {
  console.error("ADMIN_BOOTSTRAP_PASSWORD must be at least 10 characters.");
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: "user" },
    subscription: { type: String, default: "enterprise" },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

async function main() {
  const mongoUri = await resolveMongoUri(process.env.MONGO_URI);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 20_000,
    family: 4,
  });
  const hashed = await bcrypt.hash(password, 12);

  const user = await User.findOneAndUpdate(
    { email },
    {
      name: "CarbonAxis Admin",
      email,
      password: hashed,
      role: "admin",
      subscription: "enterprise",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Admin ready:", user.email, "| role:", user.role);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
