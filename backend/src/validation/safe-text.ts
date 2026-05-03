const unsafeTextPattern = /<|>|javascript\s*:/i;

export const safeTextValidationMessage = 'HTML vagy JavaScript-szeru tartalom nem engedelyezett.';

export const isSafeText = (value: string) => !unsafeTextPattern.test(value);