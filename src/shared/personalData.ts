export type PersonalField = 'full_name' | 'email' | 'address' | 'birth_date';

export const PERSONAL_FIELDS: { key: PersonalField; label: string }[] = [
  { key: 'full_name', label: 'Vollständiger Name' },
  { key: 'email', label: 'E-Mail-Adresse' },
  { key: 'address', label: 'Adresse' },
  { key: 'birth_date', label: 'Geburtsdatum' },
];

export const personalFieldLabel = (field: PersonalField) =>
  PERSONAL_FIELDS.find((entry) => entry.key === field)?.label ?? field;

interface PersonalValues {
  full_name: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null;
}

// Spiegelt die Prüfung in der Datenbank (is_plausible_personal_value).
export function isPlausible(field: PersonalField, values: PersonalValues) {
  const value = values[field]?.trim() ?? '';
  switch (field) {
    case 'full_name':
      return (
        value.length >= 3 &&
        value.length <= 120 &&
        /^\p{L}[\p{L}'.-]*(\s+\p{L}[\p{L}'.-]*)+$/u.test(value)
      );
    case 'email':
      return value.length <= 254 && /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(value);
    case 'address':
      return value.length >= 8 && value.length <= 250 && /\p{L}/u.test(value) && /\d/.test(value);
    case 'birth_date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      return value >= '1900-01-01' && value <= todayIso;
    }
  }
}

export function missingPersonalFields(required: PersonalField[], values: PersonalValues) {
  return required.filter((field) => !isPlausible(field, values));
}
