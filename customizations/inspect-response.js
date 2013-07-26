/*
	Inspect the raw response from the API before it has been determined
	whether it is valid, invalid, or ambiguous

	Assuming:
	var liveaddress = $.LiveAddress(...);
*/

liveaddress.on("ResponseReceived", function(event, data, previousHandler) {
	console.log(data.response.raw);
	previousHandler(event, data);
});