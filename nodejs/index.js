var app = require('express')();
var readline = require('readline');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var fs = require('fs');
var https = require('http').Server(app);
var io = require('socket.io')(https);
var gio = io.of('/six-neck');
var spawn = require('child_process').spawn;

var port = process.argv.length > 2 ? process.argv[2] : 3000;
var jailpath = 'jail/jail-' + port + '/';

var storageb = multer.diskStorage({
	destination: jailpath,
	filename: function(req, file, cb){
		cb(null, 'aib.cc')
	}
});
var uploadb = multer({storage: storageb});

var storagew = multer.diskStorage({
	destination: jailpath,
	filename: function(req, file, cb){
		cb(null, 'aiw.cc')
	}
});
var uploadw = multer({storage: storagew});

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/* Block setting mode. */
var blockmode = false;

/* Outdated features. */
var ai = null;			/* Input stream from AI. */
var aiproc = null;		/* Child process executing AI. */
var aimode = false;		/* AI mode. Default to false. */
var aiturn = -1;		/* AI turn. */
var aitimeout = null;	/* AI time limit. */
var aicompiling = false;	/* AI compiling time. */

/* AI compilation. */
var bcompile_err_msg = '';
var wcompile_err_msg = '';

/* AI settings. */
var timeLimit = 7;

/* Current features. */
var aiblack = false;
var aiwhite = false;

var aib = null;
var aibproc = null;
var aibtimeout = null;
var aibcompiling = false;

var aiw = null;
var aiwproc = null;
var aiwtimeout = null;
var aiwcompiling = false;

var turn = 0;		/* 0: Black, 1: White */
var end = false;
var cnt = 1;		/* 2 stones per turn except first */
var boardcnt = 0;	/* Deprecated */
var board = new Array(19);		/* Six-neck array */
init_board();

var blocklist = new Array(10);	/* Block list */
var block_sz = 0;

var hist = new Array(361);				/* History. */
var hist_sz = 0;
var hist_end = -1;
var cur = 0;

var users = 1;					/* User id. */
var userlist = new UserList();

var favicon = require('serve-favicon');
app.use(favicon(__dirname + '/public/images/favicon.ico'));

app.use(cookieParser());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());
/*
app.use(function(req, res, next) {
    if((!req.secure) && (req.get('X-Forwarded-Proto') !== 'https')) {
        res.redirect('https://www.' + req.get('Host') + req.url);
    }
    else
        next();
});
*/

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
	/*
	var data = fs.readFileSync(__dirname + '/index.html', 'utf8');
	if (data){
		res.send(data.replace('#port#', port));
	}
	*/
});

app.get('/images/:id', function(req, res){
	var src = req.params.id;
	res.sendFile(__dirname + '/images/' + src);
});

app.get('/index.css', function(req, res){
	res.sendFile(__dirname + '/index.css');
});

app.get('/aib.html', function(req, res){
	res.sendFile(__dirname + '/aib.html');
});

app.get('/aiw.html', function(req, res){
	res.sendFile(__dirname + '/aiw.html');
});

app.post('/uploadb', uploadb.single('aibfile'), function(req, res){
	if (aiblack){
		gio.emit('notice', 'Black AI is still running.');
	}
	else if (aibcompiling){
		gio.emit('notice', 'Black AI is being compiled.')
	}
	else {
		aibcompiling = true;
		console.log('upload request');
		var gcc = spawn('g++', [jailpath + 'aib.cc', '-o', jailpath + 'aib', '-O2', '-std=c++14', '-static']);
		bcompile_err_msg = '';
		gcc.on('exit', function(code){
			if (code == 0){
				gio.emit('notice', 'Black AI: Compilation successfull.');
			}
			else {
				gio.emit('notice', 'Black AI: Compilation error.');
				console.log('Compilation error message:\n' + bcompile_err_msg);
			}
			aibcompiling = false;
		});
		gcc.stderr.on('data', function(data){
			bcompile_err_msg += data;
		});
	}
	res.end('<body onload=\'window.close();\'></body>');
});

