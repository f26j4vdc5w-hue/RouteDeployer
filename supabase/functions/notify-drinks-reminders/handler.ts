import { reminderDate } from './schedule.ts';

export type PushSubscription = { endpoint: string; p256dh: string; auth: string };

export async function handleReminderRequest(
  request: Request,
  options: { secret: string | undefined; now: Date; run: (date: string) => Promise<number>; log: (message: string) => void },
): Promise<Response> {
  if (!options.secret || request.headers.get('x-reminder-secret') !== options.secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const date = reminderDate(options.now);
  if (!date) return new Response('Outside reminder window');
  try {
    const failures = await options.run(date);
    return new Response(failures ? `Delivery failures: ${failures}` : 'OK', { status: failures ? 500 : 200 });
  } catch (cause) {
    options.log(cause instanceof Error ? cause.message : 'Reminder dispatch failed');
    return new Response('Reminder dispatch failed', { status: 500 });
  }
}

export async function deliverReminders(
  date: string,
  options: {
    claim: (date: string) => Promise<PushSubscription[]>;
    send: (subscription: PushSubscription) => Promise<void>;
    remove: (endpoint: string) => Promise<void>;
    log: (message: string) => void;
  },
): Promise<number> {
  const subscriptions = await options.claim(date);
  let failures = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await options.send(subscription);
    } catch (cause) {
      const status = cause && typeof cause === 'object' && 'statusCode' in cause ? cause.statusCode : undefined;
      if (status === 404 || status === 410) {
        try {
          await options.remove(subscription.endpoint);
          return;
        } catch {
          options.log('Could not remove expired subscription');
        }
      } else {
        options.log(`Reminder delivery failed: ${typeof status === 'number' ? status : 'unknown error'}`);
      }
      failures++;
    }
  }));
  return failures;
}
