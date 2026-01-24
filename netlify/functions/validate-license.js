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
    const { License_Key, MT4_Account } = JSON.parse(event.body);

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

    // Init Airtable with your Base ID
    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY
    }).base('appbjZY4Uwu811X3G');

    // Query using Table ID and Field IDs - FIXED variable name
    const records = await base('tblVeGLkOvK14GAgY').select({
      maxRecords: 1,
      filterByFormula: `AND(
        {fld95TyJ1nwwMtr8I}='${License_Key}',
        {fldXbaWzi1giEIL27}=${MT4_Account}
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

    // Extract ALL field values using Field IDs
    const licenseKeyValue = r['fld95TyJ1nwwMtr8I'];      // License_Key field
    const mt4AccountValue = r['fldXbaWzi1giEIL27'];      // MT4_Account field
    const customerEmailValue = r['fldhfp377CRe3rxjX'];   // Customer_Email field
    const statusValue = r['fldDlkZBeUt5fda0o'];          // Status field
    const startDateValue = r['fldSYNU0COpvCs2IE'];       // Start_Date field
    const expiryDateValue = r['fld47RXvkHfthrsZy'];      // Expiry_Date field

    // Check if license is expired
    const now = new Date();
    let expiry = '';
    let isExpired = false;
    
    if (expiryDateValue) {
      try {
        const expiryDate = new Date(expiryDateValue);
        expiry = expiryDate.toISOString().slice(0, 10);
        isExpired = expiryDate < now;
      } catch (e) {
        console.error('Expiry date parse error:', e, 'Value:', expiryDateValue);
      }
    }

    // Check status
    const status = String(statusValue || '').toLowerCase();
    const isValidStatus = status === 'active' || status === 'trial';
    
    if (isExpired) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: `License expired on ${expiry}`
        })
      };
    }
    
    if (!isValidStatus) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: `Invalid status: ${status}`
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'valid',
        License_Key: licenseKeyValue,
        MT4_Account: mt4AccountValue,
        customer_email: customerEmailValue,
        start_date: startDateValue,
        expiry_date: expiry,
        status_type: status,
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
