export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(value: string, max: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; source?: string };
    const email = sanitize(body.email ?? "", 180);
    const source = sanitize(body.source ?? "unknown", 80);

    if (!email || !isValidEmail(email)) {
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
        console.info("Newsletter signup (not delivered):", { email, source });
        return Response.json({
          message: "Thanks — we received your email (development mode; configure RESEND_API_KEY to send).",
        });
      }
      return Response.json(
        { error: "Newsletter is not configured yet. Please try again later or use the contact form." },
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
        subject: `Newsletter signup (${source})`,
        text: `New newsletter request\nEmail: ${email}\nSource: ${source}\n`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: text || "Email delivery failed." }, { status: 502 });
    }

    return Response.json({
      message: "Thanks — you are on the list. Check your inbox for confirmation soon.",
    });
  } catch (e) {
    console.error("Newsletter API error:", e);
    return Response.json({ error: "Could not subscribe right now." }, { status: 500 });
  }
}
