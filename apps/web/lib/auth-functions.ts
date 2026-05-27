export type PublicAuthFunctionKey =
  | "signupInit"
  | "signupVerify"
  | "resendOtp"
  | "forgotInit"
  | "forgotReset";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";

export const publicAuthFunctionEndpoints: Record<PublicAuthFunctionKey, string> = {
  signupInit: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SIGNUP_INIT ?? `${endpoint}/functions/auth-signup-init/executions`,
  signupVerify: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_SIGNUP_VERIFY ?? `${endpoint}/functions/auth-signup-verify/executions`,
  resendOtp: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_RESEND_OTP ?? `${endpoint}/functions/auth-resend-otp/executions`,
  forgotInit: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_FORGOT_INIT ?? `${endpoint}/functions/auth-forgot-password-init/executions`,
  forgotReset: process.env.NEXT_PUBLIC_APPWRITE_FUNCTION_FORGOT_RESET ?? `${endpoint}/functions/auth-password-reset/executions`
};

export function functionIdFromEndpoint(functionEndpoint: string) {
  const match = functionEndpoint.match(/\/functions\/([^/]+)\/executions\/?$/);
  return match ? decodeURIComponent(match[1]) : functionEndpoint;
}
