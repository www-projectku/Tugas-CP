import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www-projectku.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Metode tidak diizinkan." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!url || !anonKey || !serviceKey || !authHeader) {
      return respond({ error: "Konfigurasi autentikasi belum lengkap." }, 500);
    }

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) return respond({ error: "Sesi login tidak valid." }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: callerProfileError } = await admin
      .from("user_profiles")
      .select("id, role, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return respond({ error: "Hanya Administrator aktif yang dapat mengelola pengguna." }, 403);
    }

    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "list") {
      const { data, error } = await admin
        .from("user_profiles")
        .select("id, username, full_name, role, is_active, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const users = await Promise.all((data || []).map(async (profile) => {
        const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
        return {
          id: profile.id,
          username: profile.username,
          name: profile.full_name,
          email: authUser.user?.email || "",
          role: profile.role,
          is_active: profile.is_active,
          created_at: profile.created_at,
        };
      }));
      return respond({ data: users });
    }

    if (action === "create") {
      const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
      const fullName = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const role = body.role === "admin" ? "admin" : "petugas";
      if (!username || username.length > 50 || !fullName || !email || !password || password.length < 6) {
        return respond({ error: "Lengkapi data pengguna. Password minimal 6 karakter." }, 400);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        return respond({ error: createError?.message || "Gagal membuat akun autentikasi." }, 400);
      }

      const { data: profile, error: profileError } = await admin
        .from("user_profiles")
        .insert({
          id: created.user.id,
          username,
          full_name: fullName,
          role,
          is_active: true,
        })
        .select("id, username, full_name, role, is_active, created_at")
        .single();

      if (profileError || !profile) {
        await admin.auth.admin.deleteUser(created.user.id);
        return respond({ error: profileError?.message || "Gagal menyimpan profil pengguna." }, 400);
      }

      return respond({
        message: "Pengguna berhasil dibuat di Supabase.",
        data: {
          id: profile.id, username: profile.username, name: profile.full_name,
          email, role: profile.role, is_active: profile.is_active, created_at: profile.created_at,
        },
      });
    }

    const targetId = typeof body.id === "string" ? body.id : "";
    if (!targetId) return respond({ error: "ID pengguna tidak valid." }, 400);
    if (targetId === authData.user.id && ["toggle", "delete"].includes(action)) {
      return respond({ error: "Akun Administrator yang sedang digunakan tidak dapat dinonaktifkan atau dihapus." }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from("user_profiles").select("id, role, is_active").eq("id", targetId).maybeSingle();
    if (targetError || !target) return respond({ error: "Pengguna tidak ditemukan." }, 404);

    if (action === "toggle") {
      if (target.role === "admin" && target.is_active) {
        const { count, error } = await admin.from("user_profiles")
          .select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
        if (error) throw error;
        if ((count || 0) <= 1) return respond({ error: "Minimal harus ada satu Administrator aktif." }, 400);
      }
      const { error } = await admin.from("user_profiles")
        .update({ is_active: !target.is_active, updated_at: new Date().toISOString() }).eq("id", targetId);
      if (error) throw error;
      return respond({ message: "Status pengguna berhasil diperbarui." });
    }

    if (action === "delete") {
      if (target.role === "admin" && target.is_active) {
        const { count, error } = await admin.from("user_profiles")
          .select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
        if (error) throw error;
        if ((count || 0) <= 1) return respond({ error: "Administrator aktif terakhir tidak boleh dihapus." }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) throw error;
      return respond({ message: "Pengguna berhasil dihapus dari Supabase." });
    }

    if (action === "reset_password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 6) return respond({ error: "Password minimal 6 karakter." }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) throw error;
      return respond({ message: "Password berhasil diperbarui di Supabase." });
    }

    return respond({ error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("admin-user-management:", error);
    return respond({ error: "Terjadi kesalahan saat mengelola pengguna." }, 500);
  }
});
