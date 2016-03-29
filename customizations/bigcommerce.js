/*
 Adapter for BigCommerce. The forms on BigCommerce are nearly imcomprehensible and poorly
 marked up, so automapping fails. This adapter attempts to automap fields specifically
 for BigCommerce sites.

 Tested on BigCommerce v7408.

 Assuming:
 var liveaddress = $.LiveAddress(...);

 To use:
 1) Initialize with autoMap: false
 2) Map fields when document is ready, like so:
 $(function() {
 liveaddress.mapFields(BigCommerceAdapter.map());
 });
 */

var BigCommerceAdapter = {
	map: function () {
		var getMap = function () {
			var map = {};	// This will be the finished map
			var translation = {
				addressline1: 'address1',		// BigCommerce values on the left (lowercased); LiveAddress names on the right
				addressline2: 'address2',
				city: 'locality',
				state: 'administrative_area',
				zip: 'postal_code',
				country: 'country'
			};

			var fieldIdentifierSelector = 'form input.FormFieldPrivateId[type=hidden]';	// Selector for hidden fields to identify the visible fields
			var visibleFieldSelector = 'select.FormField, input.FormField';				// Selects the visible field following the identifying field(s)

			jQuery(fieldIdentifierSelector).filter(function () {
				return jQuery(this).nextAll(visibleFieldSelector).is(':visible');	// Field must be visible
			}).each(function (i) {
				var liveAddressInputFieldName = translation[jQuery(this).val().toLowerCase()];
				if (liveAddressInputFieldName && !map[liveAddressInputFieldName]) {
					var fieldID = jQuery(this).nextAll('select.FormField, input.FormField').attr('id');
					map[liveAddressInputFieldName] = '#' + fieldID;
				}
			});

			return map;
		};

		if (jQuery.isReady)
			return getMap();
		else
			jQuery(getMap);
	}
};