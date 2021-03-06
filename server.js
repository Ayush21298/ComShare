var express = require('express'), // Get the module,
    bodyParser = require('body-parser'),
    app = express(), // Create express by calling the prototype in var express,
    http = require('http').Server(app),
    io = require('socket.io')(http),
    // session= require('express-session'),
    mongoose = require('mongoose'),
    connected_clients = [],
    waiting_clients = [],
    logged_clients = [],
    offer_list = {},
    status;

const PORT = process.env.PORT || 7000;
// mongoose.connect('mongodb://localhost:27017/comshare', {
//   useMongoClient: true
// });
mongoose.connect('mongodb://admin:admin@ds046267.mlab.com:46267/comshare', {
  useMongoClient: true
});
//mongodb client
mongoose.Promise = global.Promise;
var db = mongoose.connection;
//db.dropDatabase();

var Schema = mongoose.Schema;
// app.use(session({
//   secret: 'keyboard cat',
//   resave: false,
//   saveUninitialized: true,
//   authenticated: false
// }));
var SomeModelSchema = new Schema({
    username: String,
    password: String,
    firstname: String,
    lastname: String,
    points: {type: String, default: 1200},
    files: {
        type: Number,
        default: 0
    }
});
//schema 
var SomeModel = mongoose.model('SomeModel', SomeModelSchema );
// our model
var posts = new Schema({
    by: String,
    text: String,
    points: Number,
    Date: {
        type: Date,
        default: Date.now
    },
    files: Number
});
var PostModel = mongoose.model('PostModel', posts);
// SomeModel.create({ username: 'also_awesome', password: 'check' }, function (err, awesome_instance) {
//   if (err) return handleError(err);
// });
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.post('/check', function(req,res){
    SomeModel.findOne({username: req.body.username})
        .exec(function (err, user){
            if (err) {
                res.json({error: true})
            } else if (!user){
                res.json({error: true});
            } else if (user.password == req.body.password){
                // req.session.authenticated = true;
                res.json({error: false, authenticated: true});
            }
            else {
                console.log(user.password);
                res.json({error: false, authenticated: false});
            }  
            });
    // res.json({data : "yes"});
});
app.post('/addPost', function(req, res){
    SomeModel.findOne({username: req.body.username})
        .exec(function(err, user){
            points = 0;
            if (err) {
                console.log(err);
            } else if (!user){
                console.log("No user?");
            } else{
                points = user.points;
                PostModel.create({by: req.body.username, text: req.body.post_text, points: points}, function(err){
                    if (err) console.log(err);
                });
            }
    });
});
// app.get('/isAuthenticated', function (req,res) {
//     res.json(req.session);
// });
app.get('/post_table', function(req, res){
    PostModel.find({})
    .sort({posts: 1})
    .exec(function(err, posts){
        posts.sort(compare);
        res.json(posts);
    });
});
app.get('/signup', function(req, res){
    res.sendFile(__dirname + "/signup.html");
});
app.post('/details', function(req,res){
    SomeModel.findOne({username: req.body.username}, function(err, user){
        if (err) console.log(err);
        else {
            res.json(user);
        }
    });
});
app.post('/pointsUpdate', function(req, res){
    console.log('User'+req.body.username+",, to "+ req.body.to);
    SomeModel.findOne({username: req.body.username}, function(err,user){
        if (err) console.log(err);
        else if (user){
            console.log('reached 1');
            SomeModel.findOne({username: req.body.to}, function(err, to){
                if (err) console.log(err);
                else if (to){
                    console.log('reached 2');
                    var points1 = parseInt(user.points);
                    var points2 = parseInt(to.points);
                    var ex1 = 1/(1 + 10**((points1-points2)/400));
                    var ex2 = 1/(1 + 10**((points2-points1)/400));
                    var newpoints1 = Math.round(points1 + 100*(1 - ex1));
                    var newpoints2 = Math.round(points2 + 100*(0 - ex1));
                    var newfiles = user.files + 1;
                    SomeModel.update({username: req.body.username},{points: newpoints1, files: newfiles}, function(err,raw){
                        console.log(raw);
                        SomeModel.update({username: req.body.to},{points: newpoints2}, function(err, raw){
                            console.log(raw);
                        });
                    });
                    console.log(newpoints1);
                    console.log(newpoints2);
                }
            });
        }
    });
});
app.post('/signup',function(req,res){
    SomeModel.create({username:req.body.username, password: req.body.password, firstname: req.body.firstname, lastname: req.body.lastname}, function(err){
        if (err) console.log(err);
    });
    res.redirect('/');   
});
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
app.use('/css', express.static('css'));
app.use('/fonts', express.static('fonts'));
app.use('/images', express.static('images'));
app.use('/js', express.static('js'));


