// Maps Supabase Auth errors to Portuguese messages. Messages never reveal whether an e-mail
// is registered (no account enumeration).
export function authErrorMessage(error: { code?: string; status?: number } | null): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    case "weak_password":
      return "Escolha uma senha mais forte: pelo menos 10 caracteres, com letras e números.";
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
      return "Código incorreto ou vencido. Confira se o horário do celular está certo e use o código atual.";
    case "session_not_found":
    case "refresh_token_not_found":
      return "Sua sessão expirou. Entre novamente.";
    default:
      return error?.status === 429
        ? "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."
        : "Não foi possível concluir agora. Tente de novo em instantes.";
  }
}

export const PASSWORD_RULE = "Pelo menos 10 caracteres, com letras e números.";

export function isStrongPassword(value: string) {
  return value.length >= 10 && value.length <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
