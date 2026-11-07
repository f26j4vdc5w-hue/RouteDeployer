import './legal.css';

export default function PrivacyPolicy() {
  const home = import.meta.env.BASE_URL;

  return (
    <main className="legal">
      <a className="legal__back" href={home}>
        ← Zurück zur App
      </a>
      <h1>Datenschutzerklärung</h1>
      <p className="legal__meta">Stand: November 2026</p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Reino Albrecht, E-Mail:{' '}
        <a href="mailto:reino.albrecht@icloud.com">reino.albrecht@icloud.com</a>
      </p>
      <p>
        KLLKTV Roadbook ist ein privates, nicht kommerzielles Projekt zur Planung gemeinsamer
        Radtouren.
      </p>

      <h2>2. Nutzung ohne Konto</h2>
      <p>
        Touren, Karten, Höhenprofile und Wettervorhersagen kannst du ohne Konto ansehen. Dabei
        werden Daten von Drittanbietern geladen, die dabei deine IP-Adresse erhalten:
      </p>
      <ul>
        <li>OpenStreetMap-Kartenkacheln (tile.openstreetmap.org)</li>
        <li>Open-Meteo für Wetterdaten (api.open-meteo.com)</li>
        <li>GitHub Pages als Hosting dieser Seite</li>
      </ul>

      <h2>3. Konto und Mitgliedschaft</h2>
      <p>Wenn du ein Konto anlegst, speichern wir:</p>
      <ul>
        <li>E-Mail-Adresse und Anzeigename (Pflicht für das Konto)</li>
        <li>Deine Zu- und Absagen zu Touren</li>
        <li>Freigabestatus deiner Mitgliedschaft</li>
      </ul>
      <p>
        Freigegebene Mitglieder sehen deinen Anzeigenamen bei den Touren, für die du zu- oder
        abgesagt hast. Deine E-Mail-Adresse ist für andere Mitglieder nicht sichtbar.
      </p>

      <h2>4. Anmeldung mit Google</h2>
      <p>
        Du kannst dich mit deinem Google-Konto anmelden. Google übermittelt uns dafür nur deine
        E-Mail-Adresse und deinen Namen. Dabei verarbeitet Google Daten nach seiner eigenen
        Datenschutzerklärung. Wir erhalten keinen Zugriff auf weitere Google-Daten.
      </p>

      <h2>5. Persönliche Angaben (optional)</h2>
      <p>
        Im Profil kannst du freiwillig vollständigen Namen, Adresse, Geburtsdatum, Kleidergröße
        und Telefonnummer hinterlegen.
        Sie sind zunächst nur für dich selbst sichtbar. Sie können künftig für die Buchung von
        Unterkünften, Flügen und Startplätzen genutzt werden. Eine Weitergabe an andere Personen
        findet nur wie unten beschrieben statt. Du kannst die Angaben jederzeit ändern oder
        löschen.
      </p>

      <h2>6. Events und Organisatoren</h2>
      <p>
        Wenn du einem Event beitrittst, willigst du ausdrücklich ein, dass der Organisator des
        Events die bei der Eventerstellung ausgewählten Pflichtangaben einsehen und nutzen darf.
        Dazu können vollständiger Name, E-Mail-Adresse, Adresse, Geburtsdatum, Kleidergröße und
        Telefonnummer gehören. Die Einwilligung gilt nur für dieses Event und endet, wenn du
        deine Zusage zurücknimmst. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a
        DSGVO).
      </p>

      <h2>7. Auftragsverarbeiter</h2>
      <p>
        Konten und Profildaten werden bei Supabase gespeichert. Die Anmeldung mit Google erfolgt
        über Google.
      </p>

      <h2>8. Speicherdauer</h2>
      <p>
        Wir speichern deine Daten, solange dein Konto besteht. Auf Wunsch löschen wir dein Konto
        samt aller Angaben.
      </p>

      <h2>9. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerruf erteilter Einwilligungen. Außerdem kannst du dich bei
        einer Datenschutz-Aufsichtsbehörde beschweren. Schreibe dazu eine E-Mail an die oben
        genannte Adresse.
      </p>
    </main>
  );
}
