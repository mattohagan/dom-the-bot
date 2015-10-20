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

app.post('/slack/snag', function(req, res){
	var helpString = getWelcoming() + " To reserve a room, follow this format and be sure to include the | character: \n"+
		"```/snag [east OR west OR florida] | [start]-[end] | [day] [month] | [company name]```\n"+
		"example use: \n"+
		"```/snag east | 11am-1:15pm | 24 oct | HackFSU```";
	
	var text = req.body.text;
	text = trim(text);

	// HELP COMMAND
	if(text == 'help' || text == 'Help' || text == 'HELP')
		res.send(helpString);

	// | CHARACTER NOT INCLUDED
	if(text.indexOf('|') == -1){
		var response = "Don't forget to use the | character! Here's your text again if you want to reuse it: \n"+
			"```"+text+"```";
		res.send(response);
	}

	// CREATE A ROOM REQUEST
	var userId = req.body.user_id;
	var data = createRequest(text, userId);

	var response = formatResponse(data);
	response += '\n \n *Snag this room? (y/n)*';

	reservationQueue.userId = data;
	res.send(response);
});

// return a randomized welcoming string
function getWelcoming(){
	var rand = Math.floor((Math.random() * 8) + 1);
	var titleString;

	switch(rand){
	case 1:
	  titleString = "Welcome!";
	  break;
	case 2:
	  titleString = "Aloha!";
	  break;
	case 3:
	  titleString = "Cheers!";
	  break;
	case 4:
	  titleString = "Salutations!";
	  break;
	case 5:
	  titleString = "Hello!";
	  break;
	case 6:
	  titleString = "Greetings!";
	  break;
	case 7:
	  titleString = "Bonjour!";
	  break;
	default:
	  titleString = "Good Day!";
	  break;
	}

	return titleString;
}



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
		'*Email:* '+data.email + '\n' +
		'*Company:* '+ data.company + '\n' +
		'*Room:* ' + data.room + '\n' +
		'*Date:* ' + data.day + '/' + data.month + '\n' + 
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














