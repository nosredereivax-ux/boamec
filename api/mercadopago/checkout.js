const APP_URL = "https://boamec.boasolucoesdigitais.com.br";
const PLAN_DETAILS = {
  mensal: { title: "BOAMEC — Plano Mensal", unit_price: 97 },
  anual: { title: "BOAMEC — Plano Anual", unit_price: 697 },
};

function send(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Método não permitido." });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) {
    return send(res, 500, { error: "Configuração de cobrança indisponível." });
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return send(res, 401, { error: "Autenticação necessária." });

  const { empresa_id: empresaId, plano } = req.body || {};
  if (typeof empresaId !== "string" || !empresaId || !PLAN_DETAILS[plano]) {
    return send(res, 400, { error: "Empresa ou plano inválido." });
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!authResponse.ok) return send(res, 401, { error: "Sessão inválida ou expirada." });
    const user = await authResponse.json();

    const profileUrl = new URL(`${supabaseUrl}/rest/v1/usuarios`);
    profileUrl.searchParams.set("id", `eq.${user.id}`);
    profileUrl.searchParams.set("select", "empresa_id,email");
    const profileResponse = await fetch(profileUrl, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!profileResponse.ok) return send(res, 502, { error: "Não foi possível validar a empresa." });
    const profiles = await profileResponse.json();
    const profile = profiles[0];
    if (!profile || profile.empresa_id !== empresaId) {
      return send(res, 403, { error: "Empresa não autorizada para esta sessão." });
    }

    const plan = PLAN_DETAILS[plano];
    const preference = {
      items: [{ title: plan.title, quantity: 1, currency_id: "BRL", unit_price: plan.unit_price }],
      payer: user.email ? { email: user.email } : undefined,
      external_reference: `${empresaId}|${plano}`,
      back_urls: {
        success: `${APP_URL}/?pagamento=sucesso`,
        failure: `${APP_URL}/?pagamento=falha`,
        pending: `${APP_URL}/?pagamento=pendente`,
      },
      auto_return: "approved",
      notification_url: `${APP_URL}/api/mercadopago/webhook`,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(preference),
    });
    if (!mpResponse.ok) return send(res, 502, { error: "O Mercado Pago não conseguiu iniciar o checkout." });
    const result = await mpResponse.json();
    if (!result.init_point) return send(res, 502, { error: "O Mercado Pago não retornou o endereço de pagamento." });
    return send(res, 200, { init_point: result.init_point });
  } catch {
    return send(res, 500, { error: "Não foi possível iniciar o pagamento." });
  }
}