http.listen(PORT, '0.0.0.0', function () {
    console.log('listening on *:' + PORT);
});

io.on('connection', function (socket) {

    socket.on("login", function (username) {
        if (!(username in connected_clients) && username !== "") {
            connected_clients[username] = socket.id;
            logged_clients[username] = socket.id;
            socket.username = username;
            // console.log(username + " connected");
            socket.emit('login', 0);
            io.sockets.emit('updateUsersList', Object.keys(connected_clients));
            offer_list[username] = [];
        } else {
            if (username === "") status = 2;
            else status = 1;
            socket.emit("login", status);
        }

    });
    socket.on('chat_send', function(message){
        // console.log(message);
        data ={};
        data.message = message;
        data.username = socket.username;
        // console.log("partner "+socket.partner);
        socket.broadcast.to(logged_clients[socket.partner]).emit("chat_received",data);
        socket.emit("chat_received",data);
    });

    socket.on('disconnect', function (data) {
        // console.log(socket.partner);
        if (socket.partner) {
            if (socket.partner in logged_clients) {
                socket.broadcast.to(logged_clients[socket.partner]).emit("PartnerDisconnected");
                // console.log("Sent message to other user");
                connected_clients[socket.partner] = socket.partnerid;
                io.sockets.emit('updateUsersList', Object.keys(connected_clients));
            }
        } else if (undefined != socket.username)
        {
            if (offer_list[socket.username] != undefined)
                for (i = 0; i < offer_list[socket.username].length; i++) {
                    socket.broadcast.to(waiting_clients[offer_list[socket.username][i]]).emit('answer', {
                        answer: 'n'
                    });
                    delete waiting_clients[offer_list[socket.username][i]];
                }
        }

        delete offer_list[socket.username];
        delete connected_clients[socket.username];
        delete logged_clients[socket.username];
        delete waiting_clients[socket.username];
        io.sockets.emit("updateUsersList", Object.keys(connected_clients));
    });

    socket.on("offer", function (username) {
        // remove socket.username form connected_clients
        // then emit list again
        // console.log("Sending offer to " + username + " from " + socket.username);
        if (offer_list[username] != undefined) {
            offer_list[username].push(socket.username);
            var user = connected_clients[username];
            waiting_clients[socket.username] = socket.id;
            delete connected_clients[socket.username];
            io.sockets.emit('updateUsersList', Object.keys(connected_clients));
            if (waiting_clients[username] == null) { //if user is not in waiting list
                // console.log("Test username " + username);
                socket.broadcast.to(user).emit("offer", {
                    username: socket.username,
                    pid: socket.id
                });
            }
        } else if (logged_clients[username] == undefined) {
            //imitate answer == 'n'
            socket.broadcast.to(socket.id).emit('answer', {
                answer: 'n'
            });
            delete offer_list[username];
            io.sockets.emit('updateUsersList', Object.keys(connected_clients));
            // if answer is no add the username to connected_clients
            // then emit list again
        } else {
            offer_list[username] = [];
            offer_list[username].push(socket.username);
            var user = connected_clients[username];
            waiting_clients[socket.username] = socket.id;
            delete connected_clients[socket.username];
            io.sockets.emit('updateUsersList', Object.keys(connected_clients));
            if (waiting_clients[username] == null) { //if user is not in waiting list
                // console.log("Test username " + username);
                socket.broadcast.to(user).emit("offer", {
                    username: socket.username,
                    pid: socket.id
                });
            }
        }
    });

    socket.on("answer", function (msg) {
        username = msg.username;
        answer = msg.answer;
        // console.log("Sending answer  '" + answer + "' to " + username + " from " + socket.username);
        if (answer === 'n') {
            socket.broadcast.to(waiting_clients[username]).emit('answer', {
                answer: answer
            });
            connected_clients[username] = waiting_clients[username];
            delete waiting_clients[username];
            io.sockets.emit('updateUsersList', Object.keys(connected_clients));
            if (offer_list[socket.username] != undefined) {
                offer_list[socket.username].splice(offer_list[socket.username].indexOf(username), 1);
            }
            // if answer is no add the username to connected_clients
            // then emit list again
        } else {
            socket.partnerid = waiting_clients[username];
            socket.partner = username;
            socket.broadcast.to(waiting_clients[username]).emit('answer', {
                answer: answer,
                partner: socket.username,
                partnerid: socket.id
            });
            if (offer_list[socket.username] != undefined)
                for (i = 0; i < offer_list[socket.username].length; i++) {
                    if (waiting_clients[offer_list[socket.username][i]] != waiting_clients[username]) {
                        socket.broadcast.to(waiting_clients[offer_list[socket.username][i]]).emit('answer', {
                            answer: 'n'
                        });
                        connected_clients[offer_list[socket.username][i]] = waiting_clients[offer_list[socket.username][i]];
                        // console.log("Adding " + offer_list[socket.username][i] + " to available clients");
                        // console.log(connected_clients);
                        delete waiting_clients[offer_list[socket.username][i]];
                    }
                }
            if (offer_list[username] != undefined) {
                for (i = 0; i < offer_list[username].length; i++) {
                    socket.broadcast.to(waiting_clients[offer_list[username][i]]).emit('answer', {
                        answer: 'n'
                    });
                    connected_clients[offer_list[username][i]] = waiting_clients[offer_list[username][i]];
                    // console.log("Adding " + offer_list[username][i] + " to available clients");
                    // console.log(connected_clients);
                    delete waiting_clients[offer_list[username][i]];
                }
            }
            delete connected_clients[socket.username];
            delete connected_clients[username];
            io.sockets.emit('updateUsersList', Object.keys(connected_clients));
            // console.log(connected_clients);
            socket.partner = username;
            socket.partnerid = waiting_clients[username];
            delete offer_list[socket.username];
            delete offer_list[username];
        }
    });

    socket.on('cancel', function (target_username) {

        delete waiting_clients[socket.username];

        if (offer_list[target_username] != undefined) {
            offer_list[target_username] = removeA(offer_list[target_username], socket.username);
        }
        temp = console.log("Target Username :" + target_username);
        // console.log("Offer List :" + offer_list[target_username]);

        connected_clients[socket.username] = socket.id;
        logged_clients[socket.username] = socket.id;

        io.sockets.emit('updateUsersList', Object.keys(connected_clients));

        socket.broadcast.to(logged_clients[target_username]).emit('cancel', offer_list[target_username]);
    });

    socket.on("candidate", function (msg) {
        username = msg.username;
        candidate = msg.candidate;
        var user = logged_clients[username];
        socket.partnerid = logged_clients[msg.username];

        // console.log(username, socket.partnerid);
        if (user != null) {
            socket.partner = username;
            // console.log("Sending candidate to: ", username);
            socket.broadcast.to(user).emit("candidate", candidate);
        }
    });

    socket.on("session-desc", function (msg) {
        username = msg.target;
        // console.log("Sending session-desc to: ", username);
        var user = logged_clients[username];
        socket.broadcast.to(user).emit("session-desc", msg);
    });

    socket.on("file-desc", function (msg) {
        username = msg.target;
        fileData = msg.fileData;
        var user = logged_clients[username];
        if (user != null) {
            // console.log("Sending file-desc to: ", username);
            socket.broadcast.to(user).emit("file-desc", fileData);
        }
    });

    socket.on("file accepted", function (username) {
        var user = logged_clients[username];
        if (user != null) socket.broadcast.to(user).emit("file accepted");
    });

    socket.on("file refused", function (username) {
        var user = logged_clients[username];
        if (user != null) socket.broadcast.to(user).emit("file refused");

    });

    socket.on("received-chunks", function (msg) {
        var user = logged_clients[msg.username];
        if (user != null) {
            socket.broadcast.to(user).emit("received-chunks", msg.progress);
            //  console.log("progress: "+msg.progress);
        }
    });

    socket.on("Cancel Connection", function (username) {
        var user = logged_clients[username];
        if (user != null) socket.broadcast.to(user).emit("Cancel Connection");

        connected_clients[socket.username] = socket.id;
        connected_clients[username] = logged_clients[username];

        //These 4 statements are just a precaution to prevent breaking.

        delete waiting_clients[socket.username];
        delete waiting_clients[username];
        delete offer_list[socket.username];
        delete offer_list[username];

        io.sockets.emit('updateUsersList', Object.keys(connected_clients));

    });
});

function removeA(arr) {
    var what, a = arguments,
        L = a.length,
        ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax = arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}
function compare(a,b){
    var x = parseInt(a.points);
    var y = parseInt(b.points);
    if (x>y) return -1;
    else if (x<y) return +1;
    else return 0;
}
