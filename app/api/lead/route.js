
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

function sha256(value) {
  if (!value) return undefined;
  return crypto
    .createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

function normalizePhone(phone) {
  return String(phone).replace(/[^0-9]/g, '');
}

export async function POST(request) {
  try {
    const data = await request.json();
    const {
      firstName,
      lastName,
      phone,
      location,
      certificate,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      page_url,
    } = data;

    if (!firstName || !lastName || !phone || !location || !certificate) {
      return NextResponse.json(
        { ok: false, error: "Ma'lumotlar to'liq emas" },
        { status: 400 }
      );
    }

    const hasUtm =
      utm_source || utm_medium || utm_campaign || utm_content || utm_term;
    const utmText = hasUtm
      ? `\n\n📊 <b>Reklama manbasi:</b>` +
        (utm_source ? `\n  • source: ${utm_source}` : '') +
        (utm_medium ? `\n  • medium: ${utm_medium}` : '') +
        (utm_campaign ? `\n  • campaign: ${utm_campaign}` : '') +
        (utm_content ? `\n  • content: ${utm_content}` : '') +
        (utm_term ? `\n  • term: ${utm_term}` : '')
      : `\n\n📊 <b>Reklama manbasi:</b> to\u2019g\u2019ridan-to\u2019g\u2019ri (UTM yo\u2019q)`;

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const message =
        `🆕 <b>Yangi ariza — Avtotest Shavkat</b>\n\n` +
        `👤 <b>Ism:</b> ${firstName}\n` +
        `👥 <b>Familya:</b> ${lastName}\n` +
        `📞 <b>Telefon:</b> ${phone}\n` +
        `📍 <b>Yashash joyi:</b> ${location}\n` +
        `🎓 <b>Guvohnoma:</b> ${certificate}` +
        utmText +
        `\n\n🕐 ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`;

      try {
        await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: message,
              parse_mode: 'HTML',
            }),
          }
        );
      } catch (tgErr) {
        console.error('Telegram xatolik:', tgErr);
      }
    }

    const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const CAPI_TOKEN = process.env.META_ACCESS_TOKEN;
    const TEST_CODE = process.env.META_TEST_EVENT_CODE;

    if (PIXEL_ID && CAPI_TOKEN) {
      const clientIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined;
      const userAgent = request.headers.get('user-agent') || undefined;

      const eventPayload = {
        data: [
          {
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            action_source: 'website',
            ...(page_url ? { event_source_url: page_url } : {}),
            user_data: {
              ph: [sha256(normalizePhone(phone))],
              fn: [sha256(firstName)],
              ln: [sha256(lastName)],
              ...(clientIp ? { client_ip_address: clientIp } : {}),
              ...(userAgent ? { client_user_agent: userAgent } : {}),
            },
            custom_data: {
              content_name: 'Prava tayyorlov royxat',
              certificate: certificate,
              ...(utm_source ? { utm_source } : {}),
              ...(utm_medium ? { utm_medium } : {}),
              ...(utm_campaign ? { utm_campaign } : {}),
              ...(utm_content ? { utm_content } : {}),
              ...(utm_term ? { utm_term } : {}),
            },
          },
        ],
        ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
      };

      try {
        await fetch(
          `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventPayload),
          }
        );
      } catch (capiErr) {
        console.error('Meta CAPI xatolik:', capiErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Lead API xatolik:', err);
    return NextResponse.json(
      { ok: false, error: 'Server xatolik' },
      { status: 500 }
    );
  }
}
