export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.";

export function validateSignupEmail(email: string): string | null {
  const clean = email.trim().toLowerCase();
  if (!clean || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(clean)) {
    return "Please enter a valid email address.";
  }
  return null;
}

export function validateSignupPassword(password: string): string | null {
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return PASSWORD_POLICY_MESSAGE;
  }
  return null;
}

/**
 * Logs authentication diagnostics without ever logging passwords, OTPs, tokens, or secrets.
 */
export function logAuthDiagnostic(
  context: string,
  error: unknown,
  meta?: { email?: string; role?: string }
): void {
  const errObj = (error ?? {}) as {
    name?: string;
    message?: string;
    recoverySuggestion?: string;
  };
  const safePayload = {
    context,
    name: errObj.name ?? "UnknownAuthError",
    message: errObj.message ?? String(error),
    recoverySuggestion: errObj.recoverySuggestion,
    email: meta?.email,
    role: meta?.role,
  };
  console.warn("[AQUILOOP Auth]", safePayload);
}

export function formatCognitoError(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  const errObj = error as { name?: string; message?: string };
  const name = errObj.name ?? "";
  const message = errObj.message ?? String(error);
  const lowerMsg = message.toLowerCase();

  switch (name) {
    case "UserNotFoundException":
      return "No account found for this email address. Please check the email or create an account.";
    case "NotAuthorizedException":
      if (lowerMsg.includes("disabled")) {
        return "This account has been disabled.";
      }
      if (lowerMsg.includes("already confirmed")) {
        return "This email is already verified. Please sign in with your password.";
      }
      return "Email or password is incorrect.";
    case "UserNotConfirmedException":
      return "Your email is not verified yet. Enter the 6-digit verification code sent to your inbox, or click 'Resend verification code'.";
    case "UsernameExistsException":
      return "An account with this email already exists. Please sign in instead.";
    case "InvalidPasswordException":
      return PASSWORD_POLICY_MESSAGE;
    case "CodeDeliveryFailureException":
      return "Verification email delivery failed. Please check that your email address can receive mail and try again.";
    case "CodeMismatchException":
      return "That verification code is incorrect. Please check the 6-digit code and try again.";
    case "ExpiredCodeException":
      return "That verification code has expired. Please click 'Resend verification code' to request a new code.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "Email sending or request rate limit reached. Please wait a few minutes before trying again.";
    case "InvalidParameterException":
      if (lowerMsg.includes("already confirmed")) {
        return "This email is already verified. Please sign in with your password.";
      }
      if (lowerMsg.includes("email")) {
        return "Please enter a valid email address.";
      }
      if (lowerMsg.includes("password")) {
        return PASSWORD_POLICY_MESSAGE;
      }
      if (lowerMsg.includes("code") || lowerMsg.includes("confirmation")) {
        return "Please enter a valid 6-digit verification code.";
      }
      if (lowerMsg.includes("delivery")) {
        return "Verification email delivery failed. Please check your email address and try again.";
      }
      if (lowerMsg.includes("attribute") || lowerMsg.includes("schema")) {
        return "Account registration configuration error: unsupported user attribute.";
      }
      return "Invalid account details provided. Please check your email and password format.";
    case "UserAlreadyAuthenticatedException":
      return "Refreshing your session...";
    default:
      if (lowerMsg.includes("already confirmed")) {
        return "This email is already verified. Please sign in with your password.";
      }
      if (lowerMsg.includes("delivery")) {
        return "Verification email delivery failed. Please check your email address and try again.";
      }
      if (lowerMsg.includes("network") || lowerMsg.includes("fetch")) {
        return "Unable to connect. Please check your connection and try again.";
      }
      return "Unable to complete your request. Please check your details and try again.";
  }
}

