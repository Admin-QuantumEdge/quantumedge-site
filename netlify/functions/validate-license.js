// validate-license.js - Full working version with CORS
const Airtable = require('airtable');

exports.handler = async function(event, context) {
  // ===== CORS HEADERS =====
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS preflight (OPTIONS request)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  // Only allow POST method for actual requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Method not allowed. Use POST.',
        received: event.httpMethod 
      })
    };
  }

  try {
    // Parse the incoming data from MT4
    let data;
    try {
      data = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'ERROR',
          error: 'Invalid JSON format',
          details: parseError.message
        })
      };
    }
    
    const { license_key, mt4_account } = data;
    
    // Validate required fields
    if (!license_key || !mt4_account) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'ERROR',
          error: 'Missing required fields',
          required: ['license_key', 'mt4_account']
        })
      };
    }
    
    // Get environment variables from Netlify
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Table 1';
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'ERROR',
          error: 'Server configuration error',
          message: 'Airtable credentials not configured'
        })
      };
    }
    
    console.log('Looking up license:', { license_key, mt4_account });
    
    // Initialize Airtable
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    
    // Query Airtable for the license - UPDATED FIELD NAMES FOR YOUR AIRTABLE
    const records = await base(AIRTABLE_TABLE).select({
      filterByFormula: `AND({License_Key} = '${license_key}', {MT4_Account} = '${mt4_account}')`,
      maxRecords: 1
    }).firstPage();
    
    if (records.length === 0) {
      console.log('No record found for:', { license_key, mt4_account });
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'INVALID',
          message: 'License not found or does not match account',
          license_key: license_key,
          mt4_account: mt4_account
        })
      };
    }
    
    const record = records[0];
    const fields = record.fields;
    
    console.log('Found record:', fields);
    
    // Get field values - UPDATED FOR YOUR AIRTABLE FIELD NAMES
    const status = fields.Status || fields.status || '';
    const expiryDate = fields.Expiry_Date || fields.ExpiryDate || fields['Expiry Date'] || '';
    const customerEmail = fields.Customer_Email || fields.CustomerEmail || fields.Email || '';
    const startDate = fields.Start_Date || fields.StartDate || fields['Start Date'] || '';
    
    // Prepare response
    const responseData = {
      status: status.toLowerCase(),  // Convert to lowercase for MT4
      license_key: license_key,
      mt4_account: mt4_account,
      expiry_date: expiryDate,
      customer_email: customerEmail,
      start_date: startDate
    };
    
    // For MT4, we need simple lowercase status
    if (status.toLowerCase() === 'trial' || status.toLowerCase() === 'active') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(responseData)
      };
    } else {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: status.toLowerCase(),
          message: `License status: ${status}`,
          ...responseData
        })
      };
    }
    
  } catch (error) {
    console.error('License validation error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        status: 'ERROR',
        error: 'Server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
