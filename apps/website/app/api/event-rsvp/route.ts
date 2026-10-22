export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(value: string, max: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventName?: string;
      name?: string;
      email?: string;
      phone?: string;
      notes?: string;
    };
    const eventName = sanitize(body.eventName ?? "", 200);
    const name = sanitize(body.name ?? "", 120);
    const email = sanitize(body.email ?? "", 180);
    const phone = sanitize(body.phone ?? "", 40);
    const notes = sanitize(body.notes ?? "", 2000);

    if (!eventName || !name || !email) {
      return Response.json(
        { error: "Event, name, and email are required." },
        { status: 400 },
      );
    }
    if (!isValidEmail(email)) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const apiKey =
      process.env.RESEND_API_KEY ?? process.env.EMAIL_API_KEY ?? process.env.CONTACT_API_KEY;
    const fromEmail = process.env.CONTACT_FROM_EMAIL ?? "onboarding@resend.dev";
    const adminRecipients = (process.env.ADMIN_EMAIL ?? "thomas@entrustafrica.com")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const isDev = process.env.NODE_ENV !== "production";
    const looksBad = apiKey?.includes("xxxxxxxx") || apiKey?.toLowerCase().includes("your_api_key");

    if (!apiKey || looksBad) {
      if (isDev) {
        console.info("Event RSVP (not delivered):", { eventName, name, email, phone, notes });
        return Response.json({
          message:
            "Registration received (development mode). Configure RESEND_API_KEY for email confirmations in production.",
        });
      }
      return Response.json(
        { error: "Registration is not fully configured. Please contact us directly." },
        { status: 503 },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Entrust Africa <${fromEmail}>`,
        to: adminRecipients,
        reply_to: email,
        subject: `Event RSVP: ${eventName}`,
        text: `Event: ${eventName}\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "—"}\nNotes: ${notes || "—"}\n`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: text || "Could not send RSVP." }, { status: 502 });
    }

    return Response.json({
      message:
        "Registration received. You will get a confirmation email shortly with next steps.",
    });
  } catch (e) {
    console.error("Event RSVP error:", e);
    return Response.json({ error: "Could not submit RSVP right now." }, { status: 500 });
  }
}
