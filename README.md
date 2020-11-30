# Circuit Designer Project
This project is the start of my A Level Computer Science coursework
##Libraries used
* Express (incl. session and flash)
  * Express is the framework for the back end API and serving pages hosted by NodeJS. Also allows
   the
   application to store user data in a session. It uses the session-id passed through the HTTP
    requests to keep track of whose session belongs to who. The session-id is stored in the
     browser cookie. The flash part is used to show alerts and success messages.
* Cookie Parser
  * This be involved in the user authentication part of the program to decrypt signed cookies
   sent from the user.
* Bcrypt
  * This is used to hash the password into the Postgre database
* JWT
  * I intend to use this library to authenticate the user. 


