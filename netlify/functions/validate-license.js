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

    // FIXED: Use the field ID for # MT4_Account instead of name
    const records = await base('tblVeGLkOvK14GAgY').select({
      maxRecords: 1,
      filterByFormula: `AND({License_Key}='${License_Key}',{fldXbaWzi1giEIL27}=${MT4_Account})`
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

    // Get values using field IDs (most reliable)
    const licenseKey = fields['fld95TyJ1nwwMtr8I'];     // License_Key field ID
    const mt4Account = fields['fldXbaWzi1giEIL27'];     // # MT4_Account field ID
    const statusValue = fields['fldDlkZBeUt5fda0o'];    // Status field ID
    const expiryDate = fields['fld47RXvkHfthrsZy'];     // Expiry_Date field ID
    const customerEmail = fields['fldhfp377CRe3rxjX'];  // Customer_Email field ID
    const startDate = fields['fldSYNU0COpvCs2IE'];      // Start_Date field ID

    console.log('DEBUG - Field values:');
    console.log('License Key:', licenseKey);
    console.log('MT4 Account:', mt4Account);
    console.log('Status:', statusValue);
    console.log('Expiry Date:', expiryDate);
    console.log('All fields:', Object.keys(fields));

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

    // Check expiry
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
