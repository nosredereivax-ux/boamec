const PLAN_DAYS = { mensal: 30, anual: 365 };
const PLAN_PRICES = { mensal: 97, anual: 697 };

function response(res, status = 200, payload = { received: true }) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return response(res, 405, { error: "Método não permitido." });
  }

  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!mpToken || !supabaseUrl || !serviceKey) {
    return response(res, 500, { error: "Configuração de webhook indisponível." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const query = req.query || {};
  const eventType = query.type || query.topic || body?.type || body?.topic || body?.action?.split(".")[0];
  const paymentId = query["data.id"] || query.id || body?.data?.id || body?.id;
  if (eventType && eventType !== "payment") return response(res);
  if (!paymentId) return response(res);

  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    if (!paymentResponse.ok) return response(res, 502, { error: "Não foi possível confirmar o pagamento." });
    const payment = await paymentResponse.json();
    if (payment.status !== "approved") return response(res);

    const [empresaId, plano] = String(payment.external_reference || "").split("|");
    if (!empresaId || !PLAN_DAYS[plano]) return response(res, 400, { error: "Referência de pagamento inválida." });
    if (payment.currency_id !== "BRL" || Number(payment.transaction_amount) !== PLAN_PRICES[plano]) {
      return response(res, 400, { error: "Valor ou moeda do pagamento inválido." });
    }

    const approvedAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
    const dataInicio = Number.isNaN(approvedAt.getTime()) ? new Date() : approvedAt;
    const existingUrl = new URL(`${supabaseUrl}/rest/v1/assinaturas`);
    existingUrl.searchParams.set("empresa_id", `eq.${empresaId}`);
    existingUrl.searchParams.set("select", "data_inicio,status,plano");
    const existingResponse = await fetch(existingUrl, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!existingResponse.ok) return response(res, 502, { error: "Não foi possível verificar a assinatura atual." });
    const existingRows = await existingResponse.json();
    const alreadyApplied = existingRows.some((row) =>
      row.status === "ativo" && row.plano === plano && Date.parse(row.data_inicio) === dataInicio.getTime()
    );
    if (alreadyApplied) return response(res);

    const dataFim = new Date(dataInicio.getTime() + PLAN_DAYS[plano] * 24 * 60 * 60 * 1000);
    const updateUrl = new URL(`${supabaseUrl}/rest/v1/assinaturas`);
    updateUrl.searchParams.set("empresa_id", `eq.${empresaId}`);
    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "ativo",
        plano,
        valor: PLAN_PRICES[plano],
        gateway: "mercadopago",
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
      }),
    });
    if (!updateResponse.ok) return response(res, 502, { error: "Não foi possível atualizar a assinatura." });
    const updatedRows = await updateResponse.json();
    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      return response(res, 404, { error: "Nenhuma assinatura foi encontrada para a empresa." });
    }
    return response(res);
  } catch {
    return response(res, 500, { error: "Erro ao processar a notificação de pagamento." });
  }
}
