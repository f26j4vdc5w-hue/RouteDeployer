import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CommunityAccount } from '../community/CommunityAccount';
import { COMMUNITY_AUTH_RETURN_TO_KEY, COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY, useCommunityAuth } from '../community/useCommunityAuth';
import { requireSupabase, supabase } from '../../lib/supabase';
import { DrinksPushToggle } from './DrinksPushToggle';
import { readAllPages } from './readAllPages';
import '../admin/admin.css';
import './drinks.css';

type Settings = { opened_at: string; payment_hint: string; revision: number };
type Price = { valid_from: string; cents: number };
type Entry = { id: number; user_id: string; display_name: string; drink_date: string; quantity: number; price_cents: number; period_id: number | null };
type Period = { id: number; opened_at: string; closed_at: string; payment_hint: string };
type Bill = { id: number; period_id: number; user_id: string; display_name: string; quantity: number; total_cents: number; payment_status: 'open' | 'reported' | 'confirmed' };
type Snapshot = { settings: Settings; prices: Price[]; entries: Entry[]; periods: Period[]; bills: Bill[]; treasurers: string[] };

const money = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const berlinDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateTime = (value: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
const errorText = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Ein unbekannter Fehler ist aufgetreten.';

export default function DrinksApp() {
  const community = useCommunityAuth();
  const userId = community.session?.user.id;
  const isAdmin = community.session?.user.app_metadata.role === 'admin';
  const approved = community.authReady && community.member?.user_id === userId &&
    community.member?.status === 'approved' && Boolean(community.member.email_confirmed_at);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [priceInput, setPriceInput] = useState('');
  const [hint, setHint] = useState('');
  const [requestId, setRequestId] = useState<string>(() => crypto.randomUUID());

  useEffect(() => {
    if (!community.session) return;
    setRequestId(crypto.randomUUID());
    const returnTo = sessionStorage.getItem(COMMUNITY_AUTH_RETURN_TO_KEY);
    if (!returnTo?.startsWith('/') || returnTo.startsWith('//')) return;
    const target = new URL(returnTo, window.location.origin);
    if (target.origin === window.location.origin &&
        target.pathname.replace(/\/+$/, '') === `${import.meta.env.BASE_URL}getraenke`.replace(/\/+$/, '')) {
      sessionStorage.removeItem(COMMUNITY_AUTH_RETURN_TO_KEY);
      sessionStorage.removeItem(COMMUNITY_AUTH_RETURN_TO_SAVED_AT_KEY);
    }
  }, [community.session]);

  const load = useCallback(async () => {
    if (!approved) { setSnapshot(null); return; }
    const client = requireSupabase();
    const currentRequestId = requestId;
    const first = await client.from('drinks_settings').select('*').single();
    if (first.error) throw first.error;
    if (currentRequestId !== requestId) return;
    async function allRows<T>(table: string, columns: string, order: string, ascending = true, approvedMembers = false): Promise<T[]> {
      return readAllPages(async (from, to) => {
        let query = client.from(table).select(columns, { count: 'exact' }).order(order, { ascending }).range(from, to);
        if (approvedMembers) query = query.eq('status', 'approved').not('email_confirmed_at', 'is', null);
        const { data, error: queryError, count } = await query;
        if (queryError) throw queryError;
        return { data: data as T[] | null, count };
      });
    }
    const [prices, entries, periods, bills, treasurers] = await Promise.all([
      allRows<Price>('drinks_prices', '*', 'valid_from', false),
      allRows<Entry>('drinks_entries', '*', 'id', false),
      allRows<Period>('drinks_periods', '*', 'id', false),
      allRows<Bill>('drinks_bills', '*', 'id', false),
      allRows<{ user_id: string }>('drinks_treasurers', 'user_id', 'user_id'),
    ]);
    if (currentRequestId !== requestId) return;
    const last = await client.from('drinks_settings').select('*').single();
    if (last.error) throw last.error;
    if (first.data.revision !== last.data.revision) throw new Error('Die Daten haben sich geändert. Bitte erneut laden.');
    if (currentRequestId !== requestId) return;
    setHint(last.data.payment_hint);
    setSnapshot({
      settings: last.data as Settings,
      prices, entries, periods, bills,
      treasurers: treasurers.map((item) => item.user_id),
    });
  }, [approved, requestId]);

  useEffect(() => {
    let active = true;
    void load().catch((cause: unknown) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [load]);

  async function action(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await requireSupabase().rpc(name, args);
      if (rpcError) throw rpcError;
      await load();
    } catch (cause) {
      setError(errorText(cause));
      try { await load(); } catch (refreshError) {
        setError(`${errorText(cause)} Aktualisierung fehlgeschlagen: ${errorText(refreshError)}`);
      }
    } finally { setBusy(false); }
  }

  const treasurer = Boolean(userId && snapshot?.treasurers.includes(userId));
  const openEntries = snapshot?.entries.filter((entry) => entry.period_id === null) ?? [];
  const selectedPrice = snapshot?.prices.find((price) => price.valid_from <= berlinDate());

  function add(event: FormEvent) {
    event.preventDefault();
    void action('add_drinks_entry', { p_date: berlinDate(), p_quantity: quantity });
    setQuantity(1);
  }

  return (
    <main className="admin-shell drinks">
      <div className="admin-dashboard">
        <header className="admin-header">
          <div><p className="admin-kicker">KLLKTV Community</p><h1>Getränkekasse</h1></div>
          <a className="admin-link" href={import.meta.env.BASE_URL}>Zum Roadbook</a>
          <CommunityAccount email={community.session?.user.email ?? null} member={community.member} isAdmin={isAdmin} loading={community.loading} error={community.error} onRefresh={community.refresh} />
        </header>
        {!supabase ? <section className="admin-card" role="alert">Die Getränkekasse ist nicht verfügbar: Supabase ist nicht konfiguriert.</section> : !community.authReady ? <p>Mitgliedschaft wird geladen …</p> : !approved ? (
          <section className="admin-card"><h2>Nur für freigegebene Mitglieder</h2><p>Bitte melde dich mit einem freigegebenen Community-Konto an.</p></section>
        ) : null}
        {error && <p className="admin-error" role="alert">{error} <button type="button" onClick={() => void load().then(() => setError(null)).catch((cause: unknown) => setError(errorText(cause)))}>Erneut laden</button></p>}
        {approved && !snapshot && !error && <p role="status">Getränkekasse wird geladen …</p>}
        {snapshot && approved && <>
          <p>Alle freigegebenen Mitglieder können Getränkemengen, Beträge und Zahlungsstatus sehen.</p>
          <section className="admin-card">
            <h2>Getränke eintragen</h2>
            <p>Offener Zeitraum seit {dateTime(snapshot.settings.opened_at)} Uhr.</p>
            <form className="admin-form" onSubmit={add}>
              <div className="admin-drinks-counter">
                <button type="button" className="admin-drinks-button" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={busy || quantity <= 1}>−</button>
                <span className="admin-drinks-value">{quantity}</span>
                <button type="button" className="admin-drinks-button" onClick={() => setQuantity(Math.min(10000, quantity + 1))} disabled={busy || quantity >= 10000}>+</button>
              </div>
              <p>{selectedPrice ? `${money(selectedPrice.cents)} pro Getränk · ${money(selectedPrice.cents * quantity)} gesamt` : 'Kein Preis für diesen Tag verfügbar.'}</p>
              <button className="admin-button" disabled={busy || !selectedPrice}>Eintragen</button>
            </form>
          </section>
          <section className="admin-card">
            <h2>Offene Strichliste</h2>
            {openEntries.length === 0 ? <p>Noch keine Einträge.</p> : <div className="admin-member-list">{openEntries.map((entry) => (
              <div className="admin-member" key={entry.id}>
                <div><strong>{entry.display_name}</strong><span>{entry.drink_date} · {entry.quantity} × {money(entry.price_cents)} = {money(entry.quantity * entry.price_cents)}</span></div>
                {entry.user_id === userId && <div className="admin-actions">
                  <button className="admin-button" disabled={busy} onClick={() => {
                    const value = window.prompt('Neue Anzahl', String(entry.quantity));
                    if (value !== null && /^[1-9]\d*$/.test(value)) void action('change_drinks_entry', { p_id: entry.id, p_quantity: Number(value) });
                    else if (value !== null) setError('Bitte eine positive ganze Anzahl eingeben.');
                  }}>Ändern</button>
                  <button className="admin-button" disabled={busy} onClick={() => { if (window.confirm('Eintrag wirklich löschen?')) void action('delete_drinks_entry', { p_id: entry.id }); }}>Löschen</button>
                </div>}
              </div>
            ))}</div>}
          </section>
          {treasurer && <section className="admin-card">
            <h2>Kassenwart</h2>
            {snapshot.prices.filter((price) => price.valid_from > berlinDate()).map((price) => <p key={price.valid_from}>Preis ab {price.valid_from}: {money(price.cents)}</p>)}
            <p>Abschlussvorschau: {openEntries.reduce((sum, entry) => sum + entry.quantity, 0)} Getränke · {money(openEntries.reduce((sum, entry) => sum + entry.quantity * entry.price_cents, 0))}</p>
            <button className="admin-button" disabled={busy || openEntries.length === 0} onClick={() => {
              const lines = [...new Set(openEntries.map((entry) => entry.user_id))].map((id) => {
                const items = openEntries.filter((entry) => entry.user_id === id);
                return `${items[0].display_name}: ${items.reduce((sum, entry) => sum + entry.quantity, 0)} Getränke, ${money(items.reduce((sum, entry) => sum + entry.quantity * entry.price_cents, 0))}`;
              });
              if (window.confirm(`Endgültig abschließen? Einträge und Beträge können danach nicht korrigiert werden.\n\n${lines.join('\n')}`)) void action('close_drinks_period', { p_revision: snapshot.settings.revision });
            }}>Zeitraum endgültig abschließen</button>
            <form className="admin-form" onSubmit={(event) => {
              event.preventDefault();
              const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(priceInput.trim());
              if (!match) { setError('Bitte einen gültigen Preis in Euro mit höchstens zwei Nachkommastellen eingeben.'); return; }
              const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
              if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1000000) { setError('Bitte einen gültigen Preis eingeben.'); return; }
              void action('set_drinks_price', { p_cents: cents });
            }}>
              <label>Neuer Preis in Euro ab morgen <input value={priceInput} onChange={(event) => setPriceInput(event.target.value)} inputMode="decimal" required /></label>
              <button className="admin-button" disabled={busy}>Preis speichern</button>
            </form>
            <form className="admin-form" onSubmit={(event) => { event.preventDefault(); void action('set_drinks_payment_hint', { p_hint: hint }); }}>
              <label>Zahlungshinweis <textarea value={hint} onChange={(event) => setHint(event.target.value)} placeholder="Zahlungshinweis eingeben" maxLength={2000} /></label>
              <button className="admin-button" disabled={busy}>Zahlungshinweis speichern</button>
            </form>
          </section>}
          <section className="admin-card">
            <h2>Dienstagserinnerung</h2>
            <p>Mit aktivierter Erinnerung erhältst du dienstags um 21 Uhr eine Mitteilung, wenn du für eine Tour zugesagt und für diesen Tag noch keine Getränke eingetragen hast.</p>
            {userId && <DrinksPushToggle userId={userId} />}
          </section>
          <section className="admin-card">
            <h2>Abrechnungen</h2>
            {snapshot.periods.length === 0 && <p>Noch keine Abrechnungen.</p>}
            {snapshot.periods.map((period) => <div key={period.id}>
              <h3>{dateTime(period.opened_at)} – {dateTime(period.closed_at)} Uhr</h3>
              {period.payment_hint && <p className="payment-hint">Zahlungshinweis: {period.payment_hint}</p>}
              <div className="admin-member-list">{snapshot.bills.filter((bill) => bill.period_id === period.id).map((bill) => <div className="admin-member" key={bill.id}>
                <div><strong>{bill.display_name}</strong><span>{bill.quantity} Getränke · {money(bill.total_cents)} · {bill.payment_status === 'open' ? 'Offen' : bill.payment_status === 'reported' ? 'Zahlung gemeldet' : 'Eingang bestätigt'}</span>
                  <small>{snapshot.entries.filter((entry) => entry.period_id === period.id && entry.user_id === bill.user_id).map((entry) => `${entry.quantity} × ${money(entry.price_cents)}`).join(' + ')}</small></div>
                <div className="admin-actions">
                  {bill.user_id === userId && bill.payment_status === 'open' && <button className="admin-button" disabled={busy} onClick={() => void action('transition_drinks_payment', { p_bill_id: bill.id, p_action: 'report' })}>Zahlung melden</button>}
                  {bill.user_id === userId && bill.payment_status === 'reported' && <button className="admin-button" disabled={busy} onClick={() => void action('transition_drinks_payment', { p_bill_id: bill.id, p_action: 'withdraw' })}>Meldung zurückziehen</button>}
                  {treasurer && bill.payment_status === 'reported' && <><button className="admin-button" disabled={busy} onClick={() => { if (window.confirm('Zahlungseingang endgültig bestätigen?')) void action('transition_drinks_payment', { p_bill_id: bill.id, p_action: 'confirm' }); }}>Eingang bestätigen</button><button className="admin-button" disabled={busy} onClick={() => void action('transition_drinks_payment', { p_bill_id: bill.id, p_action: 'reject' })}>Zurückweisen</button></>}
                </div>
              </div>)}</div>
            </div>)}
          </section>
        </>}
      </div>
    </main>
  );
}
