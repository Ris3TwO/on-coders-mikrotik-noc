import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./errors";

describe("errors utility: getErrorMessage", () => {
  const fallback = "Fallback error message";

  it("should return the string directly when error is a non-empty string", () => {
    expect(getErrorMessage("Tauri IPC connection failed", fallback)).toBe(
      "Tauri IPC connection failed"
    );
  });

  it("should return fallback when error is an empty or whitespace string", () => {
    expect(getErrorMessage("", fallback)).toBe(fallback);
    expect(getErrorMessage("   ", fallback)).toBe(fallback);
  });

  it("should extract message from standard Error instance", () => {
    const error = new Error("Network timeout");
    expect(getErrorMessage(error, fallback)).toBe("Network timeout");
  });

  it("should extract message from custom object with a string message property", () => {
    const customError = { message: "Unauthorized access", code: 401 };
    expect(getErrorMessage(customError, fallback)).toBe("Unauthorized access");
  });

  it("should return fallback when object message property is not a string or is empty", () => {
    expect(getErrorMessage({ message: 123 }, fallback)).toBe(fallback);
    expect(getErrorMessage({ message: "" }, fallback)).toBe(fallback);
  });

  it("should return fallback when error is null, undefined, or unknown primitive", () => {
    expect(getErrorMessage(null, fallback)).toBe(fallback);
    expect(getErrorMessage(undefined, fallback)).toBe(fallback);
    expect(getErrorMessage(404, fallback)).toBe(fallback);
    expect(getErrorMessage(true, fallback)).toBe(fallback);
  });
});