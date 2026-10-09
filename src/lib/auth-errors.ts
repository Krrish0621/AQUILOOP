export function formatCognitoError(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";

  const errObj = error as { name?: string; message?: string };
  const name = errObj.name ?? "";
  const message = errObj.message ?? String(error);

  switch (name) {
    case "UserNotFoundException":
    case "NotAuthorizedException":
      if (message.toLowerCase().includes("disabled")) {
        return "This account has been disabled.";
      }
      return "Email or password is incorrect.";
    case "UserNotConfirmedException":
      return "Your email is not verified yet. Enter the verification code sent to your inbox.";
    case "UsernameExistsException":
      return "This email is already registered. Try signing in.";
    case "InvalidPasswordException":
      return "Use 8+ characters with uppercase, lowercase, a number, and a symbol.";
    case "CodeMismatchException":
      return "That verification code is incorrect. Try again.";
    case "ExpiredCodeException":
      return "That verification code has expired. Please request a new code.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "Too many attempts. Please wait and try again.";
    case "InvalidParameterException":
      if (message.toLowerCase().includes("email")) {
        return "Please enter a valid email address.";
      }
      if (message.toLowerCase().includes("password")) {
        return "Use 8+ characters with uppercase, lowercase, a number, and a symbol.";
      }
      return "Please check your details and try again.";
    case "UserAlreadyAuthenticatedException":
      return "Refreshing your session...";
    default:
      if (
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("fetch")
      ) {
        return "Unable to connect. Please check your connection and try again.";
      }
      return "Unable to complete your request. Please check your details and try again.";
  }
}
