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
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(express.json());
app.set("view engine", "ejs");
app.use((express.urlencoded)({extended: false}));//send details form front end to server
app.use(cookieParser('secret'));
app.use(session({
    cookie: { maxAge: 60000 },
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

app.get("/users/dashboard", (req, res) => {//hyperlink directory
    res.render("dashboard", {user: req.username});//open dashboard.ejs
});

app.get("/users/logout", (req, res) => {
    req.logOut();
    res.redirect("/users/login");
    req.flash("success_msg", "you are now logged out");

})

app.post("/users/login", async (req, res) => {
    let {username, password} = req.body ;
    pool.query(`SELECT * FROM users WHERE name = $1`,[username], (error, results) => {
        if (results.rows.length > 0) {
            const user = results.rows[0];
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    throw err;
                }

                if (isMatch) {
                    const token = jwt.sign({
                        username: results.rows[0].name}, process.env.JWT_KEY, {expiresIn: "1h"});
                    console.log(token);
                    res.cookie('authcookie',token,{maxAge:900000,httpOnly:true})
                    //res.json({token: token});// send token back to the user
                    //req.flash("username", username);
                    //res.redirect("/users/dashboard");
                } else {
                    req.flash("error", "Password doesn't match");
                    res.redirect("/users/login");
                }
            })
        }
    })

})

app.post("/users/register", async (req, res) => {
    let {username, password, confirmPassword} = req.body;

    console.log({
        username,
        password,
        confirmPassword
    })

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
        //console.log(hashedPassword);

        pool.query(
                `SELECT * FROM users 
             WHERE name = $1`,
            [username], (error, results) => {
                if (error) {
                    throw  error;
                }
                console.log("worked");
                console.log(results.rows);

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
                            console.log(results.rows);
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
    console.log(`server running on port ${PORT}`)
});


