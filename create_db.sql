-- Create the database and use it
CREATE DATABASE IF NOT EXISTS bettys_movies;
USE bettys_movies;


DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS movies;

-- Create 'movies' table
CREATE TABLE IF NOT EXISTS movies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    rating DECIMAL(4, 2) NOT NULL CHECK (rating >= 0 AND rating <= 10.1),
    release_date DATE
);

-- Create 'users' table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL CHECK (LENGTH(hashed_password) >= 8),
    plain_password VARCHAR(255) DEFAULT NULL
);


CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id INT NOT NULL,
    user_id INT NOT NULL,
    rating DECIMAL(4, 2) NOT NULL CHECK (rating >= 0 AND rating <= 10.1),
    review_text TEXT,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- Create a user for the application and grant necessary permissions
CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY 'qwertyuiop';
GRANT ALL PRIVILEGES ON bettys_movies.* TO 'appuser'@'localhost';

-- Insert some example data for testing

-- Insert movies
INSERT INTO movies (title, description, rating, release_date) VALUES
('Black Widow', 'Natasha Romanoff confronts the darker parts of her ledger.', 10.0, '2021-07-09'),
('Shang-Chi and the Legend of the Ten Rings', 'Shang-Chi must confront the past he thought he left behind.', 7.9, '2021-09-03'),
('Eternals', 'The Eternals, an immortal alien race, emerge from hiding.', 9.8, '2021-11-05'),
('Jungle Cruise', 'A riverboat captain and a scientist embark on a jungle adventure.', 6.6, '2021-07-30'),
('Free Guy', 'A bank teller discovers he is a background character in an open world video game.', 7.6, '2021-08-13');

-- Insert users
INSERT INTO users (username, first_name, last_name, email, hashed_password) VALUES
('eve_adams', 'Eve', 'Adams', 'eve@example.com', 'hashedpassword5'),
('frank_harris', 'Frank', 'Harris', 'frank@example.com', 'hashedpassword6'),
('grace_lee', 'Grace', 'Lee', 'grace@example.com', 'hashedpassword7'),
('henry_thompson', 'Henry', 'Thompson', 'henry@example.com', 'hashedpassword8');

-- Insert reviews
INSERT INTO reviews (movie_id, user_id, rating, review_text) VALUES
(1, 1, 7.5, 'An exciting addition to the Marvel universe.'),
(2, 2, 8.3, 'A fresh and entertaining take on a superhero origin story.'),
(3, 3, 6.7, 'Visually stunning, but the story falls a bit flat.'),
(4, 4, 6.5, 'A fun adventure that is great for the whole family.'),
(5, 1, 7.4, 'A hilarious and heartfelt film with a unique premise.'),
(3, 4, 7.0, 'A decent film with some great moments but inconsistent storytelling.');


DROP TABLE IF EXISTS recommendations;

CREATE TABLE recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id INT UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    genres TEXT, -- Allow multiple genres as comma-separated values
    release_date DATE,
    tags TEXT -- Allow flexible tagging with more storage
);



-- Verify all tables and constraints are in place
SHOW TABLES;
DESCRIBE reviews;
SELECT * FROM users;
SELECT * FROM recommendations;
SELECT DISTINCT genres FROM recommendations;

