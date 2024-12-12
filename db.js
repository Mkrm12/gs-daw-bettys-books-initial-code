const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'appuser',  // Change this to your preferred username
    password: 'app2027',  // Change this to your preferred password
    database: 'bettys_movies'  // Change this to your database name
});

connection.connect(err => {
    if (err) throw err;
    console.log('Database connected!');
});

module.exports = connection;
