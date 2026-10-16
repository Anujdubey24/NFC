
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from './database/connection.js';
import { Organization } from './modules/organizations/organization.model.js';
import { User } from './modules/users/user.model.js';
import { hashPassword } from './modules/auth/auth.tokens.js';
import { NFCBand } from './modules/bands/band.model.js';
import { AccessRule } from './modules/access/access.models.js';
import { NFCDevice } from './modules/devices/device.model.js';
import {
  Gate,
  Location,
  Zone,
} from './modules/locations/location.models.js';

export async function seedDatabase(silent = false): Promise<void> {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error('No active MongoDB database connection.');
  }

  console.log('Connected database:', db.databaseName);
  console.log('MongoDB host:', mongoose.connection.host);

  const org = await Organization.findOneAndUpdate(
    { slug: 'gmail' },
    {
      $setOnInsert: {
        name: 'gmail',
        slug: 'gmail',
        status: 'ACTIVE',
        contactEmail: 'ops@gmail.com',
      },
    },
    { upsert: true, new: true },
  );

  const orgId = org._id as mongoose.Types.ObjectId;
  const passwordHash = await hashPassword('anuj@2416');

  const staff = [
    { email: 'admin@gmail.com', firstName: 'Anuj', lastName: 'Dubey', role: 'ADMIN' },
    { email: 'manager@gmail.com', firstName: 'Akash', lastName: 'Nayak', role: 'MANAGER' },
    { email: 'operator@gmail.com', firstName: 'Jatin', lastName: 'kadam', role: 'OPERATOR' },
    { email: 'security@gmail.com', firstName: 'Rohit', lastName: 'Singh Thakur', role: 'SECURITY' },
    { email: 'finance@gmail.com', firstName: 'Yogendra', lastName: 'Dewada', role: 'FINANCE' },
  ];

  const users: Record<string, mongoose.Types.ObjectId> = {};

  for (const s of staff) {
    const user = await User.findOneAndUpdate(
      { organizationId: orgId, email: s.email },
      {
        $setOnInsert: {
          ...s,
          organizationId: orgId,
          passwordHash,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );

    users[s.role] = user._id as mongoose.Types.ObjectId;
  }

  const students = [
    { email: 'anuj@gmail.com', firstName: 'Anuj', lastName: 'Dubey' },
    { email: 'akash@gmail.com', firstName: 'Akash', lastName: 'Nayak' },
    { email: 'jatin@gmail.com', firstName: 'Jatin', lastName: 'Kadam' },
  ];

  const studentIds: mongoose.Types.ObjectId[] = [];

  for (const s of students) {
    const user = await User.findOneAndUpdate(
      { organizationId: orgId, email: s.email },
      {
        $setOnInsert: {
          ...s,
          organizationId: orgId,
          passwordHash,
          role: 'VIEWER',
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true },
    );

    studentIds.push(user._id as mongoose.Types.ObjectId);
  }

  const loc = await Location.findOneAndUpdate(
    { organizationId: orgId, code: 'MAIN' },
    {
      $setOnInsert: {
        organizationId: orgId,
        name: 'Main Campus',
        code: 'MAIN',
        type: 'CAMPUS',
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true },
  );

  const zone = await Zone.findOneAndUpdate(
    { organizationId: orgId, locationId: loc._id, code: 'NORTH' },
    {
      $setOnInsert: {
        organizationId: orgId,
        locationId: loc._id,
        name: 'North Wing',
        code: 'NORTH',
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true },
  );

  const gate = await Gate.findOneAndUpdate(
    { organizationId: orgId, locationId: loc._id, code: 'GATE-1' },
    {
      $setOnInsert: {
        organizationId: orgId,
        locationId: loc._id,
        zoneId: zone._id,
        name: 'Main Gate',
        code: 'GATE-1',
        direction: 'BIDIRECTIONAL',
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true },
  );

  await NFCDevice.findOneAndUpdate(
    { organizationId: orgId, deviceId: 'DEV-MAIN-GATE-01' },
    {
      $setOnInsert: {
        organizationId: orgId,
        deviceId: 'DEV-MAIN-GATE-01',
        name: 'Main Gate Kiosk',
        type: 'KIOSK',
        locationId: loc._id,
        gateId: gate._id,
        status: 'ONLINE',
        adapterType: 'keyboard',
      },
    },
    { upsert: true },
  );

  await AccessRule.findOneAndUpdate(
    { organizationId: orgId, name: 'Main gate open hours' },
    {
      $setOnInsert: {
        organizationId: orgId,
        name: 'Main gate open hours',
        gateId: gate._id,
        locationId: loc._id,
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        startTime: '06:00',
        endTime: '22:00',
        bandStatuses: ['ACTIVE'],
        effect: 'ALLOW',
        priority: 100,
        status: 'ACTIVE',
      },
    },
    { upsert: true },
  );

  const bands = [
    { bandId: 'NF-4821', nfcUid: '04:A3:F1:9C:2B:80', userIdx: 0, status: 'ACTIVE' },
    { bandId: 'NF-4822', nfcUid: '04:77:1D:4E:5A:81', userIdx: 1, status: 'ACTIVE' },
    { bandId: 'NF-4823', nfcUid: '04:C9:02:77:1F:80', userIdx: undefined, status: 'AVAILABLE' },
    { bandId: 'NF-4824', nfcUid: '04:DE:AD:BE:EF:00', userIdx: 2, status: 'BLOCKED' },
  ];

  for (const b of bands) {
    await NFCBand.findOneAndUpdate(
      { nfcUid: b.nfcUid },
      {
        $setOnInsert: {
          organizationId: orgId,
          bandId: b.bandId,
          nfcUid: b.nfcUid,
          type: 'STUDENT',
          status: b.status,
          userId: b.userIdx !== undefined ? studentIds[b.userIdx] : undefined,
          issuedAt: b.userIdx !== undefined ? new Date() : undefined,
          activatedAt: b.status === 'ACTIVE' ? new Date() : undefined,
          blockedAt: b.status === 'BLOCKED' ? new Date() : undefined,
          blockedReason:
            b.status === 'BLOCKED'
              ? 'Seeded demo: reported lost, under review'
              : undefined,
          assignedLocationId: loc._id,
          createdBy: users.ADMIN,
        },
      },
      { upsert: true },
    );
  }

  // Verify records after seeding.
  const counts = {
    organizations: await Organization.countDocuments({ slug: 'gmail' }),
    users: await User.countDocuments({ organizationId: orgId }),
    bands: await NFCBand.countDocuments({ organizationId: orgId }),
    locations: await Location.countDocuments({ organizationId: orgId }),
    zones: await Zone.countDocuments({ organizationId: orgId }),
    gates: await Gate.countDocuments({ organizationId: orgId }),
    devices: await NFCDevice.countDocuments({ organizationId: orgId }),
    accessRules: await AccessRule.countDocuments({ organizationId: orgId }),
  };

  console.log('Seed verification:', counts);

  const admin = await User.findOne(
    { organizationId: orgId, email: 'admin@gmail.com' },
    { email: 1, role: 1, status: 1 },
  ).lean();

  console.log('Admin account exists:', Boolean(admin));

  if (!silent) {
    console.log('Seeding completed for organization:', org.slug);
  }
}

// Direct execution: connect, seed, verify, and disconnect.
// This script deliberately does not provide a database-wipe option.
const scriptPath = process.argv[1]?.replace(/\\/g, '/');
const isDirectRun =
  scriptPath?.endsWith('/seed.ts') ||
  scriptPath?.endsWith('/seed.js') ||
  scriptPath === 'seed.ts' ||
  scriptPath === 'seed.js';

if (isDirectRun) {
  connectDb()
    .then(() => seedDatabase())
    .then(async () => {
      await disconnectDb();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Seeding failed:', error);
      try {
        await disconnectDb();
      } catch (disconnectError) {
        console.error('Database disconnect failed:', disconnectError);
      }
      process.exit(1);
    });
}
