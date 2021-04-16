CREATE DATABASE logiccircuitdb;
CREATE USER fahad with password 'password';
\c logiccircuitdb;
CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, password VARCHAR(100) NOT NULL);
CREATE TABLE circuits (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, user_id INT REFERENCES users, elements JSON NOT NULL);
GRANT ALL PRIVILEGES ON  circuits_id_seq to fahadb;
GRANT ALL PRIVILEGES ON  circuits to fahadb;
