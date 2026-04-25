import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

const errorMessages: Record<string, string> = {
  missing: "User ID and password are required.",
  invalid: "Invalid login details.",
  server: "Login server could not reach MongoDB. Please check internet or MongoDB Atlas access."
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  return <LoginForm error={params?.error ? errorMessages[params.error] : ""} />;
}
