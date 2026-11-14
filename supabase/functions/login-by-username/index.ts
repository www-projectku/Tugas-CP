import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www-projectku.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metode tidak diizinkan." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Konfigurasi Supabase Edge Function belum lengkap.");
      return jsonResponse({ error: "Layanan autentikasi belum dikonfigurasi." }, 500);
    }

    const body = await req.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password || username.length > 100 || password.length > 256) {
      return jsonResponse({ error: "Username atau kata sandi tidak sesuai." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, username, full_name, role, is_active")
      .eq("username", username)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return jsonResponse({ error: "Username atau kata sandi tidak sesuai." }, 401);
    }

    const { data: authUserData, error: authUserError } =
      await adminClient.auth.admin.getUserById(profile.id);

    const email = authUserData.user?.email;
    if (authUserError || !email) {
      return jsonResponse({ error: "Username atau kata sandi tidak sesuai." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: signInData, error: signInError } =
      await authClient.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.session || !signInData.user) {
      return jsonResponse({ error: "Username atau kata sandi tidak sesuai." }, 401);
    }

    return jsonResponse({
      session: signInData.session,
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.full_name,
        email,
        role: profile.role,
        is_active: profile.is_active,
      },
    });
  } catch (error) {
    console.error("Kesalahan login-by-username:", error);
    return jsonResponse({ error: "Terjadi kesalahan saat memproses login." }, 500);
  }
});
