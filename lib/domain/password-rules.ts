/**
 * The rule a password has to satisfy, stated once. `validatePassword` in `lib/services/password-link.ts` enforces it
 * and both password forms describe it to the user, so the sentence someone reads and the check they have to pass
 * cannot drift apart.
 */

export const minimumPasswordLength = 15;
export const maximumPasswordLength = 128;

/** The printable ASCII punctuation, listed for the forms and matched by the pattern below — the two belong together. */
export const allowedSpecialCharacters = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
export const specialCharacterPattern = /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/;

export const passwordRuleDescription = `${minimumPasswordLength} bis ${maximumPasswordLength} Zeichen, darunter mindestens ein Großbuchstabe, eine Ziffer und ein Sonderzeichen.`;
