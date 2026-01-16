const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { valid: false, reason: "method_not_allowed" });
    }

    const { mt4_account, license_key } = JSON.parse(event.body || "{}");

    if (!license_key) {
      return json(400, { valid: false, reason: "missing_license_key" });
    }

    const AIRTABLE_URL =
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE}` +
      `?filterByFormula={License_Key}='${license_key}'`;

    const response = await fetch(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      return json(500, { valid: true, status: "TEMP_ERROR" }); // grace
    }

    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return json(200, { valid: false, status: "INVALID_KEY" });
    }

    const record = data.records[0];
    const fields = record.fields;

    const status = (fields.Status || "INVALID").toUpperCase();
    const expiry = fields.Expiry ? new Date(fields.Expiry) : null;
    const now = new Date();

    // ❌ Hard blocks
    if (["CANCELED", "EXPIRED", "PAST_DUE", "SUSPENDED"].includes(status)) {
      return json(200, { valid: false, status });
    }

    if (expiry && expiry < now) {
      return json(200, { valid: false, status: "EXPIRED" });
    }

    // 🔐 Optional MT4 account check
    if (fields.MT4_Account && mt4_account) {
      if (String(fields.MT4_Account) !== String(mt4_account)) {
        return json(200, { valid: false, status: "ACCOUNT_MISMATCH" });
      }
    }

    // Update last check-in (fire and forget)
    fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE}/${record.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: { Last_Check: new Date().toISOString() },
        }),
      }
    );

    return json(200, {
      valid: true,
      status,
      expiry: fields.Expiry || null,
    });

  } catch (err) {
    return json(500, {
      valid: true,           // GRACE MODE
      status: "SERVER_ERROR"
    });
  }
};

function json(code, body) {
  return {
    statusCode: code,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
