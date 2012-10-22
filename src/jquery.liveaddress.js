/**
	LiveAddress API jQuery Plugin
	by SmartyStreets - smartystreets.com

	(c) 2012-2013 SmartyStreets

	License: MIT (attribution appreciated)
	Documentation: http://smartystreets.com/kb/liveaddress-api/website-forms
	Version: [See variable below for version]

	Hosted on GitHub. Checkout the jquery.liveaddress repository
	for latest version and to initiate pull requests.

	THIS UN-MINIFIED COPY IS INTENDED FOR DEBUG AND DEVELOPMENT ONLY.
**/


(function($, window, document) {
	"use strict";		//  http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/


	/*
	  *	PRIVATE MEMBERS
	*/

	var instance;			// Public-facing functions and variables
	var ui = new UI;		// Internal use only, for UI-related tasks
	var version = "2.0.1";	// The version of this copy of the script

	var defaults = {
		candidates: 3,															// Number of suggestions to show if ambiguous
		requestUrl: "https://api.qualifiedaddress.com/street-address",			// API endpoint
		timeout: 5000,															// How long to wait before the request timed out (5000 = 5 seconds)
		speed: "medium",														// Animation speed
		ambiguousMessage: "Please choose the most correct address.",			// Message when address is ambiguous
		invalidMessage: "Address could not be verified.",						// Message when address is invalid
		fieldSelector: "input[type=text], input[type=], textarea, select",		// Selector for possible address-related form elements
		submitSelector: "[type=submit], [type=image], input[type=button]:last",	// Selector to find a likely submit button or submit image (in a form)
	};
	var config = {};		// Configuration settings, either from use or defaults
	var forms = [];			// List of forms which hold lists of addresses



	/*
	  *	ENTRY POINT
	*/

	
	
	$.LiveAddress = function(arg)
	{
		return $('body').LiveAddress(arg);	// 'body' is needed to find ancestor in traversal (document won't work)
	};

	$.fn.LiveAddress = function(arg)
	{
		if (instance)
			return instance;

		var selector = this.selector;

		// Make sure the jQuery version is compatible
		var vers = $.fn.jquery.split(".");
		if (vers.length >= 2)
		{
			if (vers[0] < 1 || (vers[0] >= 1 && vers[1] < 5))
			{
				console.log("jQuery version "+$.fn.jquery+" found, but LiveAddress requires jQuery version 1.5 or higher. Aborting.");
				return false;
			}
		}

		if (arg.debug)
			console.log("LiveAddress API jQuery Plugin version "+version+" (Debug mode)");

		if (typeof arg === 'string')
		{
			// Use the default configuration
			config = { key: arg, candidates: defaults.candidates };
		}
		else if (typeof arg === 'object')
		{
			// Persist the user's configuration
			config = $.extend(config, arg);
		}

		// Enforce some defaults
		config.candidates = config.candidates || defaults.candidates;
		config.ui = typeof config.ui === 'undefined' ? true : config.ui;
		config.autoMap = typeof config.autoMap === 'undefined' ? true : config.autoMap;
		config.autoVerify = typeof config.autoVerify === 'undefined' ? true : config.autoVerify;
		config.timeout = config.timeout || defaults.timeout;
		config.ambiguousMessage = config.ambiguousMessage || defaults.ambiguousMessage;
		config.invalidMessage = config.invalidMessage || defaults.invalidMessage;
		config.fieldSelector = config.fieldSelector || defaults.fieldSelector;
		config.submitSelector = config.submitSelector || defaults.submitSelector;

		if (config.candidates < 1)
			config.candidates = 1;
		else if (config.candidates > 10)
			config.candidates = 10;

		/*
		  *	EXPOSED (PUBLIC) FUNCTIONS
		*/
		instance = {
			events: EventHandlers,
			on: function(eventType, userHandler)
			{
				if (!EventHandlers[eventType] || typeof userHandler !== 'function')
					return false;

				var previousHandler = EventHandlers[eventType];
				EventHandlers[eventType] = function(event, data) {
					userHandler(event, data, previousHandler);
				};
			},
			mapFields: function(map)
			{
				if (typeof map === 'object')
					return ui.mapFields(map, selector);
				else if (map === "auto")
					return ui.automap(selector);
				else if (typeof config.addresses === 'object')
					return ui.mapFields(config.addresses, selector)
				else if (config.autoMap)
					return ui.automap(selector);
				else
					return false;
			},
		 	makeAddress: function(addressData)
		 	{
		 		if (typeof addressData === "string")
		 			return new Address({ street: addressData });
		 		else if (typeof addressData === "object")
		 			return new Address(addressData);
		 	},
		 	verify: function(input, callback)
		 	{
		 		var addr = instance.makeAddress(input);
		 		addr.verify(callback);
		 	},
			getMappedAddresses: function()
			{
				var addr = [];
				for (var i = 0; i < forms.length; i++)
					for (var j = 0; j < forms[i].addresses.length; j++)
						addr.push(forms[i].addresses[j])
				return addr;
			},
			getMappedAddressByID: function(id)
			{
				for (var i = 0; i < forms.length; i++)
					for (var j = 0; j < forms[i].addresses.length; j++)
						if (forms[i].addresses[j].id() == id)
							return forms[i].addresses[j];
			},
			setKey: function(htmlkey)
			{
				config.key = htmlkey;
			},
			version: version
		};

		
		// Bind each handler to an event
		for (var prop in EventHandlers)
			bind(prop);
		
		// Wrap this part of initialization in document.ready so the DOM can fully establish first
		$(function() {
			if (config.autoMap)
				instance.mapFields(selector);
		});

		return instance;
	};







	/*
	  *	PRIVATE FUNCTIONS / OBJECTS
	*/





	/*
		The UI object auto-maps the fields and controls
		interaction with the user during the address
		verification process.
	*/
	function UI()
	{
		var mapMeta = {
			formDataProperty: "smarty-form",	// Indicates whether we've stored the form already
			identifiers: {
				streets: {				// both street1 and street2, separated later.
					names: [
						'street',
						'address',		// This ("address") is a dangerous inclusion; but we have a strong set of exclusions below to prevent false positives.
						'address1',		// If there are automapping issues, namely, it is too greedy when mapping fields, it will be because
						'address2',		// of these arrays for the "streets" fields, namely the "address" entry right above here, or potentially others.
						'addr1',
						'addr2',
						'address-1',
						'address-2',
						'address_1',
						'address_2',
						'line',
						'suite',
						'apartment',
						'primary',
						'secondary'
					],
					labels: [
						'street',
						'address',		// hazardous (e.g. "Email address") -- but we deal with that later
						'line ',
						' line',
						'suite',
						'apartment',
						'apt:',
						'apt.',
						'ste:',
						'ste.',
						'unit:',
						'unit.',
						'unit ',
						'primary',
						'secondary'
					]
				},
				city: {
					names: [
						'city',
						'town',
						'village',
						'cityname',
						'city-name',
						'city_name'
					],
					labels: [
						'city',
						'town',
						'city name'
					]
				},
				state: {
					names: [
						'state',
						'province',
						'region',
						'section',
						'territory'
					],
					labels: [
						'state',
						'province',
						'region',
						'section',
						'territory'
					]
				},
				zipcode: {
					names: [
						'zip',
						'zipcode',
						'zip-code',
						'zip_code',
						'postal_code',
						'postal-code',
						'postalcode',
						'postcode',
						'post-code',
						'post_code',
						'postal',
						'zcode'
					],
					labels: [
						'zip',
						'zip code',
						'postal code',
						'postcode',
						'locality'
					]
				},
				country: {				// We only use country to see if we should submit to the API
					names: [
						'country',
						'nation',
						'sovereignty'
					],
					labels: [
						'country',
						'nation',
						'sovereignty'
					]
				}
			},	// We'll iterate through these (above) to make a basic map of fields, then refine:
			street1exacts: {		// List of case-insensitive EXACT matches for street1 field
				names: [
					'address',
					'street',
					'streetaddress',
					'street-address',
					'street_address',
					'streetaddr',
					'street-addr',
					'street_addr',
					'str',
					'str1',
					'street1',
					'addr'
				]
			},
			street2: {			// Terms which would identify a "street2" field
				names: [
					'address2',
					'street2',
					'addr2',
					'line2',
					'str2',
					'second',
					'two',
					'box'
				],
				labels: [
					' 2',
					'second',
					'two',
					'ste',
					'apt',
					'unit',
					'box'
				]
			},
			exclude: {			// Terms we look for to exclude an element from the mapped set to prevent false positives
				names: [		// The intent is to keep non-address elements from being mapped accidently.
					'email',
					'e-mail',
					'e_mail',
					'firstname',
					'first-name',
					'first_name',
					'lastname',
					'last-name',
					'last_name',
					'fname',
					'lname',
					'name',
					'eml',
					'type',
					'method',
					'location',
					'store',
					'save',
					'keep',
					'phn',
					'phone',
					'cardholder',	// I hesitate to exclude "card" because of common names like: "card_city" or something...
					'security',
					'comp',
					'firm',
					'org',
					'group',
					'gate',
					'cvc',
					'cvv'
				],
				labels: [
					'email',
					'e-mail',
					'e mail',
					' type',
					'save ',
					'keep',
					'name',
					'method',
					'phone',
					'organization',
					'company',
					'addressee',
					'firm',
					'group',
					'gate',
					'cardholder',
					'cvc',
					'cvv'
				]
			}
		};

		var uiCss = "<style>"
			+ ".smarty-dots { display: none; position: absolute; z-index: 999; }"
			+ ".smarty-address-verified { display: none; position: absolute; z-index: 999; width: 55px; border: 1px solid #80AA00; padding: 1px; font-size: 16px; font-family: sans-serif; color: #2D8D0D; line-height: 1.25em; background: #E2FFBE; border-radius: 10px 3px 3px 10px; padding-left: 3px; }"
			+ ".smarty-undo { font-size: 11px; padding: 4px; color: #537700; vertical-align: top; text-decoration: none; } .smarty-undo:hover { color: #CC0000; }"
			+ ".smarty-address-ambiguous, .smarty-address-invalid { font-size: 14px; font-family: sans-serif; text-align: left; line-height: 1em !important; color: black; background: #EEE; padding: 10px; border-radius: 5px; z-index: 999; box-shadow: 0px 10px 35px rgba(0, 0, 0, .7); }"
			+ ".smarty-address-ambiguous a, .smarty-address-invalid a { color: #0055D4; font-weight: normal; } .smarty-address-ambiguous a:hover, .smarty-address-invalid a:hover { color: #119FF2 }"
			+ ".smarty-ambiguous-message, .smarty-invalid-message { font-family: 'Helvetica Neue', sans-serif; font-weight: 300; padding: 10px 0 25px; font-size: 18px; border-bottom: 1px solid #888; text-align: center; }"
			+ ".smarty-address-ambiguous { border: 1px solid #AAA; border-top: 10px solid #AAA; }"
			+ ".smarty-ambiguous-message { color: #000; }"
			+ ".smarty-address-invalid { border: 1px solid #CC0000; border-top: 10px solid #CC0000; }"
			+ ".smarty-invalid-message { color: #000; }"
			+ "a.smarty-choice { font-size: 14px !important; padding: 17px !important; text-decoration: none !important; display: block !important; background: #F5F5F5; color: #222; border-bottom: 1px solid #CCC; }"
			+ ".smarty-address-ambiguous .smarty-choice:hover, .smarty-address-ambiguous .smarty-choice:hover * { background: #444; color: #FFF; }"
			+ ".smarty-address-invalid .smarty-choice { background: #F5F5F5; color: #60AD08; }"
			+ ".smarty-address-invalid .smarty-choice:hover { background: #A3C952; color: #FFF; }"
			+ ".smarty-address-invalid a:hover { color: #CC0000; }"
			+ ".smarty-address-ambiguous a.smarty-use-original { font-size: 12px !important; padding: 7px 17px !important; }"
			+ ".smarty-address-invalid a.smarty-use-original { color: #CC0000 !important; }"
			+ "a.smarty-use-original:hover { color: #FFF !important; background: #CC0000 !important; }"
			+ "a.smarty-abort { position: absolute !important; top: 5px !important; right: 5px; background: #DDD; color: #999; border-radius: 10px; padding: 2px 6px; font-size: 10px !important; text-decoration: none !important; }"
			+ "a.smarty-choice-abort { padding: 7px 17px !important; } a.smarty-choice-abort:hover { background: #A3C952 !important; color #FFF !important; }"

		function postMappingOperations()
		{
			// Injects materials into the DOM, binds to form submit events, etc... very important.

			if (config.ui)
			{
				// Prepend CSS to head tag to allow cascading and give their style rules priority
				$('head').prepend(uiCss);

				// For each address on the page, inject the loader and "address verified" markup after the last element
				var addresses = instance.getMappedAddresses();
				for (var i = 0; i < addresses.length; i++)
				{
					var id = addresses[i].id();
					$('body').append('<img src="http://i.imgur.com/w6tAo.gif" alt="Loading..." class="smarty-dots smarty-addr-'+id+'">');
					$('body').append('<div class="smarty-container smarty-address-verified smarty-addr-'+id+'"><span title="Address verified!">&#10003;</span><a href="javascript:" class="smarty-undo" title="Your address was verified. Click to undo." data-addressid="'+id+'">Verified</a></div>');
				}

				$('body').delegate('.smarty-undo', 'click', function(e)
				{
					// Undo button clicked
					var addrId = $(this).data('addressid');
					var addr = instance.getMappedAddressByID(addrId);
					addr.undo(true);
					$(this).hide();
				});

				$('body').delegate('.smarty-address-verified', 'mouseover', function(e)
				{
					$('.smarty-undo', this).text('Undo?');
				});

				$('body').delegate('.smarty-address-verified', 'mouseout', function(e)
				{
					$('.smarty-undo', this).text('Verified');
				});
			}

			// Bind to form submits through form submit or submit button click
			for (var i = 0; i < forms.length; i++)
			{
				var f = forms[i];

				var handler = function(e)
				{
					if (e.data.form && e.data.form.processing)
						return suppress(e);
					
					// In case programmatic changes were made to input fields, we need to sync
					// those with internally-stored values (since the .change() event isn't fired
					// by jQuery's val() function).
					for (var j = 0; j < e.data.form.addresses.length; j++)
						e.data.form.addresses[j].syncWithDom();

					if (!e.data.form.allAddressesAccepted())
					{
						// We could verify all the addresses at once, but that can
						// be overwhelming for the user. An API request is usually quick,
						// so let's do one at a time: it's much cleaner.
						var unaccepted = e.data.form.addressesNotAccepted();
						if (unaccepted.length > 0)
							trigger("VerificationInvoked", { address: unaccepted[0], invoke: e.data.invoke });
						return suppress(e);
					}
				};

				// Take any existing handlers (bound via jQuery) and re-bind them for AFTER our handler(s).
				var formSubmitElements = $(config.submitSelector, f.dom);


				// Form submit() events are apparently invoked by CLICKING the submit button (even jQuery does this at its core)
				formSubmitElements.each(function(idx)
				{
					var oldHandlers;

					// If there are previously-bound-event-handlers (from jQuery), get those.
					if ($(this).data('events') && $(this).data('events').click && $(this).data('events').click.length > 0)
					{
						// Get a reference to the old handlers previously bound by jQuery
						oldHandlers = $.extend(true, [], $(this).data('events').click);
					}

					// Unbind them...
					$(this).unbind('click');

					// ... then bind ours first ...
					$(this).click({ form: f, invoke: this }, handler);

					// ... then bind theirs last:
					// First bind their onclick="..." handles...
					if (typeof this.onclick === 'function')
					{
						var temp = this.onclick;
						this.onclick = null;
						$(this).click(temp);
					}

					// ... then finish up with their old jQuery handles.
					if (oldHandlers)
						for (var j = 0; j < oldHandlers.length; j++)
							$(this).click(oldHandlers[j].data, oldHandlers[j].handler);
				});
			}
		}

		// This function is used to find and properly map elements to their field type
		function filterDomElement(domElement, names, labels)
		{
			/*
				Where we look to find a match, in this order:
			 	name, id, <label> tags, placeholder, title
			 	Our searches first conduct fairly liberal "contains" searches:
			 	if the attribute even contains the name or label, we map it.
			 	The names and labels we choose to find are very particular.
			 */

			var name = lowercase(domElement.name);
			var id = lowercase(domElement.id);
			var placeholder = lowercase(domElement.placeholder);
			var title = lowercase(domElement.title);

			// First look through name and id attributes of the element, the most common
			for (var i = 0; i < names.length; i++)
				if (name.indexOf(names[i]) > -1 || id.indexOf(names[i]) > -1)
					return true;

			// If we can't find it in name or id, look at labels associated to the element.
			// Webkit automatically associates labels with form elements for us. But for other
			// browsers, we have to find them manually, which this next block does.
			if (!('labels' in domElement))
			{
				var lbl = $('label[for=' + id + ']')[0] || $(domElement).parents('label')[0];
				domElement.labels = !lbl ? [] : [lbl];
			}

			// Iterate through the <label> tags now to search for a match.
			for (var i = 0; i < domElement.labels.length; i++)
			{
				// This inner loop compares each label value with what we're looking for
				for (var j = 0; j < labels.length; j++)
					if (domElement.labels[i].innerText.toLowerCase().indexOf(labels[j]) > -1)
						return true;
			}

			// Still not found? Then look in "placeholder" or "title"...
			for (var i = 0; i < labels.length; i++)
			if (placeholder.indexOf(labels[i]) > -1 || title.indexOf(labels[i]) > -1)
				return true;

			// Got all the way to here? Probably not a match then.
			return false;
		};

		// User aborted the verification process (X click or esc keyup)
		function userAborted(selector, e)
		{
			// Even though there may be more than one bound, and this disables the others,
			// this is for simplicity: and I figure, it won't happen too often.
			// (Otherwise "Completed" events are raised by pressing Esc even if nothing is happening)
			$(document).unbind('keyup');

			$(selector).slideUp(defaults.speed, function()
			{
				$(this).remove();
				$(this).unbind('click');
			});

			trigger("Completed", e.data);
		}

		// When we're done with a "pop-up" where the user chooses what to do,
		// we need to remove all other events bound on that whole "pop-up"
		// so that it doesn't interfere with any future "pop-ups".
		function undelegateAllClicks(selectors)
		{
			for (var selector in selectors)
				$('body').undelegate(selectors[selector], 'click');
		}


		// If anything was previously mapped, this resets it all for a new mapping.
		this.clean = function()
		{
			if (forms.length == 0)
				return;

			if (config.debug)
				console.log("Cleaning up old form map data...");

			// Spare none alive!

			for (var i = 0; i < forms.length; i++)
			{
				$(forms[i].dom).data(mapMeta.formDataProperty, '');

				for (var j = 0; j < forms[i].addresses.length; j++)
				{
					var doms = forms[i].addresses[j].getDomFields();
					for (var prop in doms)
					{
						if (config.debug)
							$(doms[prop]).css('background', 'none').attr('placeholder', '');
						$(doms[prop]).unbind('change');
					}
				}
			}

			$('.smarty-dots, .smarty-address-verified').remove();
			$('body').undelegate('.smarty-undo', 'click');

			forms = [];

			if (config.debug)
				console.log("Done cleaning up form map data; ready for new mapping.");
		};


		// ** AUTOMAPPING ** //
		this.automap = function(contextSelector)
		{
			if (config.debug)
				console.log("Automapping fields...");

			this.clean();

			//$('form').add($('iframe').contents().find('form')).each(function(idx) 	// Include forms in iframes, but they must be hosted on same domain (and iframe must have already loaded)
			$('form').each(function(idx)	 // For each form ...
			{
				var form = new Form(this);
				var potential = {};

				// Look for each type of field in this form
				for (var fieldName in mapMeta.identifiers)
				{
					var names = mapMeta.identifiers[fieldName].names;
					var labels = mapMeta.identifiers[fieldName].labels;

					// Find matching form elements and store them away
					potential[fieldName] = $(config.fieldSelector, this)
						.filter(function()
						{
							// Must be somewhere in the user's root node selector
							return $(this).closest(contextSelector).length > 0;
						})
						.filter(':visible')
						.filter(function()
						{
							var name = lowercase(this.name), id = lowercase(this.id);

							// "Street address line 1" is a special case because "address" is an ambiguous
							// term, so we pre-screen this field by looking for exact matches.
							if (fieldName == "streets")
							{
								for (var i = 0; i < mapMeta.street1exacts.names.length; i++)
									if (name == mapMeta.street1exacts.names[i] || id == mapMeta.street1exacts.names[i])
										return true;
							}

							// Now perform the main filtering.
							// If this is TRUE, then this form element is probably a match for this field type.
							var filterResult = filterDomElement(this, names, labels);

							if (fieldName == "streets")
							{
								// Looking for "address" is a very liberal search, so we need to see if it contains another
								// field name, too... this helps us find freeform addresses (SLAP).
								var otherFields = ["city", "state", "zipcode", "country"];
								for (var i = 0; i < otherFields.length; i ++)
								{
									// If any of these filters turns up true, then it's
									// probably neither a "street" field, nor a SLAP address.
									if (filterDomElement(this, mapMeta.identifiers[otherFields[i]].names,
											mapMeta.identifiers[otherFields[i]].labels))
										return false;
								}
							}

							return filterResult;
						})
						.not(function()
						{
							// The filter above can be a bit liberal at times, so we need to filter out
							// results that are actually false positives (fields that aren't part of the address)
							// Returning true from this function excludes the element from the result set.
							var name = lowercase(this.name), id = lowercase(this.id);
							if (name == "name" || id == "name")	// Exclude fields like "First Name", et al.
								return true;

							return filterDomElement(this, mapMeta.exclude.names, mapMeta.exclude.labels);
						})
						.toArray();
				}

				// Now prepare to differentiate between street1 and street2.
				potential.street = [], potential.street2 = [];

				// If the ratio of 'street' fields to the number of addresses in the form
				// (estimated by number of city or zip fields) is about the same, it's all street1.
				if (potential.streets.length <= potential.city.length * 1.5
					|| potential.streets.length <= potential.zipcode.length * 1.5)
				{
					potential.street = potential.streets;
				}
				else
				{
					// Otherwise, differentiate between the two
					for (var i = 0; i < potential.streets.length; i++)
					{
						// Try to map it to a street2 field first. If it fails, it's street1.
						// The second condition is for naming schemes like "street[]" or "address[]", where the names
						// are the same: the second one is usually street2.
						var current = potential.streets[i];
						if (filterDomElement(current, mapMeta.street2.names, mapMeta.street2.labels)
							|| (i > 0 && current.name == potential.streets[i-1].name))
						{
							// Mapped it to street2
							potential.street2.push(current);
						}
						else	// Could not map to street2, so put it in street1
							potential.street.push(current);
					}
				}

				delete potential.streets;	// No longer needed; we've moved them into street/street2.

				if (config.debug)
					console.log("For form " + idx + ", the initial scan found these fields:", potential);



				// Now organize the mapped fields into addresses

				// The number of addresses will be the number of street1 fields,
				// and in case we support it in the future, maybe street2, or
				// in case a mapping went a little awry.
				var addressCount = Math.max(potential.street.length, potential.street2.length);

				if (config.debug && addressCount == 0)
					console.log("No addresses were found in form " + idx + ".");

				for (var i = 0; i < addressCount; i++)
				{
					var addrObj = {};
					for (var field in potential)
					{	
						var current = potential[field][i];
						if (current)
							addrObj[field] = current;
					}


					// Don't map the address if there's not enough fields for a complete address
					var hasCityAndStateOrZip = addrObj.zipcode || (addrObj.state && addrObj.city);
					var hasCityOrStateOrZip = addrObj.city || addrObj.state || addrObj.zipcode;
					if ((!addrObj.street && hasCityAndStateOrZip) || (addrObj.street && !hasCityAndStateOrZip && hasCityOrStateOrZip))
					{
						if (config.debug)
							console.log("Form " + idx + " contains some address input elements, but not enough for a complete address.");
						continue;
					}

					form.addresses.push(new Address(addrObj, form));
				}

				// Save the form we just finished mapping
				forms.push(form);

				if (config.debug)
					console.log("Form " + idx + " is finished:", form);
			});
		
			postMappingOperations();

			if (config.debug)
				console.log("Automapping complete.");
			
			trigger("FieldsMapped");
		};


		// ** MANUAL MAPPING ** //
		this.mapFields = function(map, selector)
		{

			// "map" should be an array of objects mapping field types
			// to a field by selector, all supplied by the user.
			// "selector" should be a selector in which fields will be mapped.

			if (config.debug)
				console.log("Manually mapping fields given this data:", map);

			this.clean();

			var formsFound = [];

			for (var addrIdx in map)
			{
				var address = map[addrIdx];

				if (!address.street)
					continue;

				// Convert ID names into actual DOM references
				for (var fieldType in address)
					address[fieldType] = $(address[fieldType], selector);

				// Acquire the form based on the street address field (the required field)
				var formDom = $(address.street).parents('form')[0];
				var form = new Form(formDom);
				
				// Persist a reference to the form if it wasn't acquired before
				if (!$(formDom).data(mapMeta.formDataProperty))
				{
					// Mark the form as mapped then add it to our list
					$(formDom).data(mapMeta.formDataProperty, 1);
					formsFound.push(form);
				}
				else
				{
					// Find the form in our list since we already put it there
					for (var i = 0; i < formsFound.length; i++)
					{
						if (formsFound[i].dom == formDom)
						{
							form = formsFound[i];
							break;
						}
					}
				}

				// Add this address to the form
				form.addresses.push(new Address(address, form));
			}

			forms = formsFound;
			postMappingOperations();
			trigger("FieldsMapped");
		};


		this.disableFields = function(address)
		{
			if (!config.ui)
				return;

			// Given an address, disables the input fields for the address, also the submit button
			var fields = address.getDomFields();
			for (var prop in fields)
			{
				// TODO: If we drop support for jQuery 1.5 and bump it up, we could be using .prop() here. (and just below)
				$(fields[prop]).attr('disabled', 'disabled');
			}

			// Disable submit buttons
			$(config.submitSelector, address.form.dom).attr('disabled', 'disabled');
		};

		this.enableFields = function(address)
		{
			if (!config.ui)
				return;

			// Given an address, re-enables the input fields for the address
			var fields = address.getDomFields();
			for (var prop in fields)
				$(fields[prop]).removeAttr('disabled');	// Again, could be using .prop() if jQuery 1.6+

			// Enable submit buttons
			$(config.submitSelector, address.form.dom).removeAttr('disabled');
		};

		this.showLoader = function(addr)
		{
			if (!config.ui)
				return;

			// Get position information now instead of earlier in case elements shifted since page load
			var lastFieldCorners = addr.corners(true);
			var loaderWidth = 24, loaderHeight = 8;		// TODO: Keep this updated if the image changes...
			var loaderElement = $('.smarty-dots.smarty-addr-'+addr.id());

			loaderElement.css("top", (lastFieldCorners.top + lastFieldCorners.height / 2 - loaderHeight / 2) + "px")
					   .css("left", (lastFieldCorners.right - loaderWidth - 3) + "px");

			$('.smarty-dots.smarty-addr-'+addr.id()).show();
		};

		this.hideLoader = function(addr)
		{
			if (config.ui)
				$('.smarty-dots.smarty-addr-'+addr.id()).hide();
		};

		this.showValid = function(addr)
		{
			if (!config.ui)
				return;
			
			var validDom = $('.smarty-address-verified.smarty-addr-'+addr.id());
			var lastFieldCorners = addr.corners(true);
			
			// Position the valid box in the right spot
			validDom.css("top", (lastFieldCorners.top + lastFieldCorners.height / 2 - 12) + "px").css("left", (lastFieldCorners.right - 3) + "px");

			if (validDom.length > 0 && !validDom.is(':visible'))
				validDom.show(defaults.speed);
		};

		this.hideValid = function(addr)
		{
			var validSelector = '.smarty-address-verified.smarty-addr-'+addr.id();
			if (!addr || !config.ui || !$(validSelector).is(':visible'))
				return;

			// Hide the "verified" message then re-show undo button for possible later use
			$(validSelector).hide(defaults.speed, function()
			{
				$('.smarty-undo', this).show();
			});
		};


		this.showAmbiguous = function(data)
		{
			if (!config.ui)
				return;

			var addr = data.address;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 380); 	// minimum width
			corners.height = Math.max(corners.height, response.length * 48 + 145);	// minimum height

			var html = '<div class="smarty-container smarty-address-ambiguous smarty-addr-'+addr.id()+'" style="position: absolute; '
				+ 'top: '+corners.top+'px; left: '+corners.left+'px; width: '+corners.width+'px; height: '+corners.height+'px;">'
				+ '<a href="javascript:" class="smarty-abort">x</a>'
				+ '<div class="smarty-ambiguous-message">'+config.ambiguousMessage+'</div>';

			for (var i = 0; i < response.raw.length; i++)
			{
				var line1 = response.raw[i].delivery_line_1, city = response.raw[i].components.city_name,
					st = response.raw[i].components.state_abbreviation,
					zip = response.raw[i].components.zipcode + "-" + response.raw[i].components.plus4_code;

				html += '<a href="javascript:" class="smarty-choice smarty-good-addr" data-index="'+i+'"><b>'+line1+'</b> &nbsp;'+city+', '+st+' '+zip+'</a>';
			}
			
			html += '<a href="javascript:" class="smarty-choice smarty-choice-abort">None of these; I\'ll type another address</a>';
			html += '<a href="javascript:" class="smarty-choice smarty-use-original">I certify what I typed is correct<br>('+addr.toString()+')</a></div>';
			$(html).hide().appendTo('body').show(defaults.speed);
			
			// Scroll to it if needed
			if ($(document).scrollTop() > corners.top - 100
				|| $(document).scrollTop() < corners.top - $(window).height() + 100)
			{
				$('html, body').stop().animate({
					scrollTop: $('.smarty-address-ambiguous').offset().top - 100
				}, 500);
			}

			data.selectors = {
				goodAddr: '.smarty-address-ambiguous.smarty-addr-'+addr.id()+' .smarty-good-addr',
				useOriginal: '.smarty-address-ambiguous .smarty-use-original',
				abort: '.smarty-address-ambiguous.smarty-addr-'+addr.id()+' .smarty-abort, .smarty-address-ambiguous.smarty-addr-'+addr.id()+' .smarty-choice-abort'
			};

			$('body').delegate(data.selectors.goodAddr, 'click', data, function(e)
			{
				// User chose a candidate address
				$('.smarty-addr-'+addr.id()+'.smarty-address-ambiguous').slideUp(defaults.speed, function()
				{
					$(this).remove();
				});

				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;

				trigger("UsedSuggestedAddress", {
					address: e.data.address,
					response: e.data.response,
					invoke: e.data.invoke,
					chosenCandidate: response.raw[$(this).data('index')]
				});
			});

			$('body').delegate(data.selectors.useOriginal, 'click', data, function(e)
			{
				// User wants to revert to what they typed
				$('.smarty-addr-'+e.data.address.id()+'.smarty-address-ambiguous').slideUp(defaults.speed, function()
				{
					$(this).remove();
				});

				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;
				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function(e)
			{
				if (e.keyCode == 27) //Esc
				{
					undelegateAllClicks(e.data.selectors);
					delete e.data.selectors;
					userAborted('.smarty-addr-'+e.data.address.id()+'.smarty-address-ambiguous', e);
				}
			});

			// User clicks "x" in corner (same effect as Esc key)
			$(data.selectors.abort).click(data, function(e)
			{
				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;
				userAborted($(this).parents('.smarty-address-ambiguous')[0], e);
			});
		};


		this.showInvalid = function(data)
		{
			if (!config.ui)
				return;

			var addr = data.address;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 350); 	// minimum width
			corners.height = Math.max(corners.height, 175);	// minimum height

			var html = '<div class="smarty-container smarty-address-invalid smarty-addr-'+addr.id()+'" style="position: absolute; '
				+ 'top: '+corners.top+'px; left: '+corners.left+'px; width: '+corners.width+'px; height: '+corners.height+'px;">'
				+ '<a href="javascript:" class="smarty-abort">x</a>'
				+ '<div class="smarty-invalid-message">'+config.invalidMessage+'</div>'
				+ '<a href="javascript:" class="smarty-choice smarty-invalid-rejectoriginal">&rsaquo; I will double-check the address</a>'
				+ '<a href="javascript:" class="smarty-choice smarty-use-original">&rsaquo; I certify what I typed is correct<br> &nbsp; ('+addr.toString()+')</a></div>';

			$(html).hide().appendTo('body').show(defaults.speed);

			data.selectors = {
				rejectOriginal: '.smarty-address-invalid .smarty-invalid-rejectoriginal',
				useOriginal: '.smarty-address-invalid .smarty-use-original',
				abort: '.smarty-address-invalid.smarty-addr-'+addr.id()+' .smarty-abort'
			};

			// Scroll to it if necessary
			if ($(document).scrollTop() > corners.top - 100
				|| $(document).scrollTop() < corners.top - $(window).height() + 100)
			{
				$('html, body').stop().animate({
					scrollTop: $('.smarty-address-invalid').offset().top - 100
				}, 500);
			}

			$('body').delegate(data.selectors.rejectOriginal, 'click', data, function(e)
			{
				// User rejects original input and agrees to double-check it
				$('.smarty-addr-'+e.data.address.id()+'.smarty-address-invalid').slideUp(defaults.speed, function()
				{
					$(this).remove();	// See "userAborted()" for the reason why we unbind here
				});

				$(document).unbind('keyup');
				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;

				trigger("InvalidAddressRejected", e.data);
			});

			$('body').delegate(data.selectors.useOriginal, 'click', data, function(e)
			{
				// User certifies that what they typed is correct
				$('.smarty-addr-'+addr.id()+'.smarty-address-invalid').slideUp(defaults.speed, function()
				{
					$(this).remove();
				});

				$(document).unbind('keyup');
				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;

				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function(e)
			{
				if (e.keyCode == 27) //Esc
				{
					undelegateAllClicks(e.data.selectors);
					userAborted('.smarty-addr-'+e.data.address.id()+'.smarty-address-invalid', e);
				}
			});

			// User clicks "x" in corner (same effect as Esc key)
			$(data.selectors.abort).click(data, function(e)
			{
				undelegateAllClicks(e.data.selectors);
				userAborted($(this).parents('.smarty-address-invalid')[0], e);
			});
		};
	}








	/*
		Represents an address inputted by the user,
		whether it has been verified yet or not.
		formObj must be a Form OBJECT, not a <form> tag...
	*/
	function Address(domMap, formObj)
	{
		// PRIVATE MEMBERS //

		var self = this;							// Pointer to self so that internal functions can reference its parent
		var fields;									// Data values and references to DOM elements
		var id;										// An ID by which to classify this address on the DOM
		var state = "accepted"; 					// Can be: "accepted" or "changed"
		var acceptableFields = ["street", "street2", "secondary",
								"city", "state", "zipcode", "lastline",
								"addressee", "urbanization", "country"];
		// Example of a field:  street: { value: "123 main", dom: DOMElement, undo: "123 mai"}
		// Some of the above fields will only be mapped manually, not automatically.
		
		// Internal method that actually changes the address. The keepState parameter is
		// used by the results of verification after an address is chosen; (or an "undo"
		// on a freeform address), otherwise an infinite loop of requests is executed
		// because the address keeps changing! (Set "fromUndo" to true when coming from the "Undo" link)	
		var doSet = function(key, value, updateDomElement, keepState, sourceEvent, fromUndo)
		{
			if (!arrayContains(acceptableFields, key))
				return false;

			if (!fields[key])
				fields[key] = {};

			var differentVal = fields[key].value != value;

			fields[key].undo = fields[key].value || "";
			fields[key].value = value;

			if (updateDomElement && fields[key].dom)
				$(fields[key].dom).val(value);
			
			var eventMeta = {
				sourceEvent: sourceEvent,	// may be undefined
				field: key,
				address: self,
				value: value,
				suppressAutoVerification: fromUndo || false
			};
			
			if (differentVal && !keepState)
			{
				ui.hideValid(self);
				if (self.isDomestic())
				{
					self.unaccept();
					trigger("AddressChanged", eventMeta);
				}
				else
					self.accept({ address: self }, false);
			}

			return true;
		};




		// PUBLIC MEMBERS //

		this.form = formObj;	// Reference to the parent form object (NOT THE DOM ELEMENT)
		this.verifyCount = 0;	// Number of times this address was submitted for verification
		this.lastField;			// The last field found (last to appear in the DOM) during mapping, or the order given


		// Constructor-esque functionality (save the fields in this address object)
		this.load = function(domMap)
		{
			fields = {};
			id = randomInt(1, 99999);

			if (typeof domMap === 'object')
			{
				// Find the last field likely to appear on the DOM (used for UI attachments)
				this.lastField = domMap.lastline || domMap.zipcode || domMap.state || domMap.city || domMap.street;

				var isEmpty = true;	// Whether the address has data in it (pre-populated)

				for (var prop in domMap)
				{
					if (!arrayContains(acceptableFields, prop))
						continue;

					var elem = $(domMap[prop]);
					var isData = elem.toArray().length == 0;
					var val;
					if (elem.toArray().length == 0) // No matches; treat it as a string of address data instead
						val = domMap[prop];
					else
						val = elem.val();

					fields[prop] = {};
					fields[prop].value = val;
					fields[prop].undo = val;
					
					isEmpty = isEmpty ? val.length == 0 || domMap[prop].tagName == "SELECT" : isEmpty;

					if (!isData)
					{
						if (config.debug)
						{
							elem.css('background', '#FFFFCC');
							elem.attr('placeholder', prop);
						}

						fields[prop].dom = domMap[prop];
					}


					// This has to be passed in at bind-time; they cannot be obtained at run-time
					var data = {
						address: this,
						field: prop,
						value: val
					};
					
					// Bind the DOM element to needed events, passing in the data above
					$(domMap[prop]).change(data, function(e)
					{
						e.data.address.set(e.data.field, e.target.value, false, false, e, false);
					});
				}

				if (!isEmpty)
					state = "changed";
			}
		};

		// Run the "constructor" to load up the address
		this.load(domMap);


		this.set = function(key, value, updateDomElement, keepState, sourceEvent, fromUndo)
		{
			if (typeof key === 'string' && arguments.length >= 2)
				return doSet(key, value, updateDomElement, keepState, sourceEvent, fromUndo);
			else if (typeof key === 'object')
			{
				var successful = true;
				for (var prop in key)
					successful = doSet(prop, key[prop], updateDomElement, keepState, sourceEvent, fromUndo) ? successful : false;
				return successful;
			}
		};

		this.replaceWith = function(resp, updateDomElement, e)
		{
			// Given the response from an API request associated with this address,
			// replace the values in the address... and if updateDomElement is true,
			// then change the values in the fields on the page accordingly.
			// NOTE: "resp" should contain just the candidate to replace with, not all
			// of them! If an array is passed in, the 0th element is chosen.
			
			if (typeof resp === 'array' && resp.length > 0)
				resp = resp[0];

			if (self.isFreeform())
			{
				var singleLineAddr = (resp.addressee ? resp.addressee + " " : "") +
					(resp.delivery_line_1 ? resp.delivery_line_1 + " " : "") +
					(resp.delivery_line_2 ? resp.delivery_line_2 + " " : "") +
					(resp.components.urbanization ? resp.components.urbanization + " " : "") +
					(resp.last_line ? resp.last_line : "");

				self.set("street", singleLineAddr, updateDomElement, true, e, false);
			}
			else
			{
				if (resp.addressee)
					self.set("addressee", resp.addressee, updateDomElement, true, e, false);
				if (resp.delivery_line_1)
					self.set("street", resp.delivery_line_1, updateDomElement, true, e, false);
				self.set("street2", resp.delivery_line_2 || "", updateDomElement, true, e, false);	// Rarely used; must otherwise be blank.
				self.set("secondary", "", updateDomElement, true, e, false);	// Not used in standardized addresses
				if (resp.components.urbanization)
					self.set("urbanization", resp.components.urbanization, updateDomElement, true, e, false);
				if (resp.components.city_name)
					self.set("city", resp.components.city_name, updateDomElement, true, e, false);
				if (resp.components.state_abbreviation)
					self.set("state", resp.components.state_abbreviation, updateDomElement, true, e, false);
				if (resp.components.zipcode && resp.components.plus4_code)
					self.set("zipcode", resp.components.zipcode + "-" + resp.components.plus4_code, updateDomElement, true, e, false);
			}
		};

		this.corners = function(lastField)
		{
			var corners = {};

			if (!lastField)
			{
				for (var prop in fields)
				{
					if (!fields[prop].dom)
						continue;

					var dom = fields[prop].dom;
					var offset = $(dom).offset();
					offset.right = offset.left + $(dom).outerWidth();
					offset.bottom = offset.top + $(dom).outerHeight();

					corners.top = !corners.top ? offset.top : Math.min(corners.top, offset.top);
					corners.left = !corners.left ? offset.left : Math.min(corners.left, offset.left);
					corners.right = !corners.right ? offset.right : Math.max(corners.right, offset.right);
					corners.bottom = !corners.bottom ? offset.bottom : Math.max(corners.bottom, offset.bottom);
				}
			}
			else
			{
				var jqDom = $(self.lastField);
				corners = jqDom.offset();
				corners.right = corners.left + jqDom.outerWidth();
				corners.bottom = corners.top + jqDom.outerHeight();
			}

			corners.width = corners.right - corners.left;
			corners.height = corners.bottom - corners.top;

			return corners;
		};

		this.verify = function(invoke)
		{
			// Invoke contains the element to "click" on once we're all done, or is a user-defined callback function (may also be undefined)
			if (!invoke && !self.enoughInput())
				return null;

			ui.disableFields(self);
			self.verifyCount ++;
			var addrData = self.toRequest();

			$.ajax(
			{
				url: defaults.requestUrl+"?auth-token="+config.key+"&callback=?",
				dataType: "jsonp",
				data: addrData,
				timeout: config.timeout
			})
			.done(function(response, statusText, xhr)
			{
				trigger("ResponseReceived", { address: self, response: new Response(response), invoke: invoke });
			})
			.fail(function(xhr, statusText)
			{
				trigger("RequestTimedOut", { address: self, status: statusText, invoke: invoke });
				self.verifyCount --; 			// Address verification didn't actually work
			});

			// Remember, the above callbacks happen later and this function is
			// executed immediately afterward, probably before a response is received.
			trigger("RequestSubmitted", { address: self });
		};

		this.enoughInput = function()
		{
			return (fields.street && fields.street.value)
				&& (
					(
						(fields.city && fields.city.value)
						&& (fields.state && fields.state.value)
					)
					|| (fields.zipcode && fields.zipcode.value)
					|| (!fields.street2 && !fields.city && !fields.state && !fields.zipcode) // Enables SLAP addresses (only a street field)
				   );
		};

		this.toRequest = function()
		{
			var obj = {};
			for (var key in fields)
			{
				var keyval = {};
				keyval[key] = fields[key].value.replace(/\r|\n/g, " "); // Line breaks to spaces
				$.extend(obj, keyval);
			}
			return $.extend(obj, {candidates: config.candidates});
		};

		this.toString = function()
		{
			return (fields.street ? fields.street.value + " " : "")
				+ (fields.street2 ? fields.street2.value + " " : "")
				+ (fields.secondary ? fields.secondary.value + " " : "")
				+ (fields.city ? fields.city.value + " " : "")
				+ (fields.state ? fields.state.value + " " : "")
				+ (fields.zipcode ? fields.zipcode.value : "");
		}

		this.abort = function(event, keepAccept)
		{
			keepAccept = typeof keepAccet === 'undefined' ? false : keepAccept;
			if (!keepAccept)
				self.unaccept();
			delete self.form.processing;
			return suppress(event);
		}

		// Based on the properties in "fields," determines if this is a single-line address
		this.isFreeform = function()
		{
			return fields.street && !fields.street2 && !fields.secondary
					&& !fields.addressee && !fields.city && !fields.state
					&& !fields.zipcode && !fields.urbanization && !fields.lastline;
		}
		
		this.get = function(key)
		{
			return fields[key] ? fields[key].value : null
		};

		this.undo = function(updateDomElement)
		{
			updateDomElement = typeof updateDomElement === 'undefined' ? true : updateDomElement;
			for (var key in fields)
				this.set(key, fields[key].undo, updateDomElement, false, undefined, true);
		};

		this.accept = function(data, showValid)
		{
			showValid = typeof showValid === 'undefined' ? true : showValid;
			state = "accepted";
			ui.enableFields(self);
			if (showValid)	// If user chooses original input or the request timed out, the address wasn't "verified"
				ui.showValid(self);
			trigger("AddressAccepted", data);
		};

		this.unaccept = function()
		{
			state = "changed";
			ui.hideValid(self);
		};

		this.getUndoValue = function(key)
		{
			return fields[key].undo;
		};

		this.status = function()
		{
			return state;
		};

		this.syncWithDom = function(internalPriority)
		{
			// Since programmatic changes to form field values (e.g. jQuery's .val() function)
			// don't necessarily raise the "change" event, at form submit time we should
			// sync internally-stored values with those on the DOM.

			// Set "internalPriority" to true if a field value exists internally but
			// does not exist on the DOM, and yet you want to keep the internal value.
			// This can cause problems for an address that is ambiguous more than once
			// (for example, addressee may be populated by the response but is not in the DOM.
			for (var prop in fields)
			{
				if (!fields[prop].dom && fields[prop].value && !internalPriority)
				{
					delete fields[prop];
					continue;
				}
				else if (fields[prop].dom && fields[prop].value)
				{
					var domValue = $(fields[prop].dom).val();
					if (fields[prop].value != domValue)
					{
						self.unaccept();
						fields[prop].value = domValue;
					}
				}
			}
		};

		this.getDomFields = function()
		{
			// Gets just the DOM elements for each field
			var obj = {};
			for (var prop in fields)
			{
				var ext = {};
				ext[prop] = fields[prop].dom;
				$.extend(obj, ext);
			}
			return obj;
		};

		this.hasDomFields = function()
		{
			for (var prop in fields)
				if (fields[prop].dom)
					return true;
		}

		this.isDomestic = function()
		{
			if (!fields.country)
				return true;

			var countryValue = fields.country.value.toUpperCase().replace(/\.|\s|\(|\)|\\|\/|-/g, "");
			var usa = ["", "0", "COUNTRY", "NONE", "US", "USA", "USOFA", "USOFAMERICA", "AMERICAN",
						"UNITEDSTATES", "UNITEDSTATESAMERICA",	"UNITEDSTATESOFAMERICA", "AMERICA",
						"840", "223", "AMERICAUNITEDSTATES", "AMERICAUS", "AMERICAUSA"];	// 840 is ISO: 3166, and 223 is Zen Cart
			return arrayContains(usa, countryValue) || fields.country.value == "-1";
		}

		this.id = function()
		{
			return id;
		};
	}







	/*
		Represents a <form> tag which must house mapped fields.
	*/
	function Form(domElement)
	{
		this.addresses = [];
		this.dom = domElement;

		this.allAddressesAccepted = function()
		{
			for (var i = 0; i < this.addresses.length; i++)
			{
				var addr = this.addresses[i];
				if (addr.status() != "accepted")
					return false;
			}
			return true;
		};

		this.addressesNotAccepted = function()
		{
			var addrs = [];
			for (var i = 0; i < this.addresses.length; i++)
			{
				var addr = this.addresses[i];
				if (addr.status() != "accepted")
					addrs.push(addr);
			}
			return addrs;
		};
	}






	/*
		Wraps output from the API in an easier-to-handle way
	*/

	function Response(json)
	{
		// PRIVATE MEMBERS //

		var checkBounds = function(idx)
		{
			// Ensures that an index is within the number of candidates
			if (idx >= json.length || idx < 0)
			{
				if (json.length == 0)
					throw new Error("Candidate index is out of bounds (no candidates returned; requested " + idx + ")");
				else
					throw new Error("Candidate index is out of bounds (" + json.length + " candidates; indicies 0 through " + (json.length - 1) + " available; requested " + idx + ")");
			}
		};

		var maybeDefault = function(idx)
		{
			// Assigns index to 0, the default value, if no value is passed in
			return typeof idx === 'undefined' ? 0 : idx;
		};




		// PUBLIC-FACING MEMBERS //

		this.raw = json;
		this.length = json.length;
		this.numCandidates = function() { return json.length; };

		this.isValid = function()
		{
			return this.length == 1;
		};

		this.isInvalid = function()
		{
			return this.length == 0;
		};

		this.isAmbiguous = function()
		{
			return this.length > 1;
		};

		// These next functions are not comprehensive, but helpful for common tasks.

		this.isMissingSecondary = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.dpv_footnotes.indexOf("N1") > -1
					|| (this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("H#") > -1);
		};

		this.isBadSecondary = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("S#") > -1;
		}

		this.componentChanged = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("L#") > -1;
		}

		this.betterAddressExists = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("P#") > -1;
		}

		this.isExactMatch = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.footnotes && this.raw[idx].analysis.dpv_footnotes == "AABB";
		}

		this.isUniqueZipCode = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.dpv_footnotes.indexOf("U1") > -1
					|| (this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("Q#") > -1);
		}

		this.fixedAbbreviations = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("N#") > -1;
		}

		this.fixedZipCode = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("A#") > -1;
		}

		this.fixedSpelling = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.footnotes.indexOf("B#") > -1
				|| (this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("M#") > -1);
		}

		this.isBuildingDefault = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].metadata.building_default_indicator;
		}

		this.isMilitary = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.dpv_footnotes.indexOf("F1") > -1;
		}

		this.hasExtraSecondary = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.dpv_footnotes.indexOf("CC") > -1;
		}

		this.isLacsLink = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.lacslink_code == "A";
		}
	}





	/*
	 *	EVENT HANDLER SHTUFF
	 */


	/*
		Called every time a LiveAddress event is raised.
		This allows us to maintain the binding even if the
		callback function is changed later.
		"event" is the actual event object, and
		"data" is anything extra to pass to the event handler.
	*/
	function HandleEvent(event, data)
	{
		var handler = EventHandlers[event.type];
		if (handler)
			handler(event, data);
	}


	var EventHandlers = {
		FieldsMapped: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "FieldsMapped", "(Field mapping completed)", event, data);
		},

		AddressChanged: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "AddressChanged", "(Address changed)", event, data);
			
			// If autoVerify is on,
			// AND there's enough input in the address,
			// AND it hasn't been verified automatically before -OR- it's a freeform address,
			// AND autoVerification isn't suppressed (from an Undo click even on a freeform address)
			// AND it has a DOM element (it's not just a programmatic Address object)...
			// THEN verification has been invoked.

			if (config.autoVerify && data.address.enoughInput()
				&& (data.address.verifyCount == 0 || data.address.isFreeform())
				&& !data.suppressAutoVerification
				&& data.address.hasDomFields())
				trigger("VerificationInvoked", { address: data.address });
		},

		VerificationInvoked: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "VerificationInvoked", "(Verification invoked)", event, data);

			if (data.address.form)
				data.address.form.processing = true;

			data.address.verify(data.invoke);
		},

		RequestSubmitted: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "RequestSubmitted", "(Request submitted)", event, data);

			ui.showLoader(data.address);
		},

		ResponseReceived: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "ResponseReceived", "(Response received)", event, data);

			ui.hideLoader(data.address);
			
			if (typeof data.invoke === "function")
				data.invoke(data.response);	// User-defined callback function
			else
			{
				if (data.response.isInvalid())
					trigger("AddressWasInvalid", data);
				else if (data.response.isValid())
					trigger("AddressWasValid", data);
				else
					trigger("AddressWasAmbiguous", data);
			}
		},

		RequestTimedOut: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "RequestTimedOut", "(Request timed out)", event, data);

			if (data.address.form)
				delete data.address.form.processing;	// Tell the potentially duplicate event handlers that we're done.

			// If this was a form submit, don't let a network failure hold back the user. Invoke the submit event.
			if (data.invoke)
			{
				data.address.accept(data, false);
				if (typeof data.invoke !== 'function')
					$(data.invoke).click();
				else
					data.invoke(data);
			}

			ui.enableFields(data.address);
			ui.hideLoader(data.address);
		},

		AddressWasValid: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "AddressWasValid", "(Response indicates input address was valid)", event, data);

			var addr = data.address;
			var resp = data.response;

			addr.replaceWith(resp.raw[0], true, event);
			addr.accept(data);
		},

		AddressWasAmbiguous: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "AddressWasAmbiguous", "(Response indiciates input address was ambiguous)", event, data);

			ui.showAmbiguous(data);
		},

		AddressWasInvalid: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "AddressWasInvalid", "(Response indicates input address was invalid)", event, data);

			ui.showInvalid(data);
		},

		OriginalInputSelected: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "OriginalInputSelected", "(User chose to use original input)", event, data);

			data.address.accept(data, false);
		},

		UsedSuggestedAddress: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "UsedSuggestedAddress", "(User chose to a suggested address)", event, data);

			data.address.replaceWith(data.chosenCandidate, true, event);
			data.address.accept(data);
		},

		InvalidAddressRejected: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "InvalidAddressRejected", "(User chose to correct an invalid address)", event, data);
			
			if (data.address.form)
				delete data.address.form.processing;	// We're done with this address and ready for the next, potentially
			
			trigger("Completed", data);
		},

		AddressAccepted: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "AddressAccepted", "(Address marked accepted)", event, data);

			if (data.address.form)
				delete data.address.form.processing;	// We're done with this address and ready for the next, potentially
			
			// If this was the result of a form submit, re-submit the form
			if (data.invoke && typeof data.invoke !== 'function')
				$(data.invoke)[0].click();	// Very particular! MUST call the native click(), NOT jQuery's!

			trigger("Completed", data);
		},

		Completed: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "Completed", "(All done)", event, data);

			if (data.address)
			{
				ui.enableFields(data.address);
				if (data.address.form)
					delete data.address.form.processing;	// We're done with this address and ready for the next, potentially
			}
		},
	};




	/*
	 *	MISCELLANEOUS
	 */

	function arrayContains(array, subject)
	{
		// See if an array contains a particular value
		for (var i in array)
			if (array[i] === subject) return true;
		return false;
	}

	function randomInt(min, max)
	{
		// Generate a random integer between min and max
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function lowercase(string)
	{
		// Return an empty string if not defined, or a lowercase string with '[]' stripped.
		return string ? string.toLowerCase().replace('[]', '') : '';
	}

	function trigger(eventType, metadata)
	{
		// Raise an event (in our case, a custom event)
		$(document).triggerHandler(eventType, metadata);
	}

	function bind(eventType)
	{
		// Bind a custom handler to an event
		$(document).bind(eventType, HandleEvent);
	}

	function suppress(event)
	{
		// Used to prevent form submits, and stop other events if needed
		if (!event) return false;
		if (event.preventDefault) event.preventDefault();
		if (event.stopPropagation) event.stopPropagation();
		if (event.stopImmediatePropagation) event.stopImmediatePropagation();
		event.cancelBubble = true;
		return false;
	}

})(jQuery, window, document);