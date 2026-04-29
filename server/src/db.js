import mysql from 'mysql2/promise';

function createPoolConfig() {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
        return {
            uri: process.env.DATABASE_URL.trim(),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: { rejectUnauthorized: false }
        };
    }

    return {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'railway',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: { rejectUnauthorized: false }
    };
}

export const pool = mysql.createPool(createPoolConfig());
