const Airtable = require('airtable');

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
    const { License_Key, MT4_Account } = JSON.parse(event.body);

    console.log('=== DEBUG START ===');
    console.log('Request received:', { License_Key, MT4_Account });

    if (!License_Key || !MT4_Account) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: 'Missing parameters'
        })
      };
    }

    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY
    }).base('appbjZY4Uwu811X3G');

    // DEBUG: Log the exact filter
    const filterFormula = `AND({fld95TyJ1nwwMtr8I}='${License_Key}',{fldXbaWzi1giEIL27}=${MT4_Account})`;
    console.log('Filter formula:', filterFormula);

    const records = await base('tblVeGLkOvK14GAgY').select({
      maxRecords: 1,
      filterByFormula: filterFormula
    }).firstPage();

    console.log('Records found:', records.length);

    if (!records.length) {
      console.log('=== DEBUG END: No records found ===');
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
    
    // DEBUG: Log ALL fields we get back
    console.log('All fields from Airtable:');
    Object.keys(r).forEach(key => {
      console.log(`  ${key}: "${r[key]}" (type: ${typeof r[key]})`);
    });

    // Extract specific fields
    const licenseKeyValue = r['fld95TyJ1nwwMtr8I'];
    const mt4AccountValue = r['fldXbaWzi1giEIL27'];
    const statusValue = r['fldDlkZBeUt5fda0o'];
    const customerEmailValue = r['fldhfp377CRe3rxjX'];
    const startDateValue = r['fldSYNU0COpvCs2IE'];
    const expiryDateValue = r['fld47RXvkHfthrsZy'];

    console.log('Extracted values:');
    console.log('  License Key:', licenseKeyValue);
    console.log('  MT4 Account:', mt4AccountValue);
    console.log('  Status:', statusValue, '(raw)');
    console.log('  Status trimmed:', String(statusValue || '').trim());
    console.log('  Customer Email:', customerEmailValue);
    console.log('  Start Date:', startDateValue);
    console.log('  Expiry Date:', expiryDateValue);

    // Check status
    const status = String(statusValue || '').trim().toLowerCase();
    console.log('Status after trim/lowercase:', status);

    if (!status || (status !== 'active' && status !== 'trial')) {
      console.log('=== DEBUG END: Invalid status ===');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: `Invalid status: "${statusValue}" (must be "active" or "trial", got "${status}")`
        })
      };
    }

    // Check expiration
    const now = new Date();
    let expiry = '';
    let isExpired = false;
    
    if (expiryDateValue) {
      try {
        const expiryDate = new Date(expiryDateValue);
        expiry = expiryDate.toISOString().slice(0, 10);
        isExpired = expiryDate < now;
        console.log('Expiry date parsed:', expiry, 'Is expired:', isExpired);
      } catch (e) {
        console.error('Expiry date parse error:', e);
      }
    }

    if (isExpired) {
      console.log('=== DEBUG END: License expired ===');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: `License expired on ${expiry}`
        })
      };
    }

    console.log('=== DEBUG END: License valid ===');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'valid',
        license_key: licenseKeyValue,
        mt4_account: mt4AccountValue,
        customer_email: customerEmailValue,
        status_type: status,
        expiry_date: expiry,
        message: 'License is valid'
      })
    };

  } catch (err) {
    console.error('VALIDATE LICENSE ERROR:', err.stack || err);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'invalid',
        message: 'Server error: ' + err.message
      })
    };
  }
};
