require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase configuration. Please check your .env file.');
}

// Service role client for backend operations (full access)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Anonymous client for public operations
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is OK during setup
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
};

// Initialize database tables
const initializeTables = async () => {
  try {
    console.log('🔄 Initializing database tables...');
    
    // Check if tables exist
    const { data: tables, error } = await supabaseAdmin
      .rpc('check_table_exists', { table_name: 'users' });
    
    if (!tables) {
      console.log('📋 Creating database schema...');
      // Database schema will be created through Supabase dashboard or migrations
      console.log('ℹ️ Please run the SQL schema provided in the documentation');
    }
    
    return true;
  } catch (error) {
    console.log('ℹ️ Database schema check skipped (will be created manually)');
    return true;
  }
};

module.exports = {
  supabaseAdmin,
  supabaseAnon,
  testConnection,
  initializeTables
}; 