app.post('/uploadw', uploadw.single('aiwfile'), function(req, res){
	if (aiwhite){
		gio.emit('notice', 'White AI is still running.');
	}
	else if (aiwcompiling){
		gio.emit('notice', 'White AI is being compiled.')
	}
	else {
		aiwcompiling = true;
		console.log('upload request');
		var gcc = spawn('g++', [jailpath + 'aiw.cc', '-o', jailpath + 'aiw', '-O2', '-std=c++14', '-static']);
		wcompile_err_msg = '';
		gcc.on('exit', function(code){
			if (code == 0){
				gio.emit('notice', 'White AI: Compilation successfull.');
			}
			else {
				gio.emit('notice', 'White AI: Compilation error.');
				console.log('Compilation error message:\n' + wcompile_err_msg);
			}
			aiwcompiling = false;
		});
		gcc.stderr.on('data', function(data){
			wcompile_err_msg += data;
		});
	}
	res.end('<body onload=\'window.close();\'></body>');
});

app.all('*', function(req, res){
	res.status(404).send('<h3>ERROR - 404 Page Not Found</h3>');
});

rl.on('line', function(input){
	if (input == 'stop'){
		gio.emit('server close');
		if (aiblack){
			closeAI(0);
		}
		if (aiwhite){
			closeAI(1);
		}
		process.exit();
	}
});

https.listen(port, function(){
	console.log('listening on *:' + port);
});

