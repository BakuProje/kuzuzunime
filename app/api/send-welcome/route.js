import { NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request) {
  try {
    const { email, username } = await request.json();

    if (!email || !username) {
      return NextResponse.json({ success: false, error: 'Email and username are required' }, { status: 400 });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Zunime <zunime@kuzuroken.site>',
        to: [email],
        subject: 'Selamat Datang di ZUNIME! 🍿',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #050505; color: #ffffff; border-radius: 12px; border: 1px solid #222;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #ff0000; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 1px;">ZUNIME</h1>
              <p style="color: #aaa; margin: 5px 0 0 0; font-size: 14px;">Streaming Anime Terlengkap & Tercepat</p>
            </div>
            <div style="background-color: #111; padding: 25px; border-radius: 8px; border: 1px solid #333;">
              <h2 style="margin-top: 0; color: #fff;">Halo, ${username}!</h2>
              <p style="line-height: 1.6; color: #ddd;">Selamat datang di ZUNIME! Akun Anda telah berhasil terdaftar dan sekarang Anda dapat menikmati sinkronisasi riwayat nonton, daftar favorit, dan fitur premium lainnya secara gratis.</p>
              <p style="line-height: 1.6; color: #ddd;">Mulai jelajahi anime terbaru dan streaming dengan lancar sekarang juga!</p>
              <div style="text-align: center; margin-top: 30px;">
                <a href="http://localhost:3000" style="background-color: #ff0000; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: bold; border-radius: 8px; display: inline-block;">Mulai Nonton</a>
              </div>
            </div>
            <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #666;">
              <p style="margin: 0;">Email ini dikirim secara otomatis oleh sistem ZUNIME.</p>
            </div>
          </div>
        `
      })
    });

    const data = await resendResponse.json();
    console.log('Resend email API response:', data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
