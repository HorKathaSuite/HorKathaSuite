export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const data = await request.json();

      // 🔥 1. OTP BHEJNE KA ROUTE
      if (path === "/sendTrialOtp") {
        const { name, email } = data;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: 'Hor Katha <onboarding@resend.dev>',
            to: email,
            subject: 'Your OTP Code',
            html: `<p>Namaste ${name},</p><p>Aapka OTP hai: <b>${otp}</b></p>`
          })
        });

        if (!resendRes.ok) throw new Error(await resendRes.text());

        return new Response(JSON.stringify({ success: true, message: "OTP sent!", debug_otp: otp }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 🔥 2. OTP VERIFY KARNE KA ROUTE
      if (path === "/verifyTrialOtp") {
        return new Response(JSON.stringify({ success: true, message: "Verified!" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Route Not Found" }), { status: 404, headers: corsHeaders });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  },
};