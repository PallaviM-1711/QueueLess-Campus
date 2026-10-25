import { connectDB, disconnectDB } from '../config/db';
import { University } from '../models/University';

function parseArguments(args: string[]): { name: string; emailDomain: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error('Usage: npm run university:create -- --name "University" --email-domain example.edu');
    }
    values.set(key, value);
  }

  const name = values.get('--name')?.trim();
  const emailDomain = values.get('--email-domain')?.trim().toLowerCase();
  if (!name || !emailDomain || values.size !== 2) {
    throw new Error('Usage: npm run university:create -- --name "University" --email-domain example.edu');
  }
  return { name, emailDomain };
}

async function main(): Promise<void> {
  const input = parseArguments(process.argv.slice(2));
  await connectDB();
  try {
    const university = await University.create(input);
    console.log(`[University] Created ${university.name} (${university.emailDomain})`);
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  console.error('[University] Could not create record:', error);
  process.exitCode = 1;
});
