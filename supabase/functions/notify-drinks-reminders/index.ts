import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { deliverReminders, handleReminderRequest } from './handler.ts';

Deno.serve(async (request) => {
  return handleReminderRequest(request, {
    secret: Deno.env.get('DRINKS_REMINDER_SECRET'),
    now: new Date(),
    log: (message) => console.error(message),
    run: async (date) => {
      const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      const subject = Deno.env.get('VAPID_SUBJECT');
      const url = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!publicKey || !privateKey || !subject || !url || !serviceKey) {
        throw new Error('Missing reminder configuration');
      }
      webpush.setVapidDetails(subject, publicKey, privateKey);
      const client = createClient(url, serviceKey);
      return deliverReminders(date, {
        claim: async (day) => {
          const { data, error } = await client.rpc('claim_drinks_reminders', { p_date: day });
          if (error) throw new Error('Could not claim reminders');
          return data ?? [];
        },
        send: async (subscription) => {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            JSON.stringify({ title: 'Getränkekasse', body: 'Denk daran, deine Getränke einzutragen.', url: 'getraenke/' }),
            { ttl: 3600 },
          );
        },
        remove: async (endpoint) => {
          const { error } = await client.from('drinks_push_subscriptions').delete().eq('endpoint', endpoint);
          if (error) throw new Error('Could not remove expired subscription');
        },
        log: (message) => console.error(message),
      });
    },
  });
});
