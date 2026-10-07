import bcrypt from 'bcryptjs';
import { env } from './config/env.js';
import { Department } from './models/Department.js';
import { Admin } from './models/Admin.js';

// The 15 departments of the original prototype (fee in rupees, dailyCap = tokens per day).
const DEPARTMENTS = [
  ['General Medicine', 'GM', '101', 'Available', '9:00 AM - 1:00 PM', 10, 40],
  ['Cardiology', 'CD', '204', 'Available', '9:00 AM - 1:00 PM', 20, 50],
  ['Neurology', 'NE', '207', 'Busy', '10:00 AM - 2:00 PM', 20, 60],
  ['Orthopedics', 'OR', '112', 'Available', '10:00 AM - 2:00 PM', 15, 70],
  ['Pediatrics', 'PE', '105', 'Busy', '9:00 AM - 2:00 PM', 10, 40],
  ['Dermatology', 'DE', '118', 'Busy', '10:00 AM - 3:00 PM', 15, 50],
  ['ENT', 'EN', '121', 'Available', '9:00 AM - 1:00 PM', 15, 60],
  ['Gynecology', 'GY', '130', 'Available', '9:00 AM - 2:00 PM', 15, 70],
  ['Ophthalmology', 'OP', '124', 'Available', '10:00 AM - 2:00 PM', 15, 40],
  ['Dental', 'DN', '128', 'Busy', '9:00 AM - 1:00 PM', 15, 50],
  ['Emergency', 'EM', 'G-01', 'Available', '24 hours', 0, 20],
  ['Radiology', 'RA', '010', 'Available', '9:00 AM - 4:00 PM', 50, 70],
  ['Pathology', 'PA', '012', 'Available', '8:00 AM - 2:00 PM', 30, 40],
  ['Surgery', 'SU', '301', 'Busy', '10:00 AM - 2:00 PM', 20, 50],
  ['Physiotherapy', 'PH', '015', 'Available', '9:00 AM - 3:00 PM', 20, 60],
].map(([name, code, room, status, timing, fee, dailyCap]) => ({ name, code, room, status, timing, fee, dailyCap }));

export async function bootstrap({ resetAdminPassword = false } = {}) {
  if (env.AUTO_SEED && (await Department.estimatedDocumentCount()) === 0) {
    await Department.insertMany(DEPARTMENTS, { ordered: true });
    console.log(`Seeded ${DEPARTMENTS.length} departments`);
  }

  const hasAdmin = (await Admin.estimatedDocumentCount()) > 0;
  const pwOk = env.ADMIN_PASSWORD.length >= 8;
  if (!hasAdmin || resetAdminPassword) {
    if (!pwOk) {
      console.warn('No staff account yet. Set ADMIN_USERNAME and ADMIN_PASSWORD (8+ characters) in server/.env, then restart.');
      return;
    }
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await Admin.findOneAndUpdate(
      { username: env.ADMIN_USERNAME },
      { $set: { passwordHash, name: env.ADMIN_NAME } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Staff account ready: "${env.ADMIN_USERNAME}"${resetAdminPassword ? ' (password reset)' : ''}`);
  }
}
