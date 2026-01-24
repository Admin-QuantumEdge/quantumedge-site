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

    // FIXED: Use MT4_Account (without #)
    const records = await base('tblVeGLkOvK14GAgY').select({
      maxRecords: 1,
      filterByFormula: `AND({License_Key}='${License_Key}',{MT4_Account}=${MT4_Account})`
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

    const record = records[0];
    const fields = record.fields;
    
    // Get values
    const licenseKey = fields['License_Key'];
    const mt4Account = fields['MT4_Account'];
    const statusValue = fields['Status'];
    const expiryDate = fields['Expiry_Date'];
    const customerEmail = fields['Customer_Email'];
    const startDate = fields['Start_Date'];

    console.log('Found record:', { licenseKey, mt4Account, statusValue, expiryDate });

    // Check status
    const status = String(statusValue || '').trim().toLowerCase();
    
    if (!status || (status !== 'active' && status !== 'trial')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: `Invalid status: "${statusValue}"`
        })
      };
    }

    // Check expiration
    let isExpired = false;
    let expiryFormatted = '';
    
    if (expiryDate) {
      try {
        const expiryDateObj = new Date(expiryDate);
        expiryFormatted = expiryDateObj.toISOString().split('T')[0];
        isExpired = expiryDateObj < new Date();
      } catch (e) {
        console.error('Date parse error:', e);
      }
    }

    if (isExpired) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: `License expired on ${expiryFormatted}`
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'valid',
        license_key: licenseKey,
        mt4_account: mt4Account,
        customer_email: customerEmail,
        start_date: startDate,
        expiry_date: expiryFormatted,
        status_type: status,
        message: 'License is valid'
      })
    };

  } catch (err) {
    console.error('ERROR:', err.message);
    
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
