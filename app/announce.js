// functions to handle announcements
module.exports = function(app){
	// return announce object
	return {
		pick: function(channel, message){
			var text = app.helpers.trim(message.text);

			if(app.helpers.doesContain(text, 'email')){
				this.email.start(channel);
			} else if(app.helpers.doesContain(text, 'general')){
				this.general.start(channel, message);
			} else {
				channel.send('You can make two different types of announcements, a `general` announcement and an `email` announcement. Which one would you like to make?');
				app.userStates.username = {
					state: 'pick',
					process: 'announce'
				};
			}
		},

		general: {
			start: function(channel, message){
				if(app.helpers.fromAdmin(message)){
					var string = "Great, let's send an announcement! What will the title be?";
					var username = app.helpers.getUsernameById(message.user);

					app.userStates.username = {
						state: 'build',
						process: 'announce.general'
					};

					channel.send(string);
				} else {
					this.invalid(channel, message);
				}
			},

			// build general announcements
			build: function(channel, message){
				var title = app.helpers.trim(message.text);
				var general = {
					"text": '',
					"attachments": [
				        {
				            "fallback": title,

				            "color": '#339999',

				            "fields": [
				                {
				                    "title": title,
				                    "value": '< the text you message will go here >',
				                    "short": false
				                }
				            ]
				        }
				    ]
				};

				app.userStates.username.general = general;

				app.userStates.username.state = 'finish';

				app.helpers.sendAttachment(channel, general, function(){
					var afterMsg = 'Awesome, now what `content` would you like to put?';
					channel.send(afterMsg);
				});

			},

			// general announcements
			finish: function(channel, message){
				var text = message.text;
				var username = app.helpers.getUsernameById(message.user);
				text = text.toLowerCase();

				if(text == 'send'){
					var attach = JSON.parse(app.userStates.username.general.attachments);

			        var general = {
			        	'text': '',
			        	'attachments': attach
			        };


			        app.userStates.username = { state: false };

					channel.send('One general announcement, coming right up!');

					// SEND TO #STATIONCHAT
					app.helpers.sendAttachment('stationchat', general, function(){ console.log('Sent general announcement to #stationchat!')});
			        app.helpers.sendAttachment(channel, general, function(){});
				} else if(text == 'cancel'){
					app.userStates.username = { state: false };
					channel.send('Announcement discarded :thumbsup:');
				} else {
					var attach = JSON.parse(app.userStates.username.general.attachments);
					attach[0].fields[0].value = message.text;
			        
			        var general = {
			        	'text': '',
			        	'attachments': attach
			        };

			        app.userStates.username.general = general;

			        // send for feedback
			        app.helpers.sendAttachment(channel, general, function(){
						var afterMsg = "Lookin' spiffy, `send` now, or `cancel`?";
			        	channel.send(afterMsg);
			        });
				}
			}
		},

		email: {
			start: function(channel, message){
				var username = app.helpers.getUsernameById(message.user);

				if(app.helpers.fromAdmin(message)){
					var string = "Awesome, let's send some announcements! Can you give me the `list of Events` separated by commas?";

					app.userStates.username = {
						state: 'build',
						process: 'announce.email'
					};

					channel.send(string);
				} else {
					this.invalid(channel, message);
				}

			},

			// events & misc based announcements
			build: function(channel, message){
				var text = message.text;
				if(text.indexOf(',') == -1){
					var string = "Don't forget commas! Try sending me the `list of Events` again.";
					channel.send(string);
				} else {
					var emojiList = [':loudspeaker:', ':satellite:', ':tv:', ':bell:', ':radio:'];
					var events = text.split(',');
					var today = new Date();
					today = today.getDate() + '/' + (today.getMonth() + 1);
					var title = today + " " + app.helpers.pickRandom(emojiList) + " Station Announcement";

					var fieldText = '';
					for(var i = 0; i < events.length; i++){
						var ev = app.helpers.trim(events[i]);
						fieldText += '- ' + ev + '\n';
					}

					// users options to pick from
					var announcement = {
						"text": '',
						"attachments": [
					        {
					            "fallback": title,

					            "color": '#339999',

					            "pretext": "",

					            "title": title,

					            "fields": [
					                {
					                    "title": "Events This Week",
					                    "value": fieldText,
					                    "short": false
					                }
					            ]
					        }
					    ]
					};

					app.userStates.username.announcement = announcement;

					app.userStates.username.state = 'finish';

					app.helpers.sendAttachment(channel, announcement, function(){
						var afterMsg = "Would you like to \n - Add a Misc. section, just enter `any free form text` \n - `send` now with an email reminder? \n - Use without a reminder to check their email and `send other`  \n - `cancel`";
						channel.send(afterMsg);
					});
				}
			},

			// events & misc based announcements
			finish: function(channel, message){
				var text = message.text;
				var username = app.helpers.getUsernameById(message.user);
				text = text.toLowerCase();

				if(text == 'send' || text == 'send email'){
					var attach = JSON.parse(app.userStates.username.announcement.attachments);
					// add second attachment as an email reminder
					var msgs = [
						"All of this info and more can be found in your inbox :mailbox_closed::blush:",
						"Don't forget to check the email for more info! :envelope_with_arrow::thumbsup:"
					];

					var msg = app.helpers.pickRandom(msgs);
					attach.push({
			        	"text": msg,
			        	"color": "#303030",
			        	"fallback": msg
			        });

			        var announcement = {
			        	'text': '',
			        	'attachments': attach
			        };

			        app.userStates.username = { state: false };

					channel.send('One announcement, coming up!');

					// SEND TO #STATIONCHAT
					app.helpers.sendAttachment('stationchat', announcement, function(){ console.log('Sent email announcement to #stationchat!')});
			        app.helpers.sendAttachment(channel, announcement, function(){});
				} else if (text == 'send other'){
					var attach = JSON.parse(app.userStates.username.announcement.attachments);

			        var announcement = {
			        	'text': '',
			        	'attachments': attach
			        };

			        app.userStates.username = { state: false };

					channel.send('One announcement, coming up!');

					// SEND TO #STATIONCHAT
					app.helpers.sendAttachment('stationchat', announcement, function(){ console.log('Sent events announcement to #stationchat!')});
			        app.helpers.sendAttachment(channel, announcement, function(){});
				} else if(text == 'cancel'){
					app.userStates.username = { state: false };
					channel.send('Announcement discarded :thumbsup:');
				} else {
					var misc = message.text;
					var attach = JSON.parse(app.userStates.username.announcement.attachments);

					// add misc to fields
					attach[0].fields.push({
						"title": "Misc.",
						"value": misc,
						"short": false
					});

			        var announcement = {
			        	'text': '',
			        	'attachments': attach
			        };

			        app.userStates.username.announcement = announcement;

					app.helpers.sendAttachment(channel, announcement, function(){
						var afterMsg = "If everything looks up to spec, how should I send this? \n - `send` now with an email reminder? \n - Use without a reminder to check their email and `send other`  \n - `cancel`";
						channel.send(afterMsg);
					});
				}
			}
		}
	}
};