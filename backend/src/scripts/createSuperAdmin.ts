import { emitKeypressEvents } from 'readline';
import { Types } from 'mongoose';
import { connectDB, disconnectDB } from '../config/db';
import { University } from '../models/University';
import { User } from '../models/User';
import { UserRole } from '../types/enums';

interface Arguments {
  email: string;
  name: string;
  universityId: string;
}

function parseArguments(args: string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(
        'Usage: npm run super-admin:create -- --name "Admin" --email admin@college.edu --university-id <id>'
      );
    }
    values.set(key, value);
  }

  const name = values.get('--name')?.trim();
  const email = values.get('--email')?.trim().toLowerCase();
  const universityId = values.get('--university-id')?.trim();
  if (!name || !email || !universityId || values.size !== 3) {
    throw new Error(
      'Usage: npm run super-admin:create -- --name "Admin" --email admin@college.edu --university-id <id>'
    );
  }
  if (!Types.ObjectId.isValid(universityId) || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Provide a valid university ID and email address');
  }
  return { name, email, universityId };
}

function readHiddenPassword(label: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) throw new Error('A terminal is required to enter the password securely');
  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();
  process.stdout.write(label);

  return new Promise((resolve, reject) => {
    let password = '';
    const cleanup = () => {
      input.removeListener('keypress', onKeypress);
      input.setRawMode(wasRaw);
      process.stdout.write('\n');
    };
    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Password entry cancelled'));
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(password);
      } else if (key.name === 'backspace') {
        password = password.slice(0, -1);
      } else if (character && !key.ctrl && character >= ' ') {
        password += character;
      }
    };
    input.on('keypress', onKeypress);
  });
}

async function main(): Promise<void> {
  const input = parseArguments(process.argv.slice(2));
  const domain = input.email.split('@')[1]?.toLowerCase();
  await connectDB();
  try {
    const university = await University.findOne({
      _id: input.universityId,
      emailDomain: domain,
      isActive: true,
    });
    if (!university) {
      throw new Error('University must be active and its email domain must match the admin address');
    }
    if (
      await User.exists({
        university: university._id,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      })
    ) {
      throw new Error('An active super-admin already exists for this university');
    }
    if (await User.exists({ email: input.email })) {
      throw new Error('An account with this email already exists');
    }

    const password = await readHiddenPassword('Set super-admin password: ');
    const confirmation = await readHiddenPassword('Confirm password: ');
    if (password !== confirmation) throw new Error('Passwords do not match');
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('Password must contain at least 8 characters and at most 72 UTF-8 bytes');
    }

    await User.create({
      name: input.name,
      email: input.email,
      password,
      role: UserRole.SUPER_ADMIN,
      university: university._id,
      isEmailVerified: true,
      isActive: true,
    });
    console.log(`[Admin] Super-admin account created for ${input.email}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  console.error('[Admin] Could not create super-admin:', error);
  process.exitCode = 1;
});