gio.on('connection', function(socket){
	var userid = users++;
	var username = userid < 10000 ? 'Guest_' + padNumber(userid) : 'Guest_' + userid;
	var user = register(socket.id, username);
	console.log('connection from ' + user.name);
	socket.emit('init', aiblack, aiwhite, blockmode, blocklist, block_sz, hist, hist_sz, cur, user.name, end);
	gio.emit('notice', user.name + ' joined.');
	gio.emit('users', userlistToArray());

	socket.on('block', function(){
		if (!aiblack && !aiwhite && cur == 0){
			blockmode = true;
			gio.emit('block mode');
		}
	});

	socket.on('block done', function(){
		if (block_sz % 2 == 0 && blockmode){
			blockmode = false;
			gio.emit('game mode');
		}
	});

	socket.on('ailaunch', function(opt){
		if (!blockmode && !aiblack && !aiwhite && cur == 0){
			if (((opt % 2 == 1) && aibcompiling) || ((opt > 1) && aiwcompiling)){
				socket.emit('alert', 'AI is being compiled.');
			}
			else if (opt > 0){
				if (opt % 2 == 1){
					aiblack = true;
					aibproc = spawn(jailpath + 'sandbox', [jailpath + 'aib']);
					aib = readline.createInterface({
						input: aibproc.stdout,
						terminal: false
					});
					aib.on('line', function(line){
						if (aiblack){
							var coord = line.split(/[ ,]+/);
							if (coord == null || (coord.length != 2 && coord.length != 4)){
								invalid_output(0);
							}
							else {
								var tok;
								for (tok = 0; tok < coord.length; tok += 2){
									var i = parseInt(coord[tok]);
									var j = parseInt(coord[tok + 1]);
									if (turn == 1 || isNaN(i) || isNaN(j) || !valid(i, j)){
										invalid_output(0);
										break;
									}
									else if (!end){
										board_place(i, j);
										if (aiwhite) aiwproc.stdin.write(i + ' ' + j + '\n');
									}
								}
							}
						}
					});

					aibproc.stdin.write(block_sz + '\n');
					for (i=0; i<block_sz; i++){
						aibproc.stdin.write(blocklist[i].x + ' ' + blocklist[i].y + '\n');
					}
					aibproc.stdin.write(timeLimit + '\n');
					aibproc.stdin.write('0\n');
					aibtimeout = setTimeout(timelimit, 1000 * timeLimit, 0);

					aibproc.on('exit', function(code){
						if (aiblack){
							console.log('Black AI exited with code ' + code);
							if (code != 0) runtime_error(0);
							else closeAI(0);
						}
					});
					aibproc.on('error', function(err){
						if (aiblack){
							console.log('ERROR: error occurred executing AI.');
							execution_error(0);
						}
					});
					aibproc.stderr.on('data', function(data){
						console.log('' + data);
					});
					aibproc.stdin.on('error', function(err){
						console.log('WARNING: The process\' stdin is closed!');
					});
				}
				if (opt > 1){
					aiwhite = true;
					aiwproc = spawn(jailpath + 'sandbox', [jailpath + 'aiw']);
					aiw = readline.createInterface({
						input: aiwproc.stdout,
						terminal: false
					});
					aiw.on('line', function(line){
						if (aiwhite){
							var coord = line.split(/[ ,]+/);
							if (coord == null || (coord.length != 2 && coord.length != 4)){
								invalid_output(1);
							}
							else {
								var tok;
								for (tok = 0; tok < coord.length; tok += 2){
									var i = parseInt(coord[tok]);
									var j = parseInt(coord[tok + 1]);
									if (turn == 0 || isNaN(i) || isNaN(j) || !valid(i, j)){
										invalid_output(1);
										break;
									}
									else if (!end){
										board_place(i, j);
										if (aiblack) aibproc.stdin.write(i + ' ' + j + '\n');
									}
								}
							}
						}
					});

					aiwproc.stdin.write(block_sz + '\n');
					for (i=0; i<block_sz; i++){
						aiwproc.stdin.write(blocklist[i].x + ' ' + blocklist[i].y + '\n');
					}
					aiwproc.stdin.write(timeLimit + '\n');
					aiwproc.stdin.write('1\n');

					aiwproc.on('exit', function(code){
						if (aiwhite){
							if (code != 0) runtime_error(1);
							else closeAI(1);
						}
					});
					aiwproc.on('error', function(err){
						if (aiwhite){
							console.log('ERROR: error occurred executing AI.');
							execution_error(1);
						}
					});
					aiwproc.stderr.on('data', function(data){
						console.log('' + data);
					});
					aiwproc.stdin.on('error', function(err){
						console.log('WARNING: The process\' stdin is closed!');
					});
				}
				gio.emit('aiaccept', opt);
			}
		}
	});

	socket.on('kill', function(num){
		console.log('kill request');
		if (num == 0 && aiblack){
			socket.emit('notice', user.name + ' stopped Black AI.');
			closeAI(0);
		}
		else if (num == 1 && aiwhite){
			socket.emit('notice', user.name + ' stopped White AI.');
			closeAI(1);
		}
	});

	socket.on('place', function(i, j){
		if (blockmode){
			if (i >= 0 && i < 19 && j >= 0 && j < 19){
				board_block(i, j);
			}
		}
		else if (!end && valid(i, j)){
			if (turn == 0 && !aiblack){
				board_place(i, j);
				if (aiwhite) aiwproc.stdin.write(i + ' ' + j + '\n');
			}
			else if (turn == 1 && !aiwhite){
				board_place(i, j);
				if (aiblack) aibproc.stdin.write(i + ' ' + j + '\n');
			}
		}
	});

	socket.on('redo', function(redocnt){
		if (!blockmode && !aiblack && !aiwhite && cur < hist_sz){
			console.log('redo request');
			while (cur < hist_sz && redocnt > 0){
				board_redo();
				redocnt--;
			}
		}
	});

	socket.on('undo', function(undocnt){
		if (!blockmode && !aiblack && !aiwhite && cur > 0){
			console.log('undo request');
			while (cur > 0 && undocnt > 0){
				board_undo();
				undocnt--;
			}
		}
	})

	socket.on('reset', function(){
		console.log('reset');
		board_reset();
		gio.emit('reset');
	});

	socket.on('username', function(name){
		if (isValidName(name)){
			var log = user.name + ' changed the username to ' + name + '.';
			console.log(log);
			user.name = name;
			socket.emit('you', name);
			gio.emit('notice', log);
			gio.emit('users', userlistToArray());
		}
		else {
			socket.emit('alert', 'Invalid username. Does your name contain \'Guest?\'\nIf not, maybe someone is using that name..');
		}
	})

	socket.on('chat', function(msg){
		if (msg.charAt(0) != '/'){
			if (msg != '' && msg.length <= 100) gio.emit('public chat', user.name, msg);
		}
		else {
			var cmd = msg.split(' ');
			var err_msg = 'Wrong usage.';
			var no_permission = 'You have no permission for this command.';
			switch(cmd[0]){
				case '/aitime':
				if (cmd.length >= 2){
					if (isNaN(cmd[1])){
						socket.emit('notice', err_msg);
					}
					else {
						timeLimit = parseInt(cmd[1]);
						gio.emit('notice', 'AI time limit was set to ' + timeLimit + 's.');
					}
				}
				else {
					socket.emit('notice', err_msg);
				}
				break;
				case '/bcerr':
				socket.emit('alert', bcompile_err_msg);
				break;
				case '/wcerr':
				socket.emit('alert', wcompile_err_msg);
				break;
				default:
				socket.emit('notice', 'Unknown command.');
			}
		}
	});

	socket.on('disconnect', function(){
		removeUser(user);
		console.log(user.name + ' disconnected.');
		gio.emit('notice', user.name + ' left.');
		gio.emit('users', userlistToArray());
	});
});

