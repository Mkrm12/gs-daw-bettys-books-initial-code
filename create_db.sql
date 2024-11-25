-- Create or use the existing database
CREATE DATABASE IF NOT EXISTS bettys_books;
USE bettys_books;

-- Existing 'books' table definition
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    price DECIMAL(5, 2) UNSIGNED
);

-- Extend the 'users' table and add constraints
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE,
    hashed_password VARCHAR(255) NOT NULL DEFAULT '', -- Set a default value here
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Optional, to track user creation time
);

-- Ensure unique constraints are set on username and email
ALTER TABLE users
    ADD CONSTRAINT unique_username UNIQUE (username),
    ADD CONSTRAINT unique_email UNIQUE (email);

-- If 'users' table already exists, apply necessary modifications
ALTER TABLE users
    MODIFY COLUMN hashed_password VARCHAR(255) NOT NULL,
    ADD CONSTRAINT chk_password_length CHECK (LENGTH(hashed_password) >= 8);


-- New 'authors' table to store author information
CREATE TABLE IF NOT EXISTS authors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Linking table to handle many-to-many relationship between books and authors
CREATE TABLE IF NOT EXISTS book_authors (
    book_id INT,
    author_id INT,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
);

-- Create a 'reviews' table to store book reviews (if you want this feature)
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT,
    user_id INT,
    rating TINYINT CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create the application user and grant permissions
CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY 'qwertyuiop';
GRANT ALL PRIVILEGES ON bettys_books.* TO 'appuser'@'localhost';
