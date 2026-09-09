/**
 * Extracts a human-readable error message from an unknown error object.
 *
 * @param {unknown} error - The caught error instance or primitive value.
 * @param {string} fallbackText - Localized fallback text if no message can be extracted.
 * @returns {string} The extracted or fallback error message.
 */
export const getErrorMessage = (error: unknown, fallbackText: string): string => {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackText;
};