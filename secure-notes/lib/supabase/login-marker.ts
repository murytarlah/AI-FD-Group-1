import "server-only";
import { cookies } from "next/headers";
import { IDLE_SESSION_COOKIE } from "@/lib/idle-session";

export async function startIdleSession() {
  // Non-secret marker only. It does not authorise any server operation.
  (await cookies()).set(IDLE_SESSION_COOKIE, `${Date.now()}.${crypto.randomUUID()}`, {
    path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production",
  });
}
