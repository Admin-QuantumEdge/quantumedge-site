// validate-license.js - Updated for "Table 1" table
const Airtable = require('airtable');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the incoming data from MT4
    const data = JSON.parse(event.body);
    const { license_key, mt4_account } = data;
    
    // Get environment variables from Netlify
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    
    // Use "Table 1" as your table name
    const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Table 1';
    
    // Initialize Airtable with your credentials
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    
    // Query Airtable for the license
    const records = await base(AIRTABLE_TABLE).select({
      filterByFormula: `AND({LicenseKey} = '${license_key}', {MT4Account} = '${mt4_account}')`,
      maxRecords: 1
    }).firstPage();
    
    if (records.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          status: 'INVALID',
          message: 'License not found' 
        })
      };
    }
    
    const record = records[0];
    const fields = record.fields;
    
    // Check if license is active and not expired
    const today = new Date().toISOString().split('T')[0];
    const expiryDate = fields.ExpiryDate || '';
    
    if (fields.Status !== 'Active') {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          status: fields.Status || 'SUSPENDED',
          expiryDate: expiryDate,
          tier: fields.Tier || 'Standard'
        })
      };
    }
    
    if (expiryDate && expiryDate < today) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          status: 'EXPIRED',
          expiryDate: expiryDate,
          tier: fields.Tier || 'Standard'
        })
      };
    }
    
    // License is valid
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        status: 'ACTIVE',
        expiryDate: expiryDate,
        tier: fields.Tier || 'Standard',
        features: fields.Features || 'All'
      })
    };
    
  } catch (error) {
    console.error('License validation error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Server error',
        details: error.message 
      })
    };
  }
};
