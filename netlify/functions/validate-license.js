const Airtable = require('airtable');

exports.handler = async function(event, context) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  // Only POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Use POST' }) 
    };
  }

  try {
    // Parse request
    const data = JSON.parse(event.body);
    const { license_key, mt4_account } = data;
    
    console.log('Looking for:', { license_key, mt4_account });
    
    // Get credentials
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.error('Missing Airtable credentials');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'error',
          error: 'Server not configured'
        })
      };
    }
    
    // Initialize Airtable - USE "Table 1" exactly as shown
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const table = base('Table 1');  // CRITICAL: Use exact table name
    
    // Query - CORRECT FIELD NAMES from your screenshot
    const records = await table.select({
      filterByFormula: `{License_Key} = '${license_key}'`,  // CORRECT FIELD NAME
      maxRecords: 1
    }).firstPage();
    
    console.log('Found records:', records.length);
    
    if (records.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'invalid',
          message: `License ${license_key} not found in Table 1`
        })
      };
    }
    
    const record = records[0];
    const fields = record.fields;
    
    console.log('Record found:', fields);
    
    // Get status - lowercase for MT4
    const status = String(fields.Status || '').toLowerCase();
    
    // Return response MT4 expects
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        status: status,
        mt4_account: fields.MT4_Account || '',
        license_key: fields.License_Key || '',
        expiry_date: fields.Expiry_Date || ''
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 200,  // Return 200 so MT4 sees the error
      headers: corsHeaders,
      body: JSON.stringify({ 
        status: 'trial',  // TEMPORARY: Allow trading
        error: error.message,
        stack: error.stack
      })
    };
  }
};
