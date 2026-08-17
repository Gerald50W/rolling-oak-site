// Vercel serverless function: POST /api/contact
// Receives the site's quote/contact form and emails it via Resend
// (https://resend.com). Requires the RESEND_API_KEY environment
// variable to be set in the Vercel project settings.

const TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'rollingoakservices@gmail.com';
// Must be an address/domain verified in your Resend account.
// The onboarding sandbox sender below works immediately for testing,
// but only delivers to the email you signed up to Resend with.
// Once you verify your own domain in Resend, switch this to something
// like "Rolling Oaks Trucking <quotes@rollingoaktrucking.com>".
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'Rolling Oaks Website <onboarding@resend.dev>';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async (req, res) => {
  // Basic CORS/method guard
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Server not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  body = body || {};

  const { Name = '', Phone = '', Email = '', Reason = '', Details = '' } = body;

  // Minimal server-side validation
  if (!Name.trim() || !Phone.trim() || !Email.trim()) {
    return res.status(400).json({ error: 'Name, phone, and email are required' });
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(Email.trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const subject = `New website inquiry: ${Reason || 'General'} — ${Name}`;
  const html = `
    <h2>New inquiry from rollingoaktrucking.com</h2>
    <p><strong>Name:</strong> ${escapeHtml(Name)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(Phone)}</p>
    <p><strong>Email:</strong> ${escapeHtml(Email)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(Reason)}</p>
    <p><strong>Details:</strong><br>${escapeHtml(Details).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: Email.trim(),
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend API error:', resendRes.status, errText);
      return res.status(502).json({ error: 'Failed to send message' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error sending email:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
};