function closeAI(i){
	gio.emit('aiterm', i);
	if (i == 0){
		clearTimeout(aibtimeout);
		aiblack = false;
		aib.close();
		aibproc.kill();
	}
	else {
		clearTimeout(aiwtimeout);
		aiwhite = false;
		aiw.close();
		aiwproc.kill();
	}
}

function execution_error(i){
	if (i == 0) gio.emit('notice', 'Black AI: Execution failed.');
	else gio.emit('notice', 'White AI: Execution failed.');
	closeAI(i);
}

function timelimit(i){
	if (i == 0) gio.emit('notice', 'Black AI: Time limit exceeded. (' + timeLimit + 's)');
	else gio.emit('notice', 'White AI: Time limit exceeded. (' + timeLimit + 's)');
	closeAI(i);
}

function runtime_error(i){
	if (i == 0) gio.emit('notice', 'Black AI: Runtime error.');
	else gio.emit('notice', 'White AI: Runtime error.');
	closeAI(i);
}

function invalid_output(i){
	if (i == 0) gio.emit('notice', 'Black AI: Invalid output.');
	else gio.emit('notice', 'White AI: Invalid output.');
	closeAI(i);
}

function board_undo(){
	end = false;
	var pt = hist[--cur];
	board[pt.x][pt.y] = -1;
	if (cnt == 2){
		cnt = 0;
		turn = 1 - turn;
	}
	cnt++;
	gio.emit('rollback');
}

function board_redo(){
	var pt = hist[cur++];
	cnt--;
	if (cnt == 0){
		cnt = 2;
		turn = 1 - turn;
	}
	end = (cur == hist_end);
	gio.emit('restore', cur == hist_end);
}

function board_block(i, j){
	console.log('blocked (' + i + ', ' + j + ').');
	if (board[i][j] == -1 && block_sz < 10){
		blocklist[block_sz++] = new Point(i, j);
		board[i][j] = 2;
	}
	else {
		/* Delete */
		var idx, it;
		for (idx=0; idx<block_sz; idx++){
			if (blocklist[idx].x == i && blocklist[idx].y == j) break;
		}
		for (it=idx; it<block_sz-1; it++){
			blocklist[it] = blocklist[it+1];
		}
		block_sz--;
		board[i][j] = -1;
	}
	gio.emit('place', i, j);
}

function board_place(i, j){
	if (turn == 0) console.log('black locate on (' + i + ', ' + j + ').');
	else console.log('white locate on (' + i + ', ' + j + ').');
	board[i][j] = turn;
	hist[cur++] = new Point(i, j);
	hist_sz = cur;
	var prev_turn = turn;
	cnt--;
	if (cnt == 0){
		cnt = 2;
		turn = 1 - turn;
	}
	gio.emit('place', i, j);
	if (consecutive(i, j, prev_turn, 7)){
		hist_end = cur;
		if (prev_turn == 0) console.log('white win');
		else console.log('black win');
		gio.emit('win', 1 - prev_turn);
		if (aiblack){
			closeAI(0);
		}
		if (aiwhite){
			closeAI(1);
		}
		end = true;
	}
	else if (consecutive(i, j, prev_turn, 6)){
		hist_end = cur;
		if (prev_turn == 0) console.log('black win');
		else console.log('white win');
		gio.emit('win', prev_turn);
		if (aiblack){
			closeAI(0);
		}
		if (aiwhite){
			closeAI(1);
		}
		end = true;
	}
	else if (cur + block_sz == 19 * 19){
		gio.emit('tie');
		if (aiblack){
			closeAI(0);
		}
		if (aiwhite){
			closeAI(1);
		}
		end = true;
	}
	else if (cnt == 2){
		if (aiblack){
			if (turn == 1){
				clearTimeout(aibtimeout);
			}
			else {
				aibtimeout = setTimeout(timelimit, 1000 * timeLimit, 0);
			}
		}
		if (aiwhite){
			if (turn == 0){
				clearTimeout(aiwtimeout);
			}
			else {
				aiwtimeout = setTimeout(timelimit, 1000 * timeLimit, 1);
			}
		}
	}
}

