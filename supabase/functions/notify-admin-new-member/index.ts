// Wird von einem Database Webhook auf public.community_members (INSERT und UPDATE) aufgerufen.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Member = {
  display_name: string;
  status: string;
  email_confirmed_at: string | null;
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Member | null;
  old_record: Member | null;
};

Deno.serve(async (request) => {
  if (request.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  const member = payload.record;
  // Freigabe ist erst nach bestätigter E-Mail möglich: genau dann benachrichtigen.
  const becameReviewable =
    member?.status === 'pending' &&
    member.email_confirmed_at &&
    !(payload.type === 'UPDATE' && payload.old_record?.email_confirmed_at);
  if (!member || !becameReviewable) {
    return new Response('Ignored');
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: subscriptions, error } = await supabase
    .from('admin_push_subscriptions')
    .select('endpoint, p256dh, auth');
  if (error) return new Response(error.message, { status: 500 });

  const message = JSON.stringify({
    title: 'Neue Community-Anfrage',
    body: `${member.display_name} wartet auf Freigabe.`,
    url: 'admin/',
  });
  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          message,
        );
      } catch (cause) {
        const statusCode = (cause as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabase
            .from('admin_push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
          if (deleteError) throw deleteError;
        } else {
          throw cause;
        }
      }
    }),
  );
  return new Response('OK');
});
