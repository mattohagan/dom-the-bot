var request = require('request');
var moment = require('moment');

module.exports = function(app) {
	// return helpers object
	return {
		// basic snag help
		help: function(channel){
			var helpString = "You can reserve a room one of two ways: \n \n" +
				"*OPTION 1* \n Follow this format and submit the reservation in one fell swoop. \n" +
				"```snag [east OR west OR florida], [start][am/pm]-[end][am/pm], [day] [month], [company name]```\n"+
				"example: \n"+
				"`snag east, 11am-1:15pm, 24 oct, HackFSU` \n \n" +
				"*OPTION 2* \n Simply use `snag start` and I'll walk you through building a room reservation.";

			channel.send(helpString);
		},

		// help with formatting the long string
		formatHelp: function(channel){
			var helpString = "To reserve a room all at once, follow this format and be sure to include commas! \n"+
			"```snag [east OR west OR florida], [start][am/pm]-[end][am/pm], [day] [month], [company name]```\n"+
			"example: \n"+
			"`snag east, 11am-1:15pm, 24 oct, HackFSU`";

			channel.send(helpString);
		},

		// pick which way user wants to reserve a room
		pick: function(channel, message){
			var text = app.helpers.trim(message.text);

			if(app.helpers.doesContain(text, 'help')){
				this.help(channel);
			} else if(app.helpers.doesContain(text, 'start')){
				this.start(channel, message);
			} else if (text.length > 15){
				this.formatted(channel, message);
			} else {
				this.help(channel);
			}
		},

		start: function(channel, message){
			// init username object
			app.reservationQueue.username = {};
			channel.send("Awesome, let's start by picking the room.");
			channel.send("- `florida` \n - `east` \n - `west`");

			// set next state
			app.userStates.username = {
				state: 'getRoom',
				process: 'snag'
			};
		},

		getRoom: function(channel, message){
			var text = app.helpers.trim(message.text);

			var room = convertToRoom(text);

			if(!room){
				channel.send("I didn't quite get that, could you try picking the room again?");
				channel.send("- `florida` \n - `east` \n - `west`");
			} else {
			// success
				var username = app.helpers.getUsernameById(message.user);
				// store room
				app.reservationQueue.username.room = room;

				channel.send("Next up, pick your time slots.");
				channel.send("Accepted format: \n `[start][am/pm]-[end][am/pm]` \n example: \n `11am-1:15pm`");

				// set next state
				app.userStates.username = {
					state: 'getTime',
					process: 'snag'
				};
			}
		},

		getTime: function(channel, message){
			var text = app.helpers.trim(message.text);

			// get start and end times
			var timeObj = parseOutTime(text);
			var startObj = timeObj.start;
			var endObj = timeObj.end;

			if(!startObj || !endObj){
				channel.send("I didn't quite get that, could you try picking the time again?");
				channel.send("Accepted format: \n `[start][am/pm]-[end][am/pm]` \n example: \n `11am-1:15pm`");
			} else if(!areTimesValid(startObj, endObj)){
				channel.send("Those times seem to be invalid, remember that you can only reserve three hours at a time.");
				channel.send("Accepted format: \n `[start][am/pm]-[end][am/pm]` \n example: \n `11am-1:15pm`");
			} else {
			// success
				var username = app.helpers.getUsernameById(message.user);
				// store times
				app.reservationQueue.username.startObj = startObj;
				app.reservationQueue.username.endObj = endObj;

				channel.send("Next up, pick the date.");
				channel.send("Accepted formats: \n `[day] [month]` \n example: \n `24 october` \n \n `today`, `monday`, `tuesday`, etc. also work");

				// set next state
				app.userStates.username = {
					state: 'getDate',
					process: 'snag'
				};
			}
		},

		getDate: function(channel, message){
			var text = app.helpers.trim(message.text);

			// get day and month
			var dateObj = parseOutDate(text);

			if(!dateObj){
				channel.send("I didn't quite get that, could you try picking the date again?");
				channel.send("Accepted formats: \n `[day] [month]` \n example: \n `24 oct` \n \n `today`, `monday`, `tuesday`, etc. also work");
			} else {
			// success
				var username = app.helpers.getUsernameById(message.user);
				// store times
				app.reservationQueue.username.day = dateObj.day;
				app.reservationQueue.username.month = dateObj.month;

				channel.send("Lastly, I will just need your `company name`.");

				// set next state
				app.userStates.username = {
					state: 'getCompany',
					process: 'snag'
				};
			}
		},

		getCompany: function(channel, message){
			var text = app.helpers.trim(message.text);

			if(text == ' ' || text == null || text == ''){
				channel.send("I didn't quite get that, could you try sending me your `company name` again?");
			} else {
			// success
				var username = app.helpers.getUsernameById(message.user);
				// store times
				app.reservationQueue.username.company = text;

				this.completeBuild(channel, message);
			}
		},

		completeBuild: function(channel, message){

			// get user email
			var user = app.slack.getUserByID(message.user);
			var email = user.profile.email;

			// get previous variables to use
			var username = app.helpers.getUsernameById(message.user);
			var userData = app.reservationQueue.username;
			var month = userData.month;
			var day = userData.day;
			var startObj = userData.startObj;
			var endObj = userData.endObj;

			// create user friendly strings
			var startString = moment({hour: startObj.hr, minute:startObj.min}).format('h:mma');
			var endString = moment({hour: endObj.hr, minute:endObj.min}).format('h:mma');

			// create moment object to check if it's before now
			var startMom = moment({month: month, day: day, hour: startObj.hr, minute: startObj.min});
			// check if date is before today's current date
			// if so then make it next year
			// this will mostly be used in december when making january reservations
			if(startMom.isBefore()){
				startMom.add(1, 'years');
			}

			var year = startMom.year();
			// Monday Oct 13th, 2015
			var dateString = startMom.format('dddd MMM Do, YYYY');
			// create date objects that will be used to actually make the request
			var startDate = new Date(year, month, day, startObj.hr, startObj.min);
			var endDate = new Date(year, month, day, endObj.hr, endObj.min);


			var data = {
				"email": email,
				"company": userData.company,
				"room": userData.room,
				"start": startString,
				"end": endString,
				"dateString": dateString,
				"startDate": startDate,
				"endDate": endDate
			};

			app.reservationQueue.username = data;

			this.confirm(channel, message);
		},

		// reserve room with one full string
		formatted: function(channel, message){
			var text = app.helpers.trim(message.text);

			if(text.length < 25){
			// NOT ENOUGH INFO
				this.formatHelp(channel);
			} else if (text.indexOf(',') == -1){
			// COMMA NOT INCLUDED
				this.formatHelp(channel);
			} else {
			// CREATE A ROOM REQUEST
				var username = app.helpers.getUsernameById(message.user);
				// get rid of snag at the beginning
				var sub = text.substring(4);
				var requestText = app.helpers.trim(sub);

				// main parsing of request
				var data = createRequest(requestText, message.user);

				// save request data
				app.reservationQueue.username = data;

				// double check if reservation is correct
				this.confirm(channel, message);
			}
		},

		// double check if reservation is correct
		confirm: function(channel, message){
			var username = app.helpers.getUsernameById(message.user);
			var data = app.reservationQueue.username;
			// readable format for user
			var response = formatRequestResponse(data);
			
			// set next state
			app.userStates.username = {
				state: 'finish',
				process: 'snag'
			};

			app.helpers.sendAttachment(channel, response, function(){
				var afterMsg = "Do you want to `snag` this reservation or `cancel`?";
				channel.send(afterMsg);
			});
		},

		finish: function(channel, message){
			var text = app.helpers.trim(message.text);
			if(text.toLowerCase() == 'snag'){
				var username = app.helpers.getUsernameById(message.user);
				makeReservation(app.reservationQueue.username, function(res){
					var response;
					if(res.statusCode == 200){
						response = 'Room snagged! You should be receiving an email shortly :mailbox_with_mail:';
					} else if (res.statusCode == 500){
						response = 'Oh no! The room has already been snagged, please try again!';
						response += '\n Your last attempt has been discarded :thumbsup:';
					} else if (res.statusCode == 503){
						response = 'Seems to be something askew, the reservation may not have been confirmed. \n If you do not receive an email in the next 5 minutes please try again!';
					} else {
						response = "Hmm there seems to be an error, the reservation was not confirmed. \n Please try again!";
						response += "\n Your last attempt has been discarded :thumbsup:";
					}

					app.userStates.username = { state: false };
					delete app.reservationQueue[username];
					channel.send(response);
				});
			} else if (text.toLowerCase() == 'cancel'){
				app.userStates.username = { state: false };
				delete app.reservationQueue[username];
				channel.send('Announcement discarded :thumbsup:');
			} else {
				channel.send('Would you like to `snag` the reservation or `cancel`?');
			}
		}
	}

	/// END OF RETURN OBJECT


	// a bunch of helper functions to create room requests
	//

	// format the json data into a readable response
	function formatRequestResponse(data){
		// new Date(year, month, day, hour, minutes);

		var response = {
			"text": '',
			"attachments": [
		        {
		            "fallback": "Just to make sure, let's double check your reservation.",

		            "color": '#FF9933',

		            "fields": [
		                {
		                    "title": "Request To Be Made",
		                    "value": "Just to be sure, let's double check everything.",
		                    "short": false
		                },
		                {
		                    "title": "Email",
		                    "value": data.email,
		                    "short": true
		                },
		                {
		                    "title": "Company",
		                    "value": data.company,
		                    "short": true
		                },
		                {
		                    "title": "Date",
		                    "value": data.dateString,
		                    "short": true
		                },
		                {
		                    "title": "Room",
		                    "value": data.room,
		                    "short": true
		                },
		                {
		                    "title": "Start",
		                    "value": data.start,
		                    "short": true
		                },
		                {
		                    "title": "End",
		                    "value": data.end,
		                    "short": true
		                }
		            ]
		        }
		    ]
		};


		return response;
	}

	//createRequest('east | 11am-1:15pm | 24 oct | HackFSU');
	function createRequest(text, userId){
		// create array of data
		var sections = text.split(',');

		// get user email
		var user = app.slack.getUserByID(userId);
		var email = user.profile.email;

		// get company name and correct room
		var room = app.helpers.trim(sections[0]);
		room = convertToRoom(room);
		var company = app.helpers.trim(sections[sections.length - 1]);

		// get day and month
		var dayAndMonth = app.helpers.trim(sections[2]);
		var dateObj = parseOutDate(dayAndMonth);
		if(!dateObj)
			return false;
		var day = dateObj.day;
		var month = dateObj.month;

		// get start and end times
		var startAndEnd = app.helpers.trim(sections[1]);
		var timeObj = parseOutTime(startAndEnd);
		var startObj = timeObj.start;
		var endObj = timeObj.end;

		if(!startObj || !endObj)
			return false;

		if(!areTimesValid(startObj, endObj))
			return false;

		// create user friendly strings
		var startString = moment({hour: startObj.hr, minute:startObj.min}).format('h:mma');
		var endString = moment({hour: endObj.hr, minute:endObj.min}).format('h:mma');

		// create moment object to check if it's before now
		var startMom = moment({month: month, day: day, hour: startObj.hr, minute: startObj.min});
		// check if date is before today's current date
		// if so then make it next year
		// this will mostly be used in december when making january reservations
		if(startMom.isBefore()){
			startMom.add(1, 'years');
		}



		var year = startMom.year();
		// Monday Oct 13th, 2015
		var dateString = startMom.format('dddd MMM Do, YYYY');
		// create date objects that will be used to actually make the request
		var startDate = new Date(year, month, day, startObj.hr, startObj.min);
		var endDate = new Date(year, month, day, endObj.hr, endObj.min);


		var data = {
			"email": email,
			"company": company,
			"room": room,
			"start": startString,
			"end": endString,
			"dateString": dateString,
			"startDate": startDate,
			"endDate": endDate
		};

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

	// test start and end times to make sure they don't exceed 
	// three hours or are invalid 
	function areTimesValid(startObj, endObj){
		// put times in a decimal format
		var endTime = endObj.hr + (endObj.min * 0.01);
		var startTime = startObj.hr + (startObj.min * 0.01);

		if ((endTime - startTime) > 3) {
			return false;
		} else if ((endTime - startTime) <= 0){
			return false;
		}

		return true;
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
		dayTime = dayTime.toLowerCase();
		if(dayTime == 'pm' && hr != 12){
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
		var days = [
			'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
		];
		var lowerCaseDay = date.toLowerCase();
		// if user put 'today'
		if(lowerCaseDay == 'today'){
			var today = new Date();
			day = today.getDate();
			month = today.getMonth();
		} else if (days.indexOf(lowerCaseDay) != -1){
		// day of the week selected
			var today = moment();
			// go through the next week and find the next instance of the day selected
			for(var i = 0; i < 6; i++){
				var current = today.format('dddd');
				if(current.toLowerCase() == lowerCaseDay){
				// match found
					day = parseInt(today.format('D'));
					month = parseInt(today.format('M')) - 1;
					break;
				}

				// keep incrementing
				today.add(1, 'day');

			}
		} else {
			if(date.indexOf(' ') == -1)
				return false;
			
			var dayAndMonth = date.split(' ');
			var day = parseInt(app.helpers.trim(dayAndMonth[0]));
			var month = app.helpers.trim(dayAndMonth[1]);

			// if month is a string then convert to int
			if(isNaN(month)){
				month = monthToInt(month);
			}
		}

		// if month or day is not a number
		if(isNaN(month) || isNaN(day))
			return false;

		// if month or day number is invalid
		if(month < 0 || day < 0 || month > 11 || day > 31)
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
			default:
				num = false;
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

	function makeReservation(userData, callback){

		var data = {
		    "email": userData.email,
		    "company": userData.company,
		    "room": userData.room,
		    "start": userData.startDate,
		    "end": userData.endDate
		 };

		var options = {
			url: app.reservationUrl,
			method: 'POST',
			json: data
		}

		request.post(options, function(err, response, body){
			if(err){
				console.log('RESERVATION ERROR \n --------------- \n --------- \n ----');
				console.log(response);	
				console.log(err);
			}

			callback(response);
		});

	}

};