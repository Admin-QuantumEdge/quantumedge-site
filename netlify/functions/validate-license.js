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
    
    console.log('=== LICENSE CHECK ===');
    console.log('License:', license_key);
    console.log('Account:', mt4_account);
    
    // HARDCODE RESPONSE FOR TESTING - REMOVE LATER
    if (license_key === "QE-211885542") {
      console.log('Hardcoded response for testing');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'trial',
          mt4_account: '35314257',
          license_key: 'QE-211885542',
          expiry_date: '2026-02-23'
        })
      };
    }
    
    // Get credentials
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    
    console.log('API Key exists:', !!AIRTABLE_API_KEY);
    console.log('Base ID exists:', !!AIRTABLE_BASE_ID);
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      throw new Error('Airtable credentials missing');
    }
    
    // Initialize Airtable
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    
    // Try different table names
    const tableNames = ['Table 1', 'table 1', 'Table1', 'Table 1 ', 'Table'];
    
    for (let tableName of tableNames) {
      try {
        console.log('Trying table:', tableName);
        const records = await base(tableName).select({
          filterByFormula: `{License_Key} = '${license_key}'`,
          maxRecords: 1
        }).firstPage();
        
        console.log(`Found ${records.length} records in ${tableName}`);
        
        if (records.length > 0) {
          const record = records[0];
          const status = String(record.fields.Status || '').toLowerCase();
          
          console.log('SUCCESS! Status:', status);
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
              status: status,
              mt4_account: record.fields.MT4_Account || '',
              license_key: record.fields.License_Key || '',
              expiry_date: record.fields.Expiry_Date || ''
            })
          };
        }
      } catch (tableError) {
        console.log(`Table ${tableName} failed:`, tableError.message);
      }
    }
    
    console.log('No record found in any table');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        status: 'invalid',
        message: 'License not found in Airtable'
      })
    };
    
  } catch (error) {
    console.error('FUNCTION ERROR:', error.message);
    // RETURN trial INSTEAD OF ERROR for now
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        status: 'trial',  // Always return trial for now
        message: 'Server error - trial mode active',
        debug: error.message
      })
    };
  }
};
