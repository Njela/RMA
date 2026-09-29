"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { staffFetch } from "@/lib/api";

export async function decide(formData: FormData) {
  const id = String(formData.get("id"));
  const serial = String(formData.get("serial") ?? "").trim();
  let error: string | null = null;
  try {
    await staffFetch(`/tickets/${id}/decision`, {
      method: "POST",
      headers: { "X-Staff-User": "web" },
      body: JSON.stringify({
        action: String(formData.get("action")), note: String(formData.get("note") ?? ""), serial_number: serial || null,
      }),
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Request failed";
  }
  revalidatePath("/board");
  redirect(error ? `/board/${id}?error=${encodeURIComponent(error)}` : `/board/${id}`);
}
