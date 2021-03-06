const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('express-flash');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const {pool} = require('./dbConfig');
const app = express();
const sessionStore = new session.MemoryStore;
const PORT = process.env.PORT || 4000;

// View Engines
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.json());
app.set("view engine", "ejs");
app.use((express.urlencoded)({extended: false}));//send details form front end to server
app.use(cookieParser('secret'));
app.use(session({
    cookie: {maxAge: 60000},
    store: sessionStore,
    saveUninitialized: true,
    resave: 'true',
    secret: 'secret'
}));
app.use(flash());


app.get("/", (req, res) => {
    res.render("index");

});

app.get("/users/register", (req, res) => {//hyperlink directory
    res.render("register");//open register.ejs
});

app.get("/users/login", (req, res) => {//hyperlink directory
    res.render("login");//open login.ejs
});

app.get("/users/dashboard", authnticateToken, (req, res) => {//hyperlink directory
    res.render("dashboard", {username: req.username, circuit_id: req.query.circuit_id});//open dashboard.ejs
});

app.get("/users/logout", (req, res) => {
    res.clearCookie('authcookie');
    res.redirect("/users/login");
    req.flash("success_msg", "you are now logged out");

})

app.get("/users/circuits", authnticateToken, (req, res) => {
    let token = getAuthToken(req);
    let circuits = [];
    pool.query(`SELECT id, name FROM circuits WHERE user_id = $1`, [token.user_id], (error, results) => {
        if (error) {
            throw error;
        }

        for (let i = 0; i < results.rows.length; i++) {
            const circuit = results.rows[i];
            circuits.push({id: circuit.id, name: circuit.name});
        }

        res.render("circuits", { username: token.username, circuits: circuits});
    });
})

app.get("/users/circuit/:circuit_id", authnticateToken, (req, res) => {
    let token = getAuthToken(req);
    pool.query(`SELECT id, name, elements FROM circuits WHERE id = $1`, [req.params.circuit_id], (error, results) => {
        if (error) {
            throw error;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(results.rows[0]));
    });
})

app.post("/users/login", async (req, res) => {
    let {username, password} = req.body;
    pool.query(`SELECT * FROM users WHERE name = $1`, [username], (error, results) => {
        if (results.rows.length > 0) {
            const user = results.rows[0];
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    throw err;
                }

                if (isMatch) {
                    const token = jwt.sign({
                        username: user.name, user_id: user.id
                    }, process.env.JWT_KEY, {expiresIn: "1h"});

                    res.cookie('authcookie', token, {maxAge: 900000, httpOnly: true})
                    res.redirect("/users/dashboard");
                } else {
                    req.flash("error", "Password doesn't match");
                    res.redirect("/users/login");
                }
            })
        }
    })

})

app.post("/users/savecircuit", authnticateToken, async (req, res) => {
    let {circuit_id, name, elements} = req.body;

    let errors = [];

    if (!name || !elements) {
        errors.push({message: "Please enter all fields. "});
    }

    if (!circuit_id) {
        let user_id = getAuthToken(req).user_id;
        pool.query(
            'INSERT INTO circuits (name, user_id, elements) VALUES ($1, $2, $3) RETURNING id', [name, user_id, JSON.stringify(elements)], (error, results) => {
                if (error) {
                    throw error;
                }

                circuit_id = results.rows[0].id;
            });
    } else {
         pool.query(
            'UPDATE circuits SET name = $1, elements = $2 WHERE id = $3', [name, JSON.stringify(elements), circuit_id], (error, results) => {
                if (error) {
                    throw error;
                }

            });
    }

    return circuit_id;
});

app.post("/users/register", async (req, res) => {
    let {username, password, confirmPassword} = req.body;

    let errors = [];

    if (!username || !password || !confirmPassword) {
        errors.push({message: "Please enter all fields. "});
    }
    if (password.length < 6) {
        errors.push({message: "Password not long enough."});
    }

    if (password !== confirmPassword) {
        errors.push({message: "Passwords do not match."});
    }
    if (errors.length > 0) {
        res.render("register", {errors});
    } else {
        let hashedPassword = await bcrypt.hash(password, 10);


        pool.query(
            `SELECT * FROM users 
             WHERE name = $1`,
            [username], (error, results) => {
                if (error) {
                    throw  error;
                }


                if (results.rows.length > 0) {
                    errors.push({message: "Username Taken"});
                    res.render("register", {errors});

                } else {
                    pool.query(
                        `INSERT INTO users (name, password)
                         VALUES ($1,$2) RETURNING id, password`,
                        [username, hashedPassword],
                        (error, results) => {
                            if (error) {
                                throw error
                            }
                            req.flash("success_msg", "you are now registered please login");
                            res.redirect("/users/login");
                        }
                    )
                }
            }
        )
    }
});


app.listen(PORT, () => {

});

function getAuthToken(req) {
    const authcookie = req.cookies.authcookie;
    return jwt.decode(authcookie);
}

function authnticateToken(req, res, next) {
    const authcookie = req.cookies.authcookie;
    jwt.verify(authcookie, process.env.JWT_KEY, (err, data) => {
        if (err) {
            res.redirect("/users/login");
        } else if (data.username) {
            req.username = data.username;
            next();
        }
    })
}