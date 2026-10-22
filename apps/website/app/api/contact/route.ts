export const runtime = "nodejs";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeInput(value: string, max = 2000) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactPayload;
    const name = sanitizeInput(body.name ?? "", 120);
    const email = sanitizeInput(body.email ?? "", 180);
    const phone = sanitizeInput(body.phone ?? "", 40);
    const subject = sanitizeInput(body.subject ?? "", 180);
    const message = sanitizeInput(body.message ?? "", 4000);

    if (!name || !email || !phone || !subject || !message) {
      return Response.json(
        { error: "Name, email, phone, subject, and message are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const fallbackAdminEmails = [
      "info@entrustafrica.com",
    ];
    const adminRecipients = (process.env.ADMIN_EMAIL ?? fallbackAdminEmails.join(", "))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const apiKey =
      process.env.RESEND_API_KEY ?? process.env.EMAIL_API_KEY ?? process.env.CONTACT_API_KEY;
    const fromEmail = process.env.CONTACT_FROM_EMAIL ?? "onboarding@resend.dev";
    const isDev = process.env.NODE_ENV !== "production";
    // Only treat as placeholder if the env variable is not set or is a known placeholder value
    const looksLikePlaceholder =
      !apiKey || apiKey === "xxxxxxxx" || apiKey.toLowerCase() === "your_api_key";

    if (!apiKey || looksLikePlaceholder) {
      if (isDev) {
        // Dev fallback: log the payload for local testing, but do not report delivery success.
        console.warn("Contact form fallback mode: RESEND_API_KEY missing or placeholder.");
        console.info("Contact submission (not delivered):", {
          to: adminRecipients,
          name,
          email,
          phone,
          subject,
          message,
        });
      }

      return Response.json(
        {
          error:
            "Email not sent. Add a real RESEND_API_KEY (not placeholder) and restart the server.",
        },
        { status: 503 },
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Entrust Africa <${fromEmail}>`,
        to: adminRecipients,
        reply_to: email,
        subject: `New website inquiry: ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nSubject: ${subject}\n\n${message}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2 style="margin: 0 0 16px;">New website inquiry</h2>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Phone:</strong> ${safePhone}</p>
            <p><strong>Subject:</strong> ${safeSubject}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorPayload = await emailResponse.text();
      let providerMessage = "";
      try {
        const parsed = JSON.parse(errorPayload) as { message?: string };
        providerMessage = parsed.message ?? "";
      } catch {
        providerMessage = errorPayload;
      }
      console.error("Contact API email error:", providerMessage || "Email provider error");
      return Response.json(
        {
          error: providerMessage
            ? `Email delivery failed: ${providerMessage}`
            : "We could not deliver your message. Check API key, sender verification, and restart server.",
        },
        { status: 502 },
      );
    }

    return Response.json({ message: "Your message has been sent successfully." });
  } catch (error) {
    console.error("Contact form error:", error);
    return Response.json(
      { error: "We could not send your message right now. Please try again later." },
      { status: 500 },
    );
  }
}
