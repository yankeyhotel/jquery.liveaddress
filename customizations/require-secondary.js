/*
	Require valid secondary info if it's missing from the user's input
	
	Assuming:
	var liveaddress = $.LiveAddress(...);
*/

liveaddress.on("AddressAccepted", function(event, data, previousHandler) {
	if (data.response.isMissingSecondary())
	{
		data.address.abort(event);
		alert("Don't forget your apartment number!");
	}
	else
		previousHandler(event, data);
});