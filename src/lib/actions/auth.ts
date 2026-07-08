"use server";

import { db } from "@/lib/db";
import { setSession, clearSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginWithFirebase(idToken: string, googleAccessToken?: string) {
  const { adminAuth } = await import("@/lib/firebase-admin");

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const { uid, email, name } = decoded;

    if (!email) throw new Error("Email requerido");

    const picture = decoded.picture as string | undefined;

    let user = await db.user.findUnique({ where: { firebaseUid: uid } });
    if (!user) {
      user = await db.user.create({
        data: {
          firebaseUid: uid,
          email,
          name: name ?? email.split("@")[0],
          image: picture,
          googleAccessToken,
          googleCalendarConnected: !!googleAccessToken,
        },
      });
    } else {
      const updates: Record<string, string | boolean> = {};
      if (name && user.name !== name) updates.name = name;
      if (picture && user.image !== picture) updates.image = picture;
      if (googleAccessToken) {
        updates.googleAccessToken = googleAccessToken;
        updates.googleCalendarConnected = true;
      }
      if (Object.keys(updates).length > 0) {
        user = await db.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    }

    await setSession({ id: user.id, name: user.name, email: user.email, image: user.image ?? undefined, calendarConnected: user.googleCalendarConnected });
    return { success: true, calendarConnected: user.googleCalendarConnected };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("loginWithFirebase error:", msg);
    return { error: `Error al autenticar con Google: ${msg}` };
  }
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
