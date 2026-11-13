export function readCredentials(formData: FormData, signingUp: boolean) {
  const emailValue = formData.get("email");
  const password = formData.get("password");
  if (typeof emailValue !== "string" || typeof password !== "string") return null;
  const email = emailValue.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  // Do not trim passwords: spaces can be intentional characters.
  if (password.length < (signingUp ? 8 : 1) || password.length > 1024) return null;
  return { email, password };
}

// Map known service failures to fixed, safe UI messages. Never echo raw errors
// or distinguish an existing email address from an unregistered address.
export function signupMessageCode(code?: string, status?: number) {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "signup-rate-limit";
    case "weak_password": return "signup-password-policy";
    case "email_address_invalid": return "signup-email-invalid";
    case "email_address_not_authorized": return "signup-email-delivery";
    case "signup_disabled":
    case "email_provider_disabled": return "signup-unavailable";
    case "captcha_failed": return "signup-captcha";
    case "request_timeout": return "signup-connection";
    default:
      if (status === 429) return "signup-rate-limit";
      if (status === 0) return "signup-connection";
      if (status === 401 || status === 403) return "signup-configuration";
      return "signup-failed";
  }
}
