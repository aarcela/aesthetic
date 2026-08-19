export const PATIENT_SEX_OPTIONS = [
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
] as const;

export const PATIENT_MARITAL_OPTIONS = [
  { value: 'SINGLE', label: 'Soltero/a' },
  { value: 'MARRIED', label: 'Casado/a' },
  { value: 'COMMON_LAW', label: 'Unión libre' },
  { value: 'DIVORCED', label: 'Divorciado/a' },
  { value: 'WIDOWED', label: 'Viudo/a' },
] as const;

export const PATIENT_SKIN_BIOTYPE_OPTIONS = [
  { value: 'DRY', label: 'Seco' },
  { value: 'OILY', label: 'Graso' },
  { value: 'COMBINATION', label: 'Mixto' },
  { value: 'SENSITIVE', label: 'Sensible' },
  { value: 'NORMAL', label: 'Normal' },
] as const;

export const PATIENT_PHOTOTYPE_OPTIONS = [
  { value: 'I', label: 'I — muy claro' },
  { value: 'II', label: 'II — claro' },
  { value: 'III', label: 'III — medio' },
  { value: 'IV', label: 'IV — moreno claro' },
  { value: 'V', label: 'V — moreno' },
  { value: 'VI', label: 'VI — oscuro' },
] as const;

export type HomeRoutineAmValues = {
  cleanser: string;
  toner: string;
  eyeContour: string;
  serum: string;
  moisturizer: string;
  sunscreen: string;
  lipProtection: string;
  notes: string;
};

export type HomeRoutinePmValues = {
  cleanser: string;
  toner: string;
  eyeContour: string;
  serum: string;
  moisturizer: string;
  lipProtection: string;
  doubleCleanser: string;
  notes: string;
};

export type PatientClinicalFormValues = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  nationalId: string;
  dateOfBirth: string;
  sex: '' | 'FEMALE' | 'MALE';
  maritalStatus: '' | 'SINGLE' | 'MARRIED' | 'COMMON_LAW' | 'DIVORCED' | 'WIDOWED';
  occupation: string;
  consultationReason: string;
  diagnosis: string;
  physicalActivity: string;
  diet: string;
  sleep: string;
  aestheticHistory: string;
  illnessNotes: string;
  diabetes: boolean;
  insulinResistance: boolean;
  heartProblems: boolean;
  smokes: boolean;
  drinksAlcohol: boolean;
  medicationAllergy: string;
  currentMedications: string;
  skinBiotype: '' | 'DRY' | 'OILY' | 'COMBINATION' | 'SENSITIVE' | 'NORMAL';
  phototype: '' | 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  aging: string;
  lesions: string;
  scars: string;
  routineAm: HomeRoutineAmValues;
  routinePm: HomeRoutinePmValues;
};

const EMPTY_ROUTINE_AM: HomeRoutineAmValues = {
  cleanser: '',
  toner: '',
  eyeContour: '',
  serum: '',
  moisturizer: '',
  sunscreen: '',
  lipProtection: '',
  notes: '',
};

const EMPTY_ROUTINE_PM: HomeRoutinePmValues = {
  cleanser: '',
  toner: '',
  eyeContour: '',
  serum: '',
  moisturizer: '',
  lipProtection: '',
  doubleCleanser: '',
  notes: '',
};

export const EMPTY_PATIENT_CLINICAL_FORM: PatientClinicalFormValues = {
  firstName: '',
  lastName: '',
  phoneNumber: '+58',
  nationalId: '',
  dateOfBirth: '',
  sex: '',
  maritalStatus: '',
  occupation: '',
  consultationReason: '',
  diagnosis: '',
  physicalActivity: '',
  diet: '',
  sleep: '',
  aestheticHistory: '',
  illnessNotes: '',
  diabetes: false,
  insulinResistance: false,
  heartProblems: false,
  smokes: false,
  drinksAlcohol: false,
  medicationAllergy: '',
  currentMedications: '',
  skinBiotype: '',
  phototype: '',
  aging: '',
  lesions: '',
  scars: '',
  routineAm: EMPTY_ROUTINE_AM,
  routinePm: EMPTY_ROUTINE_PM,
};

export function emptyPatientForm(phoneNumber = '+58'): PatientClinicalFormValues {
  return {
    ...EMPTY_PATIENT_CLINICAL_FORM,
    phoneNumber,
    routineAm: { ...EMPTY_ROUTINE_AM },
    routinePm: { ...EMPTY_ROUTINE_PM },
  };
}