function init_board(){
	var i, j;
	for (i=0; i<19; i++){
		board[i] = new Array(19);
		for (j=0; j<19; j++){
			board[i][j] = -1;
		}
	}
}

function board_reset(){
	var i, j;
	if (blockmode){
		for (i=0; i<block_sz; i++){
			board[blocklist[i].x][blocklist[i].y] = -1;
		}
		block_sz = 0;
	}
	else {
		for (i=0; i<19; i++){
			for (j=0; j<19; j++){
				if (board[i][j] != 2) board[i][j] = -1;
			}
		}
		turn = 0;
		start = true;
		end = false;
		cnt = 1;
		hist_sz = 0;
		cur = 0;
		hist_end = -1;
		if (aiblack){
			closeAI(0);
		}
		if (aiwhite){
			closeAI(1);
		}
	}
}

function valid(x, y){
	return x >= 0 && x < 19 && y >= 0 && y < 19 && board[x][y] == -1;
}

function consecutive(x, y, turn, num){
	/* Check up and down */
	var i = x, j = y, k;
	var line = 0;
	for (i=x-1; i>=0; i--){
		if (board[i][j] != turn && board[i][j] != 2) break;
		line++;
	}
	for (i=x+1; i<19; i++){
		if (board[i][j] != turn && board[i][j] != 2) break;
		line++;
	}
	if (line >= num - 1) return true;
	line = 0;
	i = x;
	j = y;
	/* Check left and right */
	for (j=y-1; j>=0; j--){
		if (board[i][j] != turn && board[i][j] != 2) break;
		line++;
	}
	for (j=y+1; j<19; j++){
		if (board[i][j] != turn && board[i][j] != 2) break;
		line++;
	}
	if (line >= num - 1) return true;
	line = 0;
	i = x;
	j = y;
	/* Check y = x */
	for (k=1; i+k<19 && j+k<19; k++){
		if (board[i+k][j+k] != turn && board[i+k][j+k] != 2) break;
		line++;
	}
	for (k=1; i-k>=0 && j-k>=0; k++){
		if (board[i-k][j-k] != turn && board[i-k][j-k] != 2) break;
		line++;
	}
	if (line >= num - 1) return true;
	line = 0;
	/* Check y = -x */
	for (k=1; i+k<19 && j-k>=0; k++){
		if (board[i+k][j-k] != turn && board[i+k][j-k] != 2) break;
		line++;
	}
	for (k=1; i-k>=0 && j+k<19; k++){
		if (board[i-k][j+k] != turn && board[i-k][j+k] != 2) break;
		line++;
	}
	if (line >= num - 1) return true;
	return false;
}

function Point(x, y, turn){
	this.x = x;
	this.y = y;
	this.turn = turn;
}

function UserList(){
	this.head = new User(null, null);
	this.tail = new User(null, null);
	this.addUser = addUser;

	this.head.next = this.tail;
	this.tail.prev = this.head;
}

function addUser(user){
	var last = this.tail.prev;
	last.next = user;
	user.prev = last;
	user.next = this.tail;
	this.tail.prev = user;
}

function removeUser(user){
	user.prev.next = user.next;
	user.next.prev = user.prev;
}

function register(socketid, username){
	var user = new User(socketid, username);
	userlist.addUser(user);
	return user;
}

function User(socketid, username){
	this.id = socketid;
	this.name = username;
}

function isValidName(username){
	if (username == ''
		|| /\s/.test(username)
		|| username.length > 20
		|| username.substring(0, 5) == 'Guest') return false;
	for (var user = userlist.head.next; user != userlist.tail; user = user.next){
		if (user.name == username) return false;
	}
	return true;
}

function userlistToArray(){
	var userarray = new Array();
	for (var user = userlist.head.next; user != userlist.tail; user = user.next){
		userarray.push(user.name);
	}
	return userarray;
}

/* Got this function from
http://stackoverflow.com/questions/29751340/how-to-print-always-4-digits-on-javascript
. Thanks to ArtOfCode. */
function padNumber(number) {
    number = number.toString();

    while(number.length < 4) {
        number = "0" + number;
    }

    return number;
}
