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

    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY
    }).base('appbjZY4Uwu811X3G');

    // Use field NAMES (easier to debug)
    const records = await base('tblVeGLkOvK14GAgY').select({
      maxRecords: 1,
      filterByFormula: `AND({License_Key}='${License_Key}',{# MT4_Account}=${MT4_Account})`
    }).firstPage();

    if (!records.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: 'License not found'
        })
      };
    }

    const record = records[0];
    const fields = record.fields;

    // Get values - try different field name variations
    const licenseKey = fields['License_Key'] || fields['license_key'] || fields['LICENSE_KEY'];
    const mt4Account = fields['# MT4_Account'] || fields['MT4_Account'] || fields['mt4_account'];
    const statusValue = fields['Status'] || fields['status'] || fields['STATUS'];
    const expiryDate = fields['Expiry_Date'] || fields['expiry_date'] || fields['EXPIRY_DATE'];

    // Debug response
    console.log('Fields received:', Object.keys(fields));
    console.log('Status value:', statusValue);

    // Check status
    const status = String(statusValue || '').trim().toLowerCase();
    
    if (!status || (status !== 'active' && status !== 'trial')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: `Invalid status: "${statusValue}" (available fields: ${Object.keys(fields).join(', ')})`
        })
      };
    }

    // Check expiry
    let isExpired = false;
    let expiry = '';
    
    if (expiryDate) {
      try {
        const expiryDateObj = new Date(expiryDate);
        expiry = expiryDateObj.toISOString().split('T')[0];
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
          message: `License expired on ${expiry}`
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
        status_type: status,
        expiry_date: expiry,
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