export function ageFromBirthDate(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const isoDate = dateOfBirth.slice(0, 10);
  const birth = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

export function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

function compactRoutine(routine: Record<string, string>): Record<string, string> | undefined {
  const compacted = Object.fromEntries(
    Object.entries(routine).flatMap(([key, value]) => {
      const trimmed = value.trim();
      return trimmed ? [[key, trimmed]] : [];
    }),
  );
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function optionalText(value: string, clearEmpty: boolean): string | undefined {
  const trimmed = value.trim();
  if (clearEmpty) return trimmed;
  return trimmed ? trimmed : undefined;
}

export function patientFormToPayload(
  values: PatientClinicalFormValues,
  opts?: { clearEmpty?: boolean },
) {
  const clearEmpty = Boolean(opts?.clearEmpty);
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phoneNumber: values.phoneNumber.trim(),
    nationalId: optionalText(values.nationalId, clearEmpty),
    dateOfBirth: optionalText(values.dateOfBirth, clearEmpty),
    sex: clearEmpty ? values.sex : values.sex || undefined,
    maritalStatus: clearEmpty ? values.maritalStatus : values.maritalStatus || undefined,
    occupation: optionalText(values.occupation, clearEmpty),
    consultationReason: optionalText(values.consultationReason, clearEmpty),
    diagnosis: optionalText(values.diagnosis, clearEmpty),
    physicalActivity: optionalText(values.physicalActivity, clearEmpty),
    diet: optionalText(values.diet, clearEmpty),
    sleep: optionalText(values.sleep, clearEmpty),
    aestheticHistory: optionalText(values.aestheticHistory, clearEmpty),
    illnessNotes: optionalText(values.illnessNotes, clearEmpty),
    diabetes: values.diabetes,
    insulinResistance: values.insulinResistance,
    heartProblems: values.heartProblems,
    smokes: values.smokes,
    drinksAlcohol: values.drinksAlcohol,
    medicationAllergy: optionalText(values.medicationAllergy, clearEmpty),
    currentMedications: optionalText(values.currentMedications, clearEmpty),
    skinBiotype: clearEmpty ? values.skinBiotype : values.skinBiotype || undefined,
    phototype: clearEmpty ? values.phototype : values.phototype || undefined,
    aging: optionalText(values.aging, clearEmpty),
    lesions: optionalText(values.lesions, clearEmpty),
    scars: optionalText(values.scars, clearEmpty),
    homeRoutineAm: compactRoutine(values.routineAm) ?? (clearEmpty ? {} : undefined),
    homeRoutinePm: compactRoutine(values.routinePm) ?? (clearEmpty ? {} : undefined),
  };
}

export type PatientClinicalRecord = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  nationalId?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  consultationReason?: string | null;
  diagnosis?: string | null;
  physicalActivity?: string | null;
  diet?: string | null;
  sleep?: string | null;
  aestheticHistory?: string | null;
  illnessNotes?: string | null;
  diabetes?: boolean | null;
  insulinResistance?: boolean | null;
  heartProblems?: boolean | null;
  smokes?: boolean | null;
  drinksAlcohol?: boolean | null;
  medicationAllergy?: string | null;
  currentMedications?: string | null;
  skinBiotype?: string | null;
  phototype?: string | null;
  aging?: string | null;
  lesions?: string | null;
  scars?: string | null;
  homeRoutineAm?: Record<string, string> | null;
  homeRoutinePm?: Record<string, string> | null;
};

export function patientRecordToForm(patient: PatientClinicalRecord): PatientClinicalFormValues {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    phoneNumber: patient.phoneNumber,
    nationalId: patient.nationalId ?? '',
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '',
    sex: (patient.sex as PatientClinicalFormValues['sex']) ?? '',
    maritalStatus: (patient.maritalStatus as PatientClinicalFormValues['maritalStatus']) ?? '',
    occupation: patient.occupation ?? '',
    consultationReason: patient.consultationReason ?? '',
    diagnosis: patient.diagnosis ?? '',
    physicalActivity: patient.physicalActivity ?? '',
    diet: patient.diet ?? '',
    sleep: patient.sleep ?? '',
    aestheticHistory: patient.aestheticHistory ?? '',
    illnessNotes: patient.illnessNotes ?? '',
    diabetes: Boolean(patient.diabetes),
    insulinResistance: Boolean(patient.insulinResistance),
    heartProblems: Boolean(patient.heartProblems),
    smokes: Boolean(patient.smokes),
    drinksAlcohol: Boolean(patient.drinksAlcohol),
    medicationAllergy: patient.medicationAllergy ?? '',
    currentMedications: patient.currentMedications ?? '',
    skinBiotype: (patient.skinBiotype as PatientClinicalFormValues['skinBiotype']) ?? '',
    phototype: (patient.phototype as PatientClinicalFormValues['phototype']) ?? '',
    aging: patient.aging ?? '',
    lesions: patient.lesions ?? '',
    scars: patient.scars ?? '',
    routineAm: { ...EMPTY_ROUTINE_AM, ...(patient.homeRoutineAm ?? {}) },
    routinePm: { ...EMPTY_ROUTINE_PM, ...(patient.homeRoutinePm ?? {}) },
  };
}
