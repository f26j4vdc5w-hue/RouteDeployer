import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, UserRound, X } from 'lucide-react';
import { requireSupabase } from '../../lib/supabase';
import type { CommunityMember } from './useCommunityAuth';
import './community.css';

interface Props {
  email: string | null;
  member: CommunityMember | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

type Mode = 'signin' | 'signup';

const isoToGerman = (iso: string | null) => {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
};

/** Setzt die Punkte beim Tippen automatisch (TT.MM.JJJJ). */
function formatBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** Wandelt TT.MM.JJJJ in ISO um; null bei ungültigem oder zukünftigem Datum. */
function germanToIso(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900 ||
    date.getTime() > Date.now()
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function CommunityAccount({ email, member, isAdmin, loading, error, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [profileName, setProfileName] = useState('');
  const [address, setAddress] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfileName(member?.display_name ?? '');
    setAddress(member?.address ?? '');
    setFullName(member?.full_name ?? '');
    setBirthDate(isoToGerman(member?.birth_date ?? null));
  }, [member]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setFormError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    if (mode === 'signup' && !displayName.trim()) {
      setFormError('Bitte gib einen Anzeigenamen ein.');
      return;
    }
    setBusy(true);
    try {
      const client = requireSupabase();
      if (mode === 'signup') {
        const { data, error: signupError } = await client.auth.signUp({
          email: formEmail.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
          },
        });
        if (signupError) throw signupError;
        setNotice(
          data.session
            ? 'Dein Konto wurde angelegt. Nach der E-Mail-Bestätigung muss ein Admin deine Mitgliedschaft freigeben.'
            : 'Bitte bestätige zuerst deine E-Mail-Adresse. Danach prüft ein Admin deine Mitgliedschaft.',
        );
      } else {
        const { error: signinError } = await client.auth.signInWithPassword({
          email: formEmail.trim(),
          password,
        });
        if (signinError) throw signinError;
        setNotice('Anmeldung erfolgreich.');
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Die Anfrage ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setFormError(null);
    setBusy(true);
    try {
      const { error: signoutError } = await requireSupabase().auth.signOut();
      if (signoutError) throw signoutError;
      setNotice(null);
      setOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Abmelden fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const trimmedName = profileName.trim();
    if (!member || !trimmedName || trimmedName.length > 60) {
      setFormError('Der Anzeigename muss zwischen 1 und 60 Zeichen lang sein.');
      return;
    }

    const birthDateIso = birthDate.trim() ? germanToIso(birthDate) : null;
    if (birthDate.trim() && !birthDateIso) {
      setFormError('Bitte gib ein gültiges Geburtsdatum im Format TT.MM.JJJJ ein.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await requireSupabase().rpc('update_community_member_profile', {
        p_display_name: trimmedName,
        p_full_name: fullName.trim() || null,
        p_address: address.trim() || null,
        p_birth_date: birthDateIso,
      });
      if (updateError) throw updateError;
      onRefresh();
      setNotice('Dein Profil wurde gespeichert.');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Dein Profil konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="nav__account-button"
        type="button"
        aria-label={email ? 'Konto und Mitgliedsstatus anzeigen' : 'Anmelden oder registrieren'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <UserRound size={19} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="community__overlay" role="dialog" aria-modal="true" aria-labelledby="community-title">
          <button
            className="community__backdrop"
            type="button"
            aria-label="Konto schließen"
            onClick={() => setOpen(false)}
          />
          <section className="community__panel">
            <header className="community__header">
              <h2 id="community-title">{email ? 'Community-Konto' : mode === 'signup' ? 'Konto erstellen' : 'Anmelden'}</h2>
              <button
                className="community__close"
                type="button"
                aria-label="Konto schließen"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            {loading ? (
              <p role="status">Mitgliedsstatus wird geladen …</p>
            ) : email ? (
              <div className="community__content">
                {error && <p className="community__message community__message--error" role="alert">{error}</p>}
                <p className="community__name">{member?.display_name ?? email}</p>
                <p className="community__email">{email}</p>
                <form className="community__form" onSubmit={saveProfile}>
                  <label>
                    Anzeigename
                    <input
                      autoComplete="nickname"
                      maxLength={60}
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      required
                    />
                  </label>
                  <fieldset className="community__section">
                    <legend>Persönliche Angaben (optional)</legend>
                    <p className="community__hint">
                      Diese Daten können künftig für die Buchung von Unterkünften, Flügen und
                      Startplätzen genutzt werden. Eine genaue Richtlinie, wer wann und wie Zugriff
                      darauf erhält, steht noch nicht fest. Aktuell sind die Angaben nur für dich
                      selbst sichtbar.
                    </p>
                    <label>
                      Vollständiger Name
                      <input
                        autoComplete="name"
                        maxLength={120}
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                      />
                    </label>
                    <label>
                      Adresse
                      <textarea
                        autoComplete="street-address"
                        maxLength={250}
                        rows={2}
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                      />
                    </label>
                    <label>
                      Geburtsdatum
                      <input
                        inputMode="numeric"
                        autoComplete="bday"
                        placeholder="TT.MM.JJJJ"
                        maxLength={10}
                        value={birthDate}
                        onChange={(event) => setBirthDate(formatBirthDateInput(event.target.value))}
                      />
                    </label>
                  </fieldset>
                  {formError && <p className="community__message community__message--error" role="alert">{formError}</p>}
                  {notice && <p className="community__message" role="status">{notice}</p>}
                  <button className="community__submit" type="submit" disabled={busy || !member}>
                    {busy ? 'Wird gespeichert …' : 'Profil speichern'}
                  </button>
                </form>
                {!error && member?.status === 'approved' && member.email_confirmed_at ? (
                  <p className="community__message" role="status">Dein Community-Zugang ist freigeschaltet.</p>
                ) : !error && member?.status === 'rejected' ? (
                  <p className="community__message community__message--error" role="status">
                    Deine Mitgliedschaft wurde nicht freigegeben. Bitte wende dich an einen Admin.
                  </p>
                ) : !error && member?.email_confirmed_at ? (
                  <p className="community__message" role="status">
                    Deine E-Mail ist bestätigt. Ein Admin muss deine Mitgliedschaft noch freigeben.
                  </p>
                ) : !error && member ? (
                  <p className="community__message" role="status">
                    Bitte bestätige den Link in deiner E-Mail. Danach kann ein Admin deine Mitgliedschaft freigeben.
                  </p>
                ) : null}
                {member?.status === 'pending' && (
                  <button className="community__refresh" type="button" onClick={onRefresh}>
                    Mitgliedsstatus aktualisieren
                  </button>
                )}
                {isAdmin && (
                  <a className="community__admin-link" href={`${import.meta.env.BASE_URL}admin/`}>
                    Zum Admin-Bereich
                  </a>
                )}
                <button className="community__submit" type="button" onClick={signOut} disabled={busy}>
                  <LogOut size={16} aria-hidden="true" />
                  {busy ? 'Wird abgemeldet …' : 'Abmelden'}
                </button>
              </div>
            ) : (
              <div className="community__content">
                <div className="community__switch" role="group" aria-label="Kontoaktion">
                  <button
                    type="button"
                    className={mode === 'signin' ? 'is-active' : ''}
                    onClick={() => changeMode('signin')}
                  >
                    Anmelden
                  </button>
                  <button
                    type="button"
                    className={mode === 'signup' ? 'is-active' : ''}
                    onClick={() => changeMode('signup')}
                  >
                    Registrieren
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="community__hint">
                    Nach der E-Mail-Bestätigung muss ein Admin deine Mitgliedschaft freigeben.
                  </p>
                )}
                <form className="community__form" onSubmit={submit}>
                  {mode === 'signup' && (
                    <label>
                      Anzeigename
                      <input
                        autoComplete="nickname"
                        maxLength={60}
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        required
                      />
                    </label>
                  )}
                  <label>
                    E-Mail
                    <input
                      type="email"
                      autoComplete="email"
                      value={formEmail}
                      onChange={(event) => setFormEmail(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Passwort
                    <input
                      type="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      minLength={mode === 'signup' ? 8 : undefined}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </label>
                  {formError && <p className="community__message community__message--error" role="alert">{formError}</p>}
                  {notice && <p className="community__message" role="status">{notice}</p>}
                  <button className="community__submit" type="submit" disabled={busy}>
                    {busy ? 'Einen Moment …' : mode === 'signup' ? 'Konto erstellen' : 'Anmelden'}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
