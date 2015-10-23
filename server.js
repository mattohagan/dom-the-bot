var express = require('express');
var app = express();
var dotenv = require('dotenv');
var Slack = require('slack-client');
var request = require('request');
var bodyParser = require('body-parser');
var trim = require('trim');

app.set('port', (process.env.PORT || 5000));
// needed for parsing requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

dotenv.load();

// set some variables and authorize our slack object
var reservationUrl = "http://domi-room.herokuapp.com/room";
var slackToken = process.env.DOM_API_TOKEN;
var autoReconnect = true;
var autoMark = true;
slack = new Slack(slackToken, autoReconnect, autoMark);

var reservationQueue = {};

// authorize incoming requests
function authRequest(req, res, next){
	var acceptable_tokens = [
		process.env.SNAG_SLACK_TOKEN
	];

	console.log(req.body);

	// check if token is legit
	if(acceptable_tokens.indexOf(req.body.token) === -1){
		res.sendStatus(401);
	}

	next();
}

// app request logic
app.all('*', authRequest);

app.listen(app.get('port'), function() {
    console.log('Server running at port ' + app.get('port').toString());
});


// slack logic
slack.on('open', function(){
	console.log('Connected to '+slack.team.name+' as '+slack.self.name);
});

slack.on('error', function(err){
	console.log('Error'+err);
});

slack.login();

// format the json data into a readable response
function formatResponse(data){
	// new Date(year, month, day, hour, minutes);

	var response = 
		"Just to be sure: \n \n" +
		'*Email:* '+data.email + '\n' +
		'*Company:* '+ data.company + '\n' +
		'*Room:* ' + data.room + '\n' +
		'*Date:* ' + data.day + ' of ' + data.month + '\n' + 
		'*Start:* ' + data.start + '\n'
		'*End:* ' + data.end;

	return response;
}

//createRequest('east | 11am-1:15pm | 24 oct | HackFSU');
function createRequest(text, userId){
	// create array of data
	var sections = text.split('|');

	// get user email
	var user = slack.getUserByID(userId);
	var email = user.profile.email;
	//var email = 'matt@hackfsu.com';

	// get company name and correct room
	var room = trim(sections[0]);
	room = convertToRoom(room);
	var company = trim(sections[sections.length - 1]);

	// get day and month
	var dayAndMonth = trim(sections[2]);
	var dateObj = parseOutDate(dayAndMonth);
	var day = dateObj.day;
	var month = dateObj.month;

	var startAndEnd = trim(sections[1]);
	var timeObj = parseOutTime(startAndEnd);
	var startObj = timeObj.start;
	var endObj = timeObj.end;


	var start = 'start';
	var end = 'end';

	var data = {
		"email": email,
		"company": company,
		"room": room,
		"start": startObj,
		"end": endObj,
		"day": day,
		"month": month
	};

	console.log(data);
	return data;
}

// take in full time section
// if no colon then minutes = 00
// if pm then hours += 12
// return hours and minutes for start and end in an object
// return false if not valid
function parseOutTime(time){
	var dashIndex = time.indexOf('-');
	if(dashIndex != -1){
		var times = time.split('-');
		var timeObj = parseHrAndMin(times[0]);
		var start = timeObj;

		timeObj = parseHrAndMin(times[1]);
		var end = timeObj;
	} else {
		return false;
	}


	if(!start || !end)
		return false;
	else {
		return {
			start: start,
			end: end
		}
	}
}


// take in a user given time string and return 
// the hours and minutes in an object
// used by parseOutTime()
function parseHrAndMin(str){
	var timeOfDay = [
		'am', 'AM', 'pm', 'PM'
	];
	var hr = null;
	var min = null;
	var hrOffset = 0;
	
	// check to make sure am or pm is there
	for (var i = 0; i < timeOfDay.length; i++) {
		dayTimeInd = str.indexOf(timeOfDay[i]);
		if(dayTimeInd != -1){
			dayTime = timeOfDay[i];
			break;	
		}
		
	};


	if(dayTimeInd == -1){
		return false;
	}

	// if colon is found
	var colonInd = str.indexOf(':');
	if(colonInd != -1){

		// 1:15pm
		var num = str.substring(0, colonInd);
		hr = parseInt(num);

		num = str.substring(colonInd + 1, dayTimeInd);
		min = parseInt(num);
	} else {
		// 11am
		min = 0;
		var num = str.substring(0, dayTimeInd);
		hr = parseInt(num);
	}

	// offset time if it's pm
	if(dayTime == 'pm' || dayTime == 'PM' || dayTime == 'Pm' || dayTime == 'pM'){
		hr += 12;
	}

	// if anything went wrong in parsing 
	// then return false

	// DONT KNOW HOW OT CHECK IF ITS NOT A NUMBER
	if(hr == NaN)
		return false;

	return {
		hr: hr,
		min: min
	}
}


// parse out the day and month from the 
// date string given by the user
function parseOutDate(date){
	var day;
	var month;
	var valid = false;

	if(date == 'today' || date == 'Today' || date == 'TODAY'){
		valid = true;
		var today = new Date();
		day = today.getDate();
		month = today.getMonth();
	} else {

		// possible spellings to check for
		var monthArr = [
			'jan', 'january',
			'feb', 'february',
			'mar', 'march',
			'apr', 'april',
			'may',
			'june',
			'july',
			'aug', 'august',
			'sep', 'sept', 'september',
			'oct', 'october',
			'nov', 'november',
			'dec', 'december'
		];

		// check every spelling to see if it's found
		// once found, split up the string into the
		// month and day
		for(var i = 0; i < monthArr.length; i++){
			var index = date.indexOf(monthArr[i]);
			// if found in the string
			if(index != -1){
				valid = true;

				// get last part of string
				var month = date.substring(index);
				// get first part up until the month 
				// then trim incase there's a space or not
				var day = trim(date.substring(0, index));

				break;
			}
		}
	}

	// if nothing was found
	if(!valid)
		return false;

	return {
		day: day,
		month: month 
	};
}

