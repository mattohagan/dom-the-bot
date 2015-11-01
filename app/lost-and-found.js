module.exports = function(app) {
	// return lost object
	return {
		start: function(channel, message){
			var text = app.helpers.trim(message.text);
			var response = "Oh no! Can you give me a `full description of the lost item`? \n Or `cancel`";

			app.userStates.username = {
				state: 'confirm',
				process: 'lost'
			};

			channel.send(response);
		},

		confirm: function(channel, message){
			var text = app.helpers.trim(message.text);
			if(text.toLowerCase() == 'cancel'){
				this.cancel(channel);
				return false;
			}

			// create attachment and send to user to confirm
			// save attachment in userState 
			// and save descriptions under username in lostAndFound

			app.userStates.username = {
				state: 'announce',
				process: 'lost'
			};

			var response = "Sorry, this feature isn't ready yet!";
			channel.send(response);

			this.cancel(channel);
		},

		announce: function(channel, message){
			var text = app.helpers.trim(message.text);
			if(text.toLowerCase() == 'cancel'){
				this.cancel(channel);
				return;
			}

			app.userStates.username = { state: false };


		},

		cancel: function(channel){
			app.userStates.username = { state: false };
			channel.send('Lost and found addition discarded :thumbsup:');
		}
	}
};