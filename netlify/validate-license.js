const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    // Only allow POST
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { mt4_account, license_key } = JSON.parse(event.body || "{}");

    if (!mt4_account || !license_key) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: "INVALID",
          message: "Missing MT4 account or license key"
        })
      };
    }

    const AIRTABLE_URL =
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE}` +
      `?filterByFormula=AND(` +
      `{MT4_Account}='${mt4_account}',` +
      `{License_Key}='${license_key}'` +
      `)`;

    const response = await fetch(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`
      }
    });

    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "INVALID",
          message: "License not found"
        })
      };
    }

    const record = data.records[0].fields;
    const status = record.Status || "INVALID";
    const expiry = record.Expiry || null;

    // Check expiry
    if (expiry) {
      const today = new Date();
      const expDate = new Date(expiry);
      if (today > expDate) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            status: "EXPIRED",
            message: "License expired",
            expires: expiry
          })
        };
      }
    }

    // Update last check-in (fire-and-forget)
    fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE}/${data.records[0].id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: { Last_Check: new Date().toISOString() }
        })
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: status,
        message: "License valid",
        expires: expiry
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "ERROR",
        message: err.message
      })
    };
  }
};
