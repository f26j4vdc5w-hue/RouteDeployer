import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, Plus, Save, Trash2, Upload } from 'lucide-react';
import type { Collection, Season } from '../../domain/catalog';
import type { RouteStats } from '../../domain/route';
import type { Tour, TourRoute } from '../../domain/tour';
import { deleteStoredRoutes, deleteTour, fetchRoadbook } from '../../data/backend';
import { requireSupabase, supabase } from '../../lib/supabase';
import { analyzeGpx } from './analyzeGpx';
import './admin.css';

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
}

function AdminAppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const client = requireSupabase();
    let active = true;
    client.auth.getSession().then(({ data, error }) => {
      if (active) {
        if (error) setAuthError(error.message);
        else setSession(data.session);
        setAuthLoading(false);
      }
    }).catch((cause: unknown) => {
      if (active) {
        setAuthError(errorText(cause));
        setAuthLoading(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      setAuthError(null);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) return <AdminMessage>Admin-Bereich wird geladen …</AdminMessage>;
  if (authError) {
    return <AdminMessage>Sitzung konnte nicht geladen werden: {authError}</AdminMessage>;
  }
  if (passwordRecovery) return <PasswordRecoveryForm />;
  if (!session) return <LoginForm />;
  if (session.user.app_metadata.role !== 'admin') {
    return <AccessDenied email={session.user.email ?? ''} />;
  }
  return <AdminDashboard session={session} />;
}

export default function AdminApp() {
  if (!supabase) {
    return (
      <AdminMessage>
        Supabase ist nicht konfiguriert. Bitte richte die Variablen
        VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY ein.
      </AdminMessage>
    );
  }
  return <AdminAppContent />;
}

function AdminMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <h1>KLLKTV Roadbook</h1>
        <p role="status">{children}</p>
        <a className="admin-link" href={import.meta.env.BASE_URL}>Zur Website</a>
      </section>
    </main>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: signInError } = await requireSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordRecovery() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('Bitte gib zuerst deine E-Mail-Adresse ein.');
      return;
    }

    setBusy(true);
    try {
      const redirectTo = new URL(
        `${import.meta.env.BASE_URL}admin/`,
        window.location.origin,
      ).toString();
      const { error: recoveryError } = await requireSupabase().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (recoveryError) throw recoveryError;
      setNotice('Falls ein Konto mit dieser Adresse existiert, erhältst du eine E-Mail zum Zurücksetzen des Passworts.');
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel admin-login">
        <header className="admin-header">
          <div>
            <p className="admin-kicker">KLLKTV Roadbook</p>
            <h1>Admin-Anmeldung</h1>
          </div>
          <a className="admin-link" href={import.meta.env.BASE_URL}>Zur Website</a>
        </header>
        <p>Der Zugang wird vom Administrator eingerichtet. Eine öffentliche Registrierung ist deaktiviert.</p>
        <form className="admin-form" onSubmit={submit}>
          <label>
            E-Mail
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          {notice && <p className="admin-alert" role="status">{notice}</p>}
          <button className="admin-button admin-button--primary" disabled={busy}>
            {busy ? 'Anmeldung …' : 'Anmelden'}
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busy}
            onClick={sendPasswordRecovery}
          >
            Passwort zurücksetzen
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordRecoveryForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await requireSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      setCompleted(true);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function continueToLogin() {
    setError(null);
    setBusy(true);
    try {
      const { error: signOutError } = await requireSupabase().auth.signOut();
      if (signOutError) throw signOutError;
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel admin-login">
        <header className="admin-header">
          <div>
            <p className="admin-kicker">KLLKTV Roadbook</p>
            <h1>Passwort zurücksetzen</h1>
          </div>
          <a className="admin-link" href={import.meta.env.BASE_URL}>Zur Website</a>
        </header>
        {completed ? (
          <>
            <p className="admin-alert" role="status">Dein Passwort wurde geändert.</p>
            {error && <p className="admin-error" role="alert">{error}</p>}
            <button className="admin-button admin-button--primary" disabled={busy} onClick={continueToLogin}>
              Zur Anmeldung
            </button>
          </>
        ) : (
          <>
            <p>Lege ein neues Passwort für dein Admin-Konto fest.</p>
            <form className="admin-form" onSubmit={submit}>
              <label>
                Neues Passwort
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <label>
                Neues Passwort bestätigen
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>
              {error && <p className="admin-error" role="alert">{error}</p>}
              <button className="admin-button admin-button--primary" disabled={busy}>
                {busy ? 'Wird gespeichert …' : 'Passwort speichern'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

function AccessDenied({ email }: { email: string }) {
  async function signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) window.alert(`Abmelden fehlgeschlagen: ${error.message}`);
  }
  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <h1>Kein Admin-Zugriff</h1>
        <p>{email} ist angemeldet, hat aber keine Admin-Berechtigung.</p>
        <p>Setze in Supabase unter User → App Metadata die Rolle auf <code>admin</code>.</p>
        <button className="admin-button" onClick={signOut}>Abmelden</button>
      </section>
    </main>
  );
}

interface RouteDraft {
  title: string;
  teaser: string;
  plannedBy: string;
  meetingTime: string;
  meetingPlace: string;
  stations: string;
  highlight: boolean;
  durationMin: string;
  gpxKey: string;
  routeStats: RouteStats | null;
  file: File | null;
}

const emptyRoute = (): RouteDraft => ({
  title: '',
  teaser: '',
  plannedBy: '',
  meetingTime: '17:00',
  meetingPlace: '',
  stations: '',
  highlight: false,
  durationMin: '',
  gpxKey: '',
  routeStats: null,
  file: null,
});

function routeDraft(route?: TourRoute): RouteDraft {
  return route
    ? {
        title: route.title,
        teaser: route.teaser,
        plannedBy: route.plannedBy ?? '',
        meetingTime: route.meetingTime,
        meetingPlace: route.meetingPlace,
        stations: route.stations.join(', '),
        highlight: route.highlight ?? false,
        durationMin: route.durationMin?.toString() ?? '',
        gpxKey: route.gpxKey ?? '',
        routeStats: route.routeStats ?? null,
        file: null,
      }
    : emptyRoute();
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function AdminDashboard({ session }: { session: Session }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedSeasonSlug, setSelectedSeasonSlug] = useState('');
  const [selectedCollectionSlug, setSelectedCollectionSlug] = useState('');
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [showTourForm, setShowTourForm] = useState(false);
  const [seasonDraft, setSeasonDraft] = useState({ slug: '', label: '' });
  const [collectionDraft, setCollectionDraft] = useState({
    slug: '',
    label: '',
    startLabel: 'SAISONBEGINN',
    endLabel: 'SAISONENDE',
  });
  const [seasonOriginalSlug, setSeasonOriginalSlug] = useState<string | null>(null);
  const [collectionOriginalSlug, setCollectionOriginalSlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const client = requireSupabase();

  const reload = useCallback(async () => {
    const data = await fetchRoadbook();
    setSeasons(data);
    setSelectedSeasonSlug((current) =>
      data.some((season) => season.slug === current) ? current : data.at(-1)?.slug ?? '',
    );
  }, []);

  useEffect(() => {
    let active = true;
    fetchRoadbook()
      .then((data) => {
        if (active) {
          setSeasons(data);
          setSelectedSeasonSlug(data.at(-1)?.slug ?? '');
          setDataLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(errorText(cause));
          setDataLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedSeason = seasons.find((season) => season.slug === selectedSeasonSlug);
  const selectedCollection = selectedSeason?.collections.find(
    (collection) => collection.slug === selectedCollectionSlug,
  );
  const tours = useMemo(
    () => [...(selectedCollection?.tours ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    [selectedCollection],
  );

  useEffect(() => {
    if (!selectedSeason) return;
    setSelectedCollectionSlug((current) =>
      selectedSeason.collections.some((collection) => collection.slug === current)
        ? current
        : selectedSeason.collections[0]?.slug ?? '',
    );
  }, [selectedSeason]);

  useEffect(() => {
    setSeasonOriginalSlug(selectedSeason?.slug ?? null);
    setSeasonDraft({ slug: selectedSeason?.slug ?? '', label: selectedSeason?.label ?? '' });
    setCollectionOriginalSlug(null);
  }, [selectedSeason]);

  useEffect(() => {
    setCollectionOriginalSlug(selectedCollection?.slug ?? null);
    setCollectionDraft({
      slug: selectedCollection?.slug ?? '',
      label: selectedCollection?.label ?? '',
      startLabel: selectedCollection?.startLabel ?? 'SAISONBEGINN',
      endLabel: selectedCollection?.endLabel ?? 'SAISONENDE',
    });
  }, [selectedCollection]);

  if (dataLoading) return <AdminMessage>Touren und Saisons werden geladen …</AdminMessage>;
  if (error && seasons.length === 0) {
    return <AdminMessage>Tourendaten konnten nicht geladen werden: {error}</AdminMessage>;
  }

  function reportFailure(cause: unknown) {
    setNotice(null);
    setError(errorText(cause));
  }

  async function saveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = seasonOriginalSlug
        ? await client
            .from('seasons')
            .update({ slug: seasonDraft.slug, label: seasonDraft.label })
            .eq('slug', seasonOriginalSlug)
        : await client.from('seasons').insert({
            slug: seasonDraft.slug,
            label: seasonDraft.label,
            sort_order: seasons.length,
          });
      if (result.error) throw result.error;
      setNotice('Saison gespeichert.');
      setSelectedSeasonSlug(seasonDraft.slug);
      await reload();
    } catch (cause) {
      reportFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function removeSeason() {
    if (!selectedSeason || !window.confirm(`Saison ${selectedSeason.label} und alle zugehörigen Touren löschen?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: deleteError } = await client.from('seasons').delete().eq('slug', selectedSeason.slug);
      if (deleteError) throw deleteError;
      const keys = selectedSeason.collections.flatMap((collection) =>
        collection.tours.flatMap((tour) => [tour.gpxKey, tour.alternative?.gpxKey]),
      ).filter((key): key is string => key != null);
      setSelectedSeasonSlug('');
      await reload();
      try {
        await deleteStoredRoutes(keys);
      } catch (cause) {
        throw new Error(`Saison gelöscht, GPX-Dateien konnten aber nicht vollständig entfernt werden: ${errorText(cause)}`);
      }
      setNotice('Saison gelöscht.');
      setSeasonOriginalSlug(null);
    } catch (cause) {
      reportFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSeason) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const values = {
        season_slug: selectedSeason.slug,
        slug: collectionDraft.slug,
        label: collectionDraft.label,
        start_label: collectionDraft.startLabel,
        end_label: collectionDraft.endLabel,
      };
      const result = collectionOriginalSlug
        ? await client
            .from('collections')
            .update(values)
            .eq('season_slug', selectedSeason.slug)
            .eq('slug', collectionOriginalSlug)
        : await client.from('collections').insert({ ...values, sort_order: selectedSeason.collections.length });
      if (result.error) throw result.error;
      setSelectedCollectionSlug(collectionDraft.slug);
      setNotice('Kollektion gespeichert.');
      await reload();
    } catch (cause) {
      reportFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function removeCollection() {
    if (
      !selectedSeason ||
      !selectedCollection ||
      !window.confirm(`Kollektion ${selectedCollection.label} und alle Touren darin löschen?`)
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: deleteError } = await client
        .from('collections')
        .delete()
        .eq('season_slug', selectedSeason.slug)
        .eq('slug', selectedCollection.slug);
      if (deleteError) throw deleteError;
      const keys = selectedCollection.tours.flatMap((tour) => [
        tour.gpxKey,
        tour.alternative?.gpxKey,
      ]).filter((key): key is string => key != null);
      setSelectedCollectionSlug('');
      await reload();
      try {
        await deleteStoredRoutes(keys);
      } catch (cause) {
        throw new Error(`Kollektion gelöscht, GPX-Dateien konnten aber nicht vollständig entfernt werden: ${errorText(cause)}`);
      }
      setNotice('Kollektion gelöscht.');
    } catch (cause) {
      reportFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function removeSelectedTour(tour: Tour) {
    if (!window.confirm(`Tour „${tour.title}“ vom ${tour.id} löschen?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteTour(tour);
      setNotice('Tour gelöscht.');
      await reload();
    } catch (cause) {
      reportFailure(cause);
      try {
        await reload();
      } catch (reloadCause) {
        reportFailure(reloadCause);
      }
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError(null);
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  return (
    <main className="admin-shell">
      <div className="admin-dashboard">
        <header className="admin-header admin-dashboard__header">
          <div>
            <p className="admin-kicker">KLLKTV Roadbook</p>
            <h1>Touren verwalten</h1>
          </div>
          <div className="admin-account">
            <a className="admin-link" href={import.meta.env.BASE_URL}>Website ansehen</a>
            <span>{session.user.email}</span>
            <button className="admin-button" onClick={signOut}><LogOut size={16} /> Abmelden</button>
          </div>
        </header>

        {(error || notice) && (
          <p className={`admin-alert${error ? ' admin-alert--error' : ''}`} role={error ? 'alert' : 'status'}>
            {error ?? notice}
          </p>
        )}

        <section className="admin-card">
          <h2>Saison und Kollektion</h2>
          <div className="admin-selectors">
            <label>
              Saison
              <select
                value={selectedSeasonSlug}
                onChange={(event) => {
                  setSelectedSeasonSlug(event.target.value);
                  setEditingTour(null);
                  setShowTourForm(false);
                }}
              >
                {seasons.map((season) => (
                  <option value={season.slug} key={season.slug}>{season.label} · {season.slug}</option>
                ))}
              </select>
            </label>
            <label>
              Kollektion
              <select
                value={selectedCollectionSlug}
                onChange={(event) => {
                  setSelectedCollectionSlug(event.target.value);
                  setEditingTour(null);
                  setShowTourForm(false);
                }}
                disabled={!selectedSeason?.collections.length}
              >
                {selectedSeason?.collections.map((collection) => (
                  <option value={collection.slug} key={collection.slug}>{collection.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-management">
            <form className="admin-form admin-form--inline" onSubmit={saveSeason}>
              <div className="admin-form__heading">
                <h3>{seasonOriginalSlug ? 'Saison bearbeiten' : 'Saison hinzufügen'}</h3>
                <button
                  type="button"
                  className="admin-button"
                  onClick={() => {
                    setSeasonOriginalSlug(null);
                    setSeasonDraft({ slug: '', label: '' });
                  }}
                >
                  <Plus size={16} /> Neue Saison
                </button>
              </div>
              <label>
                Kürzel / URL-Slug
                <input
                  value={seasonDraft.slug}
                  onChange={(event) => setSeasonDraft({ ...seasonDraft, slug: slugify(event.target.value) })}
                  placeholder="s28"
                  required
                />
              </label>
              <label>
                Anzeigename
                <input
                  value={seasonDraft.label}
                  onChange={(event) => setSeasonDraft({ ...seasonDraft, label: event.target.value })}
                  placeholder="S28"
                  required
                />
              </label>
              <div className="admin-actions">
                <button className="admin-button admin-button--primary" disabled={busy}>
                  <Save size={16} /> {seasonOriginalSlug ? 'Saison speichern' : 'Saison anlegen'}
                </button>
                {selectedSeason && (
                  <button type="button" className="admin-button admin-button--danger" onClick={removeSeason} disabled={busy}>
                    <Trash2 size={16} /> Saison löschen
                  </button>
                )}
              </div>
            </form>

            <form className="admin-form admin-form--inline" onSubmit={saveCollection}>
              <div className="admin-form__heading">
                <h3>{collectionOriginalSlug ? 'Kollektion bearbeiten' : 'Kollektion hinzufügen'}</h3>
                <button
                  type="button"
                  className="admin-button"
                  disabled={!selectedSeason}
                  onClick={() => {
                    setCollectionOriginalSlug(null);
                    setCollectionDraft({
                      slug: '',
                      label: '',
                      startLabel: 'SAISONBEGINN',
                      endLabel: 'SAISONENDE',
                    });
                  }}
                >
                  <Plus size={16} /> Neue Kollektion
                </button>
              </div>
              <label>
                URL-Slug
                <input
                  value={collectionDraft.slug}
                  onChange={(event) => setCollectionDraft({ ...collectionDraft, slug: slugify(event.target.value) })}
                  placeholder="after-work"
                  required
                  disabled={!selectedSeason}
                />
              </label>
              <label>
                Anzeigename
                <input
                  value={collectionDraft.label}
                  onChange={(event) => setCollectionDraft({ ...collectionDraft, label: event.target.value })}
                  placeholder="After Work"
                  required
                  disabled={!selectedSeason}
                />
              </label>
              <div className="admin-form__row">
                <label>
                  Timeline-Anfang
                  <input
                    value={collectionDraft.startLabel}
                    onChange={(event) => setCollectionDraft({ ...collectionDraft, startLabel: event.target.value })}
                    required
                    disabled={!selectedSeason}
                  />
                </label>
                <label>
                  Timeline-Ende
                  <input
                    value={collectionDraft.endLabel}
                    onChange={(event) => setCollectionDraft({ ...collectionDraft, endLabel: event.target.value })}
                    required
                    disabled={!selectedSeason}
                  />
                </label>
              </div>
              <div className="admin-actions">
                <button className="admin-button admin-button--primary" disabled={busy || !selectedSeason}>
                  <Save size={16} /> {collectionOriginalSlug ? 'Kollektion speichern' : 'Kollektion anlegen'}
                </button>
                {selectedCollection && (
                  <button type="button" className="admin-button admin-button--danger" onClick={removeCollection} disabled={busy}>
                    <Trash2 size={16} /> Kollektion löschen
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card__heading">
            <div>
              <h2>Touren</h2>
              <p>{selectedSeason?.label ?? 'Keine Saison'} · {selectedCollection?.label ?? 'Keine Kollektion'}</p>
            </div>
            {!showTourForm && (
              <button
                className="admin-button admin-button--primary"
                disabled={!selectedCollection || busy}
                onClick={() => {
                  setEditingTour(null);
                  setShowTourForm(true);
                }}
              >
                <Plus size={16} /> Neue Tour
              </button>
            )}
          </div>

          {showTourForm && selectedSeason && selectedCollection && (
            <TourEditor
              key={editingTour?.id ?? 'new'}
              season={selectedSeason}
              collection={selectedCollection}
              tour={editingTour}
              onCancel={() => {
                setShowTourForm(false);
                setEditingTour(null);
              }}
              onSaved={async (message) => {
                setShowTourForm(false);
                setEditingTour(null);
                setNotice(message);
                await reload();
              }}
              onError={reportFailure}
            />
          )}

          <div className="admin-tour-list">
            {tours.map((tour) => (
              <article className="admin-tour" key={tour.id}>
                <div>
                  <time dateTime={tour.id}>{tour.id}</time>
                  <h3>{tour.title}</h3>
                  <p>{tour.gpx ? 'GPX vorhanden' : 'Ohne GPX'}{tour.alternative ? ' · Alternative' : ''}</p>
                </div>
                <div className="admin-actions">
                  <button className="admin-button" onClick={() => { setEditingTour(tour); setShowTourForm(true); }}>
                    Bearbeiten
                  </button>
                  <button
                    className="admin-button admin-button--danger"
                    onClick={() => removeSelectedTour(tour)}
                    disabled={busy}
                    aria-label={`Tour ${tour.title} löschen`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {tours.length === 0 && !showTourForm && <p className="admin-muted">Noch keine Touren eingetragen.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function TourEditor({
  season,
  collection,
  tour,
  onCancel,
  onSaved,
  onError,
}: {
  season: Season;
  collection: Collection;
  tour: Tour | null;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
  onError: (cause: unknown) => void;
}) {
  const [id, setId] = useState(tour?.id ?? '');
  const [primary, setPrimary] = useState(() => routeDraft(tour ?? undefined));
  const [hasAlternative, setHasAlternative] = useState(Boolean(tour?.alternative));
  const [alternative, setAlternative] = useState(() => routeDraft(tour?.alternative));
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function prepareRoute(draft: RouteDraft, variant: 'A' | 'B', uploaded: string[]) {
    let gpxKey = draft.gpxKey;
    let routeStats = draft.routeStats;
    if (draft.file) {
      routeStats = await analyzeGpx(draft.file);
      const originalName = draft.file.name
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/^-|-$/g, '');
      gpxKey = `${season.slug}/${collection.slug}/${id}/${variant}-${crypto.randomUUID()}-${originalName}`;
      const { error } = await requireSupabase()
        .storage.from('routes')
        .upload(gpxKey, draft.file, {
          cacheControl: '3600',
          contentType: 'application/gpx+xml',
          upsert: false,
        });
      if (error) throw error;
      uploaded.push(gpxKey);
    }
    return { gpxKey: gpxKey || null, routeStats };
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    const uploaded: string[] = [];
    let persisted = false;
    try {
      const primaryGpx = await prepareRoute(primary, 'A', uploaded);
      const alternativeGpx = hasAlternative
        ? await prepareRoute(alternative, 'B', uploaded)
        : null;
      const client = requireSupabase();
      const values = {
        id,
        season_slug: season.slug,
        collection_slug: collection.slug,
        title: primary.title.trim(),
        teaser: primary.teaser.trim(),
        planned_by: primary.plannedBy.trim() || null,
        meeting_time: primary.meetingTime,
        meeting_place: primary.meetingPlace.trim(),
        stations: primary.stations.split(',').map((station) => station.trim()).filter(Boolean),
        highlight: primary.highlight,
        duration_min: primary.durationMin ? Number(primary.durationMin) : null,
        gpx_key: primaryGpx.gpxKey,
        route_stats: primaryGpx.routeStats,
        alternative: alternativeGpx
          ? {
              title: alternative.title.trim(),
              teaser: alternative.teaser.trim(),
              plannedBy: alternative.plannedBy.trim() || null,
              meetingTime: alternative.meetingTime,
              meetingPlace: alternative.meetingPlace.trim(),
              stations: alternative.stations.split(',').map((station) => station.trim()).filter(Boolean),
              highlight: alternative.highlight,
              durationMin: alternative.durationMin ? Number(alternative.durationMin) : null,
              gpxKey: alternativeGpx.gpxKey,
              routeStats: alternativeGpx.routeStats,
            }
          : null,
      };
      let saveError;
      if (tour) {
        if (!tour.seasonSlug || !tour.collectionSlug) {
          throw new Error('Bei der Tour fehlen Saison- oder Kollektion-Zuordnung.');
        }
        const { error } = await client
          .from('tours')
          .update(values)
          .eq('id', tour.id)
          .eq('season_slug', tour.seasonSlug)
          .eq('collection_slug', tour.collectionSlug);
        saveError = error;
      } else {
        const { error } = await client.from('tours').insert(values);
        saveError = error;
      }
      if (saveError) throw saveError;
      persisted = true;

      const previousKeys = [tour?.gpxKey, tour?.alternative?.gpxKey].filter(
        (key): key is string => key != null,
      );
      const retainedKeys = new Set([values.gpx_key, alternativeGpx?.gpxKey].filter(Boolean));
      const removedKeys = previousKeys.filter((key) => !retainedKeys.has(key));
      if (removedKeys.length > 0) {
        const { error: removeError } = await client.storage.from('routes').remove(removedKeys);
        if (removeError) throw new Error(`Tour gespeichert, alte GPX-Datei aber nicht gelöscht: ${removeError.message}`);
      }
      await onSaved(tour ? 'Tour gespeichert.' : 'Tour angelegt.');
    } catch (cause) {
      if (!persisted && uploaded.length > 0) {
        const { error: cleanupError } = await requireSupabase().storage.from('routes').remove(uploaded);
        if (cleanupError) {
          setLocalError(`${errorText(cause)} Zusätzlich konnten temporäre GPX-Dateien nicht entfernt werden: ${cleanupError.message}`);
          setBusy(false);
          return;
        }
      }
      setLocalError(errorText(cause));
      onError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form admin-tour-editor" onSubmit={save}>
      <h3>{tour ? `Tour bearbeiten · ${tour.id}` : 'Neue Tour'}</h3>
      <label className="admin-date">
        Datum
        <input type="date" value={id} onChange={(event) => setId(event.target.value)} required disabled={Boolean(tour)} />
      </label>
      <RouteFields label="Hauptroute" value={primary} onChange={(patch) => setPrimary({ ...primary, ...patch })} />
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={hasAlternative}
          onChange={(event) => setHasAlternative(event.target.checked)}
        />
        Alternative Route anbieten
      </label>
      {hasAlternative && (
        <RouteFields
          label="Alternative Route"
          value={alternative}
          onChange={(patch) => setAlternative({ ...alternative, ...patch })}
        />
      )}
      {localError && <p className="admin-error" role="alert">{localError}</p>}
      <div className="admin-actions">
        <button className="admin-button admin-button--primary" disabled={busy}>
          <Save size={16} /> {busy ? 'Speichert …' : 'Tour speichern'}
        </button>
        <button type="button" className="admin-button" onClick={onCancel} disabled={busy}>Abbrechen</button>
      </div>
    </form>
  );
}

function RouteFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RouteDraft;
  onChange: (patch: Partial<RouteDraft>) => void;
}) {
  return (
    <fieldset className="admin-route-fields">
      <legend>{label}</legend>
      <label>
        Titel
        <input value={value.title} onChange={(event) => onChange({ title: event.target.value })} required />
      </label>
      <label>
        Beschreibung
        <textarea value={value.teaser} onChange={(event) => onChange({ teaser: event.target.value })} rows={3} required />
      </label>
      <div className="admin-form__row">
        <label>
          Geplant von (optional)
          <input value={value.plannedBy} onChange={(event) => onChange({ plannedBy: event.target.value })} />
        </label>
        <label>
          Uhrzeit
          <input type="time" value={value.meetingTime} onChange={(event) => onChange({ meetingTime: event.target.value })} required />
        </label>
      </div>
      <label>
        Treffpunkt
        <input value={value.meetingPlace} onChange={(event) => onChange({ meetingPlace: event.target.value })} required />
      </label>
      <label>
        Orte entlang der Strecke (durch Komma trennen)
        <input value={value.stations} onChange={(event) => onChange({ stations: event.target.value })} />
      </label>
      <div className="admin-form__row">
        <label>
          Dauer in Minuten (optional)
          <input
            type="number"
            min="1"
            value={value.durationMin}
            onChange={(event) => onChange({ durationMin: event.target.value })}
          />
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={value.highlight}
            onChange={(event) => onChange({ highlight: event.target.checked })}
          />
          In der Timeline hervorheben
        </label>
      </div>
      <label className="admin-file">
        GPX-Datei (max. 10 MB)
        <span className="admin-file__status">
          <Upload size={16} />
          {value.file?.name ?? (value.gpxKey ? 'Vorhandene Datei bleibt erhalten' : 'Datei auswählen')}
        </span>
        <input
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          onChange={(event) => onChange({ file: event.target.files?.[0] ?? null })}
        />
      </label>
    </fieldset>
  );
}
