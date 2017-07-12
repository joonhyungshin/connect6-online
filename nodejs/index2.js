var app = require('express')();
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var gio = io.of('/six-neck');

var turn = 0;		/* 0: Black, 1: White */
var end = false;
var cnt = 1;		/* 2 stones per turn except first */
var board = new Array(19);		/* Six-neck array */
for (i=0; i<19; i++){
	board[i] = new Array(19);
	for (j=0; j<19; j++){
		board[i][j] = -1;		/* -1 means nothing in the board */
	}
}
var prev = [];					/* Previous position 2 */

app.use(cookieParser());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

app.get('/', function(req, res){
	res.redirect('/six-neck');
});

app.get('/six-neck', function(req, res){
	res.sendFile(__dirname + '/index2.html');
});

app.get('/images/:id', function(req, res){
	var src = req.params.id;
	res.sendFile(__dirname + '/images/' + src);
});

app.all('*', function(req, res){
	res.status(404).send('<h3>ERROR - Page Not Found</h3>');
});

http.listen(8080, function(){
	console.log('listening on *:8080')
});

gio.on('connection', function(socket){
	console.log('Connection with ID ' + socket.id);
	socket.on('test', function(){
		console.log('Test socket received.');
		socket.emit('test success');
	});

	socket.on('place', function(i, j){
		if (!end && i < 19 && j < 19 && board[i][j] == -1){
			if (turn == 0) console.log('black locate on (' + i + ', ' + j + ').');
			else console.log('white locate on (' + i + ', ' + j + ').');
			if (cnt == 2){
				gio.emit('place', i, j, turn, prev);
				while (prev.length > 0){
					var pt = prev.pop();
					board[pt.x][pt.y] -= 2;
				}
			}
			else {
				gio.emit('place', i, j, turn, null);
			}
			prev.push(new Point(i, j, turn));
			board[i][j] = turn + 2;
			if (six_check(i, j, turn)){
				gio.emit('win', turn);
				end = true;
			}
			else {
				cnt--;
				if (cnt == 0){
					cnt = 2;
					turn = 1 - turn;
				}
			}
		}
	});

	socket.on('reset', function(){
		console.log('reset');
		board_reset();
		gio.emit('reset', board, 0, 1);
	});

	socket.on('board stat', function(){
		console.log('stat request');
		socket.emit('reset', board, turn, cnt);
		if (end) socket.emit('win', turn);
	});
});

function board_reset(){
	for (i=0; i<19; i++){
		for (j=0; j<19; j++){
			board[i][j] = -1;
		}
	}
	turn = 0;
	start = true;
	end = false;
	cnt = 1;
	prev = [];
}

function six_check(x, y, turn){
	/* Check up and down */
	var i = x, j = y, k;
	var line = 0;
	for (i=x-1; i>=0; i--){
		if (board[i][j]%2 != turn) break;
		line++;
	}
	for (i=x+1; i<19; i++){
		if (board[i][j]%2 != turn) break;
		line++;
	}
	if (line == 5) return true;
	line = 0;
	i = x;
	j = y;
	/* Check left and right */
	for (j=y-1; j>=0; j--){
		if (board[i][j]%2 != turn) break;
		line++;
	}
	for (j=y+1; j<19; j++){
		if (board[i][j]%2 != turn) break;
		line++;
	}
	if (line == 5) return true;
	line = 0;
	i = x;
	j = y;
	/* Check y = x */
	for (k=1; i+k<19 && j+k<19; k++){
		if (board[i+k][j+k]%2 != turn) break;
		line++;
	}
	for (k=1; i-k>=0 && j-k>=0; k++){
		if (board[i-k][j-k]%2 != turn) break;
		line++;
	}
	if (line == 5) return true;
	line = 0;
	/* Check y = -x */
	for (k=1; i+k<19 && j-k>=0; k++){
		if (board[i+k][j-k]%2 != turn) break;
		line++;
	}
	for (k=1; i-k>=0 && j+k<19; k++){
		if (board[i-k][j+k]%2 != turn) break;
		line++;
	}
	if (line == 5) return true;
	return false;
}

function Point(x, y, turn){
	this.x = x;
	this.y = y;
	this.turn = turn;
}