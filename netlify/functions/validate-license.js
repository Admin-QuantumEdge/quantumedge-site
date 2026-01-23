const Airtable = require('airtable');

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Use POST' })
    };
  }

  try {
    const { license_key, mt4_account } = JSON.parse(event.body);

    if (!license_key || !mt4_account) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: 'Missing parameters'
        })
      };
    }

    // Init Airtable
    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY
    }).base(process.env.AIRTABLE_BASE_ID);

    // Query license
    const records = await base('Table 1').select({
      maxRecords: 1,
      filterByFormula: `AND(
        {Licence_Key}='${license_key}',
        {MT4_Account}=${mt4_account}
      )`
    }).firstPage();

    if (!records.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: 'License not found in Airtable'
        })
      };
    }

    const r = records[0].fields;

    // ✅ Normalize expiry date to YYYY-MM-DD
    let expiry = '';
    if (r.Expiry_Date) {
      try {
        expiry = new Date(r.Expiry_Date).toISOString().slice(0, 10);
      } catch (e) {
        console.error('Expiry date parse error:', e);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: String(r.Status || '').toLowerCase(),
        mt4_account: String(r.MT4_Account),
        license_key: r.Licence_Key,
        expiry_date: expiry
      })
    };

  } catch (err) {
    console.error('VALIDATE LICENSE ERROR:', err.stack || err);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'invalid',
        message: 'Server error'
      })
    };
  }
};
