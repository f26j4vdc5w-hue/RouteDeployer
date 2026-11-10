import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, LogOut, UserRound, X } from 'lucide-react';
import { requireSupabase } from '../../lib/supabase';
import { formatGermanDateInput, isoToGerman, parseGermanDate } from '../../shared/format/germanInput';
import type { CommunityMember } from './useCommunityAuth';
import { usePendingMemberCount } from './usePendingMemberCount';
import './community.css';

interface Props {
  email: string | null;
  member: CommunityMember | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  accessRequired?: boolean;
}

type Mode = 'signin' | 'signup';

/** Wandelt TT.MM.JJJJ in ISO um; null bei ungültigem oder zukünftigem Datum. */
function germanToIso(value: string): string | null {
  const iso = parseGermanDate(value);
  return iso && new Date(`${iso}T00:00:00Z`).getTime() <= Date.now() ? iso : null;
}

export function CommunityAccount({
  email,
  member,
  isAdmin,
  loading,
  error,
  onRefresh,
  accessRequired = false,
}: Props) {
  const [open, setOpen] = useState(accessRequired);
  const pendingCount = usePendingMemberCount(isAdmin, open);
  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [profileName, setProfileName] = useState('');
  const [address, setAddress] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [clothingSize, setClothingSize] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null);
  const passkeySupported = window.isSecureContext && typeof window.PublicKeyCredential !== 'undefined';

  useEffect(() => {
    setProfileName(member?.display_name ?? '');
    setAddress(member?.address ?? '');
    setFullName(member?.full_name ?? '');
    setBirthDate(isoToGerman(member?.birth_date ?? null));
    setClothingSize(member?.clothing_size ?? '');
    setPhoneNumber(member?.phone_number ?? '');
  }, [member]);

  useEffect(() => {
    setPasskeyError(null);
    setPasskeyNotice(null);
  }, [email]);

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
        const submittedEmail = formEmail.trim();
        setConfirmationEmail(data.session ? null : submittedEmail);
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
        if (signinError) {
          if (signinError.code === 'email_not_confirmed') {
            setConfirmationEmail(formEmail.trim());
            setFormError('Deine E-Mail-Adresse ist noch nicht bestätigt. Du kannst die Bestätigungsmail erneut anfordern.');
            return;
          }
          throw signinError;
        }
        setNotice('Anmeldung erfolgreich.');
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Die Anfrage ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmationEmail) return;
    setFormError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: resendError } = await requireSupabase().auth.resend({
        type: 'signup',
        email: confirmationEmail,
        options: {
          emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
        },
      });
      if (resendError) throw resendError;
      setNotice(`Eine neue Bestätigungsmail wurde an ${confirmationEmail} angefordert.`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Die Bestätigungsmail konnte nicht erneut angefordert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPasskey() {
    setFormError(null);
    setNotice(null);
    setPasskeyBusy(true);
    try {
      const { data, error: passkeySignInError } = await requireSupabase().auth.signInWithPasskey();
      if (passkeySignInError) throw passkeySignInError;
      if (!data?.session) throw new Error('Die Passkey-Anmeldung hat keine Sitzung erstellt.');
      setConfirmationEmail(null);
      setNotice('Anmeldung erfolgreich.');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Die Passkey-Anmeldung ist fehlgeschlagen.');
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function registerPasskey() {
    setPasskeyError(null);
    setPasskeyNotice(null);
    setPasskeyBusy(true);
    try {
      const { data, error: registerError } = await requireSupabase().auth.registerPasskey();
      if (registerError) throw registerError;
      if (!data) throw new Error('Der Passkey konnte nicht eingerichtet werden.');
      setPasskeyNotice('Dein Passkey wurde eingerichtet. Du kannst dich damit künftig anmelden.');
    } catch (cause) {
      setPasskeyError(cause instanceof Error ? cause.message : 'Der Passkey konnte nicht eingerichtet werden.');
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function signInWithGoogle() {
    setFormError(null);
    setNotice(null);
    setBusy(true);
    const { error: oauthError } = await requireSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString() },
    });
    if (oauthError) {
      setFormError(oauthError.message);
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
        p_clothing_size: clothingSize.trim() || null,
        p_phone_number: phoneNumber.trim() || null,
      });
      if (updateError) throw new Error(updateError.message);
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
        aria-label={
          pendingCount > 0
            ? `Konto anzeigen, ${pendingCount} offene Freigaben`
            : email
              ? 'Konto und Mitgliedsstatus anzeigen'
              : 'Anmelden oder registrieren'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <UserRound size={19} aria-hidden="true" />
        {accessRequired && <span>Anmelden oder registrieren</span>}
        {pendingCount > 0 && (
          <span className="nav__account-badge" aria-hidden="true">{pendingCount > 99 ? '99+' : pendingCount}</span>
        )}
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
                      Bei Events erhält der Organisator nur die dort angeforderten Angaben,
                      wenn du deiner Teilnahme und der Weitergabe zustimmst.
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
                        onChange={(event) => setBirthDate(formatGermanDateInput(event.target.value))}
                      />
                    </label>
                    <label>
                      Kleidergröße
                      <input
                        maxLength={40}
                        placeholder="z. B. M oder 38"
                        value={clothingSize}
                        onChange={(event) => setClothingSize(event.target.value)}
                      />
                    </label>
                    <label>
                      Telefonnummer
                      <input
                        type="tel"
                        autoComplete="tel"
                        maxLength={40}
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                      />
                      <span className="community__hint">
                        Für Eventzusagen mindestens fünf Ziffern; +, Leerzeichen, Klammern, Punkte, / und - sind erlaubt.
                      </span>
                    </label>
                  </fieldset>
                  {formError && <p className="community__message community__message--error" role="alert">{formError}</p>}
                  {notice && <p className="community__message" role="status">{notice}</p>}
                  <button className="community__submit" type="submit" disabled={busy || passkeyBusy || !member}>
                    {busy ? 'Wird gespeichert …' : 'Profil speichern'}
                  </button>
                </form>
                <section className="community__section" aria-labelledby="passkey-title">
                  <h3 id="passkey-title" className="community__section-title">Passkey</h3>
                  <p className="community__hint">
                    Richte einen Passkey ein, um dich künftig ohne Passwort anzumelden.
                    Deine Mitgliedschaft muss weiterhin freigegeben sein.
                  </p>
                  {!passkeySupported && (
                    <p className="community__hint">Passkeys benötigen einen unterstützten Browser und eine sichere Verbindung.</p>
                  )}
                  {passkeyError && <p className="community__message community__message--error" role="alert">{passkeyError}</p>}
                  {passkeyNotice && <p className="community__message" role="status">{passkeyNotice}</p>}
                  <button className="community__submit" type="button" onClick={registerPasskey} disabled={busy || passkeyBusy || !passkeySupported}>
                    <KeyRound size={16} aria-hidden="true" />
                    {passkeyBusy ? 'Wird eingerichtet …' : 'Passkey einrichten'}
                  </button>
                </section>
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
                <button className="community__submit" type="button" onClick={signOut} disabled={busy || passkeyBusy}>
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
                    disabled={passkeyBusy}
                  >
                    Anmelden
                  </button>
                  <button
                    type="button"
                    className={mode === 'signup' ? 'is-active' : ''}
                    onClick={() => changeMode('signup')}
                    disabled={passkeyBusy}
                  >
                    Registrieren
                  </button>
                </div>
                <button
                  type="button"
                  className="community__google"
                  onClick={signInWithGoogle}
                  disabled={busy || passkeyBusy}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
                    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
                    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
                  </svg>
                  Mit Google {mode === 'signup' ? 'registrieren' : 'anmelden'}
                </button>
                {mode === 'signin' && (
                  <>
                    <button className="community__passkey" type="button" onClick={signInWithPasskey} disabled={busy || passkeyBusy || !passkeySupported}>
                      <KeyRound size={18} aria-hidden="true" />
                      {passkeyBusy ? 'Anmeldung läuft …' : 'Mit Passkey anmelden'}
                    </button>
                    {!passkeySupported && (
                      <p className="community__hint">Passkeys benötigen einen unterstützten Browser und eine sichere Verbindung.</p>
                    )}
                  </>
                )}
                <p className="community__hint">
                  Mehr dazu in der{' '}
                  <a href={`${import.meta.env.BASE_URL}datenschutz/`}>Datenschutzerklärung</a>.
                </p>
                <p className="community__hint">oder mit E-Mail</p>
                {mode === 'signup' && (
                  <p className="community__hint">
                    Der Bestätigungslink in der E-Mail ist eine Stunde gültig. Falls er abläuft,
                    kannst du eine neue Bestätigungsmail anfordern. Bei Google entfällt die
                    E-Mail-Bestätigung. Danach muss ein Admin deine Mitgliedschaft freigeben.
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
                  <button className="community__submit" type="submit" disabled={busy || passkeyBusy}>
                    {busy ? 'Einen Moment …' : mode === 'signup' ? 'Konto erstellen' : 'Anmelden'}
                  </button>
                </form>
                {confirmationEmail && (
                  <div className="community__form">
                    <button
                      className="community__refresh"
                      type="button"
                      onClick={resendConfirmation}
                      disabled={busy || passkeyBusy}
                    >
                      {busy ? 'Wird angefordert …' : 'Bestätigungsmail erneut senden'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
