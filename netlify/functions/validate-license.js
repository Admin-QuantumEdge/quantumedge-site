const Airtable = require('airtable');

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Allow GET for debugging
  if (event.httpMethod === 'GET') {
    try {
      const base = new Airtable({
        apiKey: process.env.AIRTABLE_API_KEY
      }).base('appbjZY4Uwu811X3G');

      const records = await base('tblVeGLkOvK14GAgY').select({
        maxRecords: 5
      }).firstPage();

      const allFields = [];
      
      if (records.length > 0) {
        records.forEach((record, index) => {
          const fields = record.fields;
          allFields.push({
            record: index + 1,
            fields: Object.keys(fields),
            values: fields
          });
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'debug',
          total_records: records.length,
          all_fields: allFields
        }, null, 2)
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'error',
          message: err.message
        })
      };
    }
  }

  // POST request (normal validation)
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

    // Get ALL records to debug
    const allRecords = await base('tblVeGLkOvK14GAgY').select().all();
    
    console.log('Total records in table:', allRecords.length);
    
    // Manual search
    let foundRecord = null;
    for (const record of allRecords) {
      const fields = record.fields;
      console.log('Record fields:', Object.keys(fields));
      console.log('Values:', {
        License_Key: fields['License_Key'],
        MT4_Account: fields['# MT4_Account'],
        Status: fields['Status']
      });
      
      if (fields['License_Key'] === License_Key && 
          String(fields['# MT4_Account']) === String(MT4_Account)) {
        foundRecord = record;
        break;
      }
    }

    if (!foundRecord) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'invalid',
          message: 'License not found'
        })
      };
    }

    const fields = foundRecord.fields;
    
    // Return ALL fields for debugging
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'debug_record',
        found: true,
        all_field_names: Object.keys(fields),
        all_fields: fields,
        license_key: fields['License_Key'],
        mt4_account: fields['# MT4_Account'],
        status_value: fields['Status'],
        expiry_date: fields['Expiry_Date'],
        customer_email: fields['Customer_Email'],
        start_date: fields['Start_Date']
      }, null, 2)
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