// convert possible spellings of month
// to an integer value between 0 and 11
function monthToInt(month){
	var num;
	switch(month){
		case 'jan':
		case 'january':
			num = 0;
			break;
		case 'feb':
		case 'february':
			num = 1;
			break;
		case 'mar': 
		case 'march':
			num =  2;
			break;
		case 'apr': 
		case 'april':
			num = 3;
			break;
		case 'may':
			num = 4;
			break;
		case 'june':
			num = 5;
			break;
		case 'july':
			num = 6;
			break;
		case 'aug': 
		case 'august':
			num = 7;
			break;
		case 'sep': 
		case 'sept': 
		case 'september':
			num = 8;
			break;
		case 'oct': 
		case 'october':
			num = 9;
			break;
		case 'nov': 
		case 'november':
			num = 10;
			break;
		case 'dec': 
		case 'december':
			num = 11;
			break;
	}

	return num;
}

// take in user input of a room and 
// convert to the official request 
function convertToRoom(string){
	string = string.toLowerCase();
	var room;
	switch(string){
		case 'east':
		case 'east conf':
		case 'east conference room':
			room = 'East Conference Room';
			break;
		case 'west':
		case 'west conf':
		case 'west conference room':
			room = 'West Conference Room';
			break;
		case 'florida':
		case 'florida blue':
		case 'florida blue room':
			room = 'Florida Blue Room';
			break;
		default:
			room = false;
			break;
	}

	return room;
}

function makeReservation(data){
	var options = {
		url: reservationUrl,
		method: 'POST',
		json: data
	}

	request.post(options, function(err, response, body){
		if(err)
			return err;

		console.log('response    '+response);

	});

}

slack.on('message', function(message){
	var channel = slack.getChannelGroupOrDMByID(message.channel);
	var text = message.text;

	// if direct message
	if(channel.is_im){
		var todo = processMessage(text);

		respond[todo](channel, message);
	}
});

// returns a function to be called from the respond object
function processMessage(text){
	var func;
	var responses;
	text = text.toLowerCase();


	// SNAG
	//
	var sub = text.substring(0, 4);
	sub = sub.toLowerCase();
	if(sub == 'snag'){
		return 'snag';
	}
	// HELP
	//
	if(doesContain(text, 'help')){
		return 'help';
	}

	// TIP
	//
	if(doesContain(text, ['tip', 'hint'])){
		return 'tip';
	}

	// HELLO
	//
	responses = [
		'hello', 'hey', 'hi', 'dom', 'hola'
	];

	if(doesContain(text, responses)){
		return 'hello';
	}

	return 'invalid';
}


// object of response functions
var respond = {
	hello: function(channel, message){
		var responses = [
			'Welcome!', 'Aloha!', 'Cheers!', 'Salutations!', 'Hello!', 'Greetings!', 'Bonjour!', 'Good Day!'
		];
		channel.send(pickRandom(responses));
	},

	help: function(channel, message){
		var helpString = "To reserve a room, follow this format and be sure to include the | character: \n"+
		"```snag [east OR west OR florida] | [start][am/pm]-[end][am/pm] | [day] [month] | [company name]```\n"+
		"example use: \n"+
		"```snag east | 11am-1:15pm | 24 oct | HackFSU```";
		channel.send(helpString);
	},

	invalid: function(channel, message){
		var responses = [
			"I didn't quite catch that.", "Could you try again?"
		];
		channel.send(pickRandom(responses));
	},

	tip: function(channel, message){
		var responses = [
			"Don't forget to clean your own dishes! :droplet::fork_and_knife:", "You can use `today` instead of `[day] [month]` when reserving a room :thumbsup:"
		];

		channel.send(pickRandom(responses));
	},

	snag: function(channel, message){
		text = trim(message.text);

		if(text.length < 6){
		// NOT ENOUGH INFO
			this.help(channel, message);
		} else if (text.indexOf('|') == -1){
		// | CHARACTER NOT INCLUDED

			var response = "Don't forget to use the | character! Here's your text again if you want to reuse it: \n"+
				"```"+text+"```";

			channel.send(response);
		} else {
		// CREATE A ROOM REQUEST
			var userId = message.user;
			// get rid of snag at the beginning
			var sub = text.substring(4);
			var requestText = trim(sub);

			// main parsing of request
			var data = createRequest(requestText, userId);

			// readable format for user
			var response = formatResponse(data);
			response += '\n \n \n *Snag this room? (y/n)*';

			reservationQueue.userId = data;
			channel.send(response);
		}
	}
}



//// UTILITY FUNCTIONS 
////


// pick a random string in a given list
// used right now to pick from a set of random responses
function pickRandom(arr){
	var rand = Math.floor((Math.random() * arr.length));
	return arr[rand];
}

// returns if the given text contains any given trigger word(s)
function doesContain(text, responses){
	var contains = false;

	if(typeof(responses) == 'string'){
		if(text.indexOf(responses) != -1)
			contains = true;
	} else {
		for(var i = 0; i < responses.length; i++){
			if(text.indexOf(responses[i]) != -1){
				contains = true;
				break;
			}
		}
	}

	return contains;
}







