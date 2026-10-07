// npm run seed                  -> create default departments (if empty) and the first staff account (if none)
// npm run seed -- --reset-admin -> set the staff password from ADMIN_USERNAME / ADMIN_PASSWORD in .env
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { Department } from './models/Department.js';
import { Admin } from './models/Admin.js';
import { bootstrap } from './bootstrap.js';

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
await Promise.all([Department.init(), Admin.init()]);
await bootstrap({ resetAdminPassword: process.argv.includes('--reset-admin') });
await mongoose.disconnect();
