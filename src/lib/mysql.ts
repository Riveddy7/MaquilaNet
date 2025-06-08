import mysql from 'mysql2/promise';

// Configuration for the MySQL connection.
// These should be set via environment variables.
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'your_database_name';

// Create a connection pool
const pool = mysql.createPool({
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Function to test the connection (optional, can be called at startup)
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL.');
    connection.release();
  } catch (error) {
    console.error('Error connecting to MySQL:', error);
    throw error; // Rethrow to indicate failure
  }
}

// Export the pool to be used for queries
export default pool;
