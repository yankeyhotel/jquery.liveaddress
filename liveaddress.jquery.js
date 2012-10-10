(function($, window, document) {
	"use strict";		//  http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/

	/*
	  *	PRIVATE MEMBERS
	*/
	
	//var LiveAddress;// $.fn.LiveAddress;	// Self-pointer for internal use (TODO)
	var instance;			// Public-facing functions and variables
	var ui = new UI;		// Internal, for UI-related tasks

	var defaults = {
		candidates: 3,
		requestUrl: "https://api.qualifiedaddress.com/street-address",
		timeout: 5000,
		speed: "medium"
	};
	var config = {};		// Configuration settings, either from use or defaults
	var forms = [];			// List of forms which hold lists of addresses


	/*
	  *	ENTRY POINT
	*/

	
	
	$.LiveAddress = function(arg)
	{
		return $('body').LiveAddress(arg);	// 'body' needed to find ancestor in traversal (document won't work)
	};

	$.fn.LiveAddress = function(arg, maintainChainability)
	{
		if (instance)
			return instance;

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
			console.log("LiveAddress v0.1 (Debug mode)");

		if (typeof arg !== 'object')
		{
			// Use the default configuration
			config = { key: arg, candidates: defaults.candidates };
		}
		else
		{
			// Persist the user's configuration
			config = $.extend(config, arg);
		}

		// Enforce some defaults
		if (typeof config.candidates === 'undefined')
			config.candidates = defaults.candidates;
		if (typeof config.ui === 'undefined')
			config.ui = true;
		if (typeof config.autoMap === 'undefined')
			config.autoMap = true;
		if (typeof config.autoVerify === 'undefined')
			config.autoVerify = true;
		if (typeof config.timeout === 'undefined')
			config.timeout = defaults.timeout;

		var selector = this.selector;


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
		 			console.log("String!", addressData);
		 		else if (typeof addressData === "object")
		 			console.log("String!", addressData);
		 	},
			getAddresses: function()
			{
				var addr = [];
				for (var i = 0; i < forms.length; i++)
					for (var j = 0; j < forms[i].addresses.length; j++)
						addr.push(forms[i].addresses[j])
				return addr;
			},
			getAddressByID: function(id)
			{
				for (var i = 0; i < forms.length; i++)
					for (var j = 0; j < forms[i].addresses.length; j++)
						if (forms[i].addresses[j].id() == id)
							return forms[i].addresses[j];
			},
			setKey: function(htmlkey)
			{
				config.key = htmlkey;
			}
		};
		
		// Bind each handler to an event
		for (var prop in EventHandlers)
			bind(prop);
		
		// Wrap this part of initialization in document.ready so the DOM can fully establish
		$(function() {
			// Map fields
			if (config.autoMap)
				instance.mapFields(selector);
		});

		return instance;
		//if (maintainChainability !== false) TODO
		//	return this;
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
			//fieldCssClass: "smarty-field",		// Indicates a form field with address data (as opposed to the loading gif, etc...)
			fieldSelector: "input[type=text], input[type=], textarea, select", // Selectors for possible address-related form elements
			identifiers: {
				streets: {				// both street1 and street2, separated later.
					names: [
						'street',
						//'address',	// This has proven to be a bad idea; only safe if exact match. Don't enable this unless the algorithm is improved.
						'address1',
						'address2',
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
				}/*,			 We don't currently accept country input
				country: {
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
				}*/
			},	// We'll iterate through these (above) to make a basic map of fields, then refine:
			street1exacts: {		// List of case-insensitive exact matches for street1 field
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
			street2: {			// Terms which identify a "street2" field
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
			exclude: {			// Terms we look for to exclude an element from the mapped set
				names: [
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
					'eml',
					'type',
					'method',
					'location',
					'store',
					'save',
					'keep'
				],
				labels: [
					'email',
					'e-mail',
					'e mail',
					' type',
					'save ',
					'keep',
					'method'
				]
			}
		};

		var uiCss = "<style>"
			+ ".smarty-dots { visibility: hidden; margin-left: 5px; }"
			+ ".smarty-address-verified { display: none; max-width: 200px; padding: 10px 15px; margin-top: 15px; font-size: 14px; font-family: sans-serif; color: #2D8D0D; line-height: 1.25em; background: #E2FFBE; border-radius: 5px; text-align: left; }"
			+ ".smarty-undo { font-size: small; color: #0055D4; } .smarty-undo:hover { color: #119FF2; }"
			+ ".smarty-address-ambiguous, .smarty-address-invalid { font-size: 14px; font-family: sans-serif; text-align: left; line-height: 1em !important; color: black; background: #EEE; padding: 10px; border-radius: 5px; z-index: 999; box-shadow: 0px 10px 35px rgba(0, 0, 0, .7); }"
			+ ".smarty-address-ambiguous a, .smarty-address-invalid a { color: #0055D4; font-weight: normal; } .smarty-address-ambiguous a:hover, .smarty-address-invalid a:hover { color: #119FF2 }"
			+ ".smarty-ambiguous-message, .smarty-invalid-message { font-family: 'Helvetica Neue', sans-serif; font-weight: 300; padding: 10px 0 25px; font-size: 20px; border-bottom: 1px solid #888; text-align: center; }"
			+ ".smarty-address-ambiguous { border: 1px solid #AAA; border-top: 10px solid #AAA; }"
			+ ".smarty-ambiguous-message { color: #000; }"
			+ ".smarty-address-invalid { border: 1px solid #CC0000; border-top: 10px solid #CC0000; }"
			+ ".smarty-invalid-message { color: #000; }"
			+ "a.smarty-choice { font-size: 14px !important; padding: 17px !important; text-decoration: none !important; display: block !important; background: #F5F5F5; color: #222; border-bottom: 1px solid #CCC; }"
			+ ".smarty-address-ambiguous .smarty-choice:hover, .smarty-address-ambiguous .smarty-choice:hover * { background: #444; color: #FFF; }"
			+ ".smarty-address-invalid .smarty-choice, .smarty-address-invalid .smarty-choice * { background: #F5F5F5; color: #60AD08; }"
			+ ".smarty-address-invalid .smarty-choice:hover, .smarty-address-invalid .smarty-choice:hover * { background: #A3C952; color: #FFF; }"
			+ ".smarty-address-invalid a:hover { color: #CC0000; }"
			+ ".smarty-address-ambiguous a.smarty-useoriginal { font-size: 12px !important; padding: 7px 17px !important; }"
			+ ".smarty-address-invalid a.smarty-useoriginal { color: #CC0000 !important; }"
			+ "a.smarty-useoriginal:hover { color: #FFF !important; background: #CC0000 !important; }"
			+ "a.smarty-abort { position: absolute !important; top: 5px !important; right: 5px; background: #DDD; color: #999; border-radius: 10px; padding: 2px 6px; font-size: 10px !important; text-decoration: none !important; }"
			+ "a.smarty-choiceabort { padding: 7px 17px !important; } a.smarty-choiceabort:hover { background: #A3C952 !important; color #FFF !important; }"

		function postMappingOperations()
		{
			// Injects materials into the DOM, binds to form submit events, etc...


			// Prepend CSS to head tag to allow cascading and give their style rules priority
			$('head').prepend(uiCss);

			// For each address on the page, inject the loader and "address verified" markup after the last element
			var addresses = instance.getAddresses();
			for (var i = 0; i < addresses.length; i++)
			{
				var id = addresses[i].id();
				$(addresses[i].lastField).after('<img src="http://liveaddress.dev/dots.gif" alt="Loading..." class="smarty-dots smarty-addr-'+id+'"><div class="smarty-address-verified smarty-addr-'+id+'">&#10003; Address verified! &nbsp;<a href="javascript:" class="smarty-undo" data-addressid="'+id+'">Undo</a></div>');
			}

			$('body').delegate('.smarty-undo', 'click', function(e)
			{
				// Undo button clicked
				var addrId = $(this).data('addressid');
				var addr = instance.getAddressByID(addrId);//instance.getAddressByID(addrId);
				addr.undo(true);
				$(this).hide();
			});


			// Bind to form submits through form submit or submit button click
			for (var i = 0; i < forms.length; i++)
			{
				var f = forms[i];

				var handler = function(e)
				{
					if (e.data.form.processing)
						return suppress(e);
					
					if (!e.data.form.allAddressesAccepted(true))
					{
						var unaccepted = e.data.form.addressesNotAccepted(true);
						for (var i = 0; i < unaccepted.length; i++)
						{
							trigger("VerificationInvoked", { address: unaccepted[i], invocation: e.data.invocation });
						}
						return suppress(e);
					}
				};

				// Take any existing handlers and re-bind them for AFTER our handler(s).
				var jqForm = $(f.dom);
				var jqFormSubmits = $('[type=submit], [type=image]', f.dom);

				// TODO: (Do this maybe: Example code, which rips out an element, replaces with clone, IE-safe: $('#btnSubmitOrder')[0].outerHTML = $('#btnSubmitOrder')[0].outerHTML; )

				// First through form submit events...
				jqForm.each(function(idx)
				{
					if ($(this).data('events') && $(this).data('events').submit && $(this).data('events').submit.length > 0)
					{
						// Form submit event
						var oldHandlers = $(this).data('events').submit;
						$(this).unbind('submit');
						$(this).submit({
							form: f,
							invocation: {
								event: "submit",
								element: $(this)
							}
						}, handler) // Bind ours
						for (var j = 0; j < oldHandlers.length; j++)
						{
							$(this).submit(oldHandlers[j].data, oldHandlers[j].handler); // Bind theirs after
						}
					}
					else
						jqForm.submit({
							form: f,
							invocation: {
								event: "submit",
								element: $(this)
							}
						}, handler);
				});



				// Also through clicking the submit button (or input type=image)
				jqFormSubmits.each(function(idx)
				{
					if ($(this).data('events') && $(this).data('events').click && $(this).data('events').click.length > 0)
					{
						// Form submit event
						var oldHandlers = $.extend(true, [], $(this).data('events').click);
						$(this).unbind('click');
						$(this).click({
							form: f,
							invocation: {
								event: "click",
								element: $(this)
							}
						}, handler); // Bind ours
						for (var j = 0; j < oldHandlers.length; j++)
							$(this).click(oldHandlers[j].data, oldHandlers[j].handler); // Bind theirs after
					}
					else
						$(this).click({
							form: f,
							invocation: {
								event: "click",
								element: $(this)
							}
						}, handler); // Bind ours
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
			$(selector).slideUp(defaults.speed, function()
			{
				$(this).remove();
			});

			trigger("Completed", e.data);
		}



		this.automap = function(contextSelector)
		{
			if (config.debug)
				console.log("Automapping fields...");

			// For each form...
			$('form').each(function(idx)
			{
				var form = new Form(this);
				var potential = {};
				
				// TODO: SLAP SUPPORT. 
				// 1. If field has "address", make sure it doesn't contain any other field name like city or email
				// 2. If only a street field is found, it is its own address.
				
				// Look for each type of field in this form
				for (var fieldName in mapMeta.identifiers)
				{
					var names = mapMeta.identifiers[fieldName].names;
					var labels = mapMeta.identifiers[fieldName].labels;

					// Find matching form elements and store them away
					potential[fieldName] = $(mapMeta.fieldSelector, this)
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
								for (var i = 0; i < mapMeta.street1exacts.names.length; i++)
									if (name == mapMeta.street1exacts.names[i] || id == mapMeta.street1exacts.names[i])
										return true;

							// The rest of the fields we can generally match fuzzy.
							return filterDomElement(this, names, labels);
						})
						.not(function()
						{
							// The filter above can be a bit liberal at times, so we need to filter out
							// results that are actually false positives (fields that aren't part of the address)
							// Returning true from this function excludes the element from the result set.
							//var name = lowercase(this.name), id = lowercase(this.id);
							//if (name == "name" || id == "name")	// Exclude fields like "First Name", et al.
							//	return true;
							console.log(this);
							return false;
							//return filterDomElement(this, mapMeta.exclude.names, mapMeta.exclude.labels);
						})
						.toArray();
				}

				// Now differentiate between street1 and street2.
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
							//$(current).data('smarty').Field = 'street2';
							//continue;
						}
						else	// Could not map to street2, so put it in street1
							potential.street.push(current);

						// Could not map to street2, so put it in street1
						//$(current).data('smarty').Field = 'street1';
						//potential.street.push(current);
					}
				}

				delete potential.streets;	// No longer needed; we've moved them into street/street2.

				if (config.debug)
					console.log("For form " + idx + ", initial scan found these fields:", potential);
				

				// Don't save this form or its fields if not enough info was acquired for
				// a complete address...
				// TODO: What about SLAP?
				if (potential.street.length == 0
					&& (potential.zipcode.length == 0 || (potential.state.length == 0 && potential.city.length == 0)))
				{
					if (config.debug)
						console.log("Form " + idx + " is finished, but no complete addresses were found in it.");
					return true; // go to the next form (we're in $.each)
				}


				// Now organize the mapped fields into addresses

				// The number of addresses will be the number of street1 fields,
				// and in case we support it in the future, maybe street2, or
				// in case a mapping went a little awry.
				var addressCount = Math.max(potential.street.length, potential.street2.length);

				for (var i = 0; i < addressCount; i++)
				{
					var addrObj = {};
					for (var field in potential)
					{	
						var current = potential[field][i];
						if (current)
							addrObj[field] = current;
					}
					form.addresses.push(new Address(addrObj, form));
				}


				// Save the form we just finished mapping
				forms.push(form);

				if (config.debug)
					console.log("Form " + idx + " is finished:", form);
			});
		
			postMappingOperations();
			
			trigger("FieldsMapped");
		};

		this.mapFields = function(map, selector)
		{
			// "map" should be an array of objects mapping field types
			// to a field by a selector, all supplied by the user.
			// "selector" should be a selector in which fields will be mapped.

			if (config.debug)
				console.log("Manually mapping fields given this data:", map);

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
			// Given an address, disables the input fields for the address
			var fields = address.getDomFields();
			for (var prop in fields)
			{
				// TODO: Use .prop(), but that was added in jQuery 1.6...
				$(fields[prop]).attr('disabled', 'disabled');
			}
		};

		this.enableFields = function(address)
		{
			// Given an address, re-enables the input fields for the address
			var fields = address.getDomFields();
			for (var prop in fields)
			{
				// TODO: Use .prop(), but that was added in jQuery 1.6...
				$(fields[prop]).removeAttr('disabled');
			}
		};

		this.showLoader = function(addr)
		{
			$('.smarty-dots.smarty-addr-'+addr.id()).css('visibility', 'visible');
		};

		this.hideLoader = function(addr)
		{
			$('.smarty-dots.smarty-addr-'+addr.id()).css('visibility', 'hidden');
		};

		this.showValid = function(addr)
		{
			$(addr.lastField).nextAll('.smarty-address-verified').first().show(defaults.speed);
		};

		this.hideValid = function(addr)
		{
			$('.smarty-address-verified.smarty-addr-'+addr.id()).hide(defaults.speed, function()
			{
				$('.smarty-undo', this).show();
			});
		};


		this.showAmbiguous = function(data)
		{
			var addr = data.address;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 380); 	// minimum width
			corners.height = Math.max(corners.height, response.length * 48 + 145);	// minimum height

			var html = '<div class="smarty-address-ambiguous smarty-addr-'+addr.id()+'" style="position: absolute; '
				+ 'top: '+corners.top+'px; left: '+corners.left+'px; width: '+corners.width+'px; height: '+corners.height+'px;">'
				+ '<a href="javascript:" class="smarty-abort">x</a>'
				+ '<div class="smarty-ambiguous-message">Please choose the most correct address.</div>';

			for (var i = 0; i < response.length; i++)
			{
				var line1 = response.raw[i].delivery_line_1, city = response.raw[i].components.city_name,
					st = response.raw[i].components.state_abbreviation,
					zip = response.raw[i].components.zipcode + "-" + response.raw[i].components.plus4_code;

				html += '<a href="javascript:" class="smarty-choice smarty-good-addr" data-index="'+i+'"><b>'+line1+'</b> &nbsp;'+city+', '+st+' '+zip+'</a>';
			}
			
			html += '<a href="javascript:" class="smarty-choice smarty-choiceabort">None of these; I\'ll type another address</a>';
			html += '<a href="javascript:" class="smarty-choice smarty-useoriginal">None of these; use the address I typed<br>('+addr.toString()+')</a></div>';
			
			$(html).hide().appendTo('body').slideDown(defaults.speed);
			//$('body *').not('.smarty-address-ambiguous, .smarty-address-ambiguous *').css('opacity', '.8'); NOTE: Looks bad on dark sites, also needs code to revert when done
			
			// Scroll to it if needed
			if ($(document).scrollTop() > corners.top - 100
				|| $(document).scrollTop() < corners.top - $(window).height() + 100)
			{
				$('html, body').stop().animate({
					scrollTop: $('.smarty-address-ambiguous').offset().top - 100
				}, 500);
			}

			$('body').delegate('.smarty-address-ambiguous.smarty-addr-'+addr.id()+' .smarty-good-addr', 'click', data, function(e)
			{
				// User chose a candidate address
				$('.smarty-addr-'+addr.id()+'.smarty-address-ambiguous').slideUp(defaults.speed, function()
				{
					$(this).remove();
				});
				
				trigger("UsedSuggestedAddress", {
					address: e.data.address,
					response: e.data.response,
					invocation: e.data.invocation,
					chosenCandidate: response.raw[$(this).data('index')]
				});
			});

			$('body').delegate('.smarty-address-ambiguous .smarty-useoriginal', 'click', data, function(e)
			{
				// User wants to revert to what they typed
				$('.smarty-addr-'+addr.id()+'.smarty-address-ambiguous').slideUp(defaults.speed, function()
				{
					$(this).remove();
				});

				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function(e)
			{
				if (e.keyCode == 27) //Esc
					userAborted('.smarty-addr-'+e.data.address.id()+'.smarty-address-ambiguous', e);
			});

			// User clicks "x" in corner (same effect as Esc key)
			$('.smarty-address-ambiguous.smarty-addr-'+addr.id()+' .smarty-abort, .smarty-address-ambiguous.smarty-addr-'+addr.id()+' .smarty-choiceabort').click(data, function(e)
			{
					userAborted($(this).parents('.smarty-address-ambiguous')[0], e);
			});
		};


		this.showInvalid = function(data)
		{
			var addr = data.address;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 350); 	// minimum width
			corners.height = Math.max(corners.height, 175);	// minimum height

			var html = '<div class="smarty-address-invalid smarty-addr-'+addr.id()+'" style="position: absolute; '
				+ 'top: '+corners.top+'px; left: '+corners.left+'px; width: '+corners.width+'px; height: '+corners.height+'px;">'
				+ '<a href="javascript:" class="smarty-abort">x</a>'
				+ '<div class="smarty-invalid-message">Address could not be verified.</div>'
				+ '<a href="javascript:" class="smarty-choice smarty-invalid-rejectoriginal"><b>&rsaquo; I will double-check the address</b></a>'
				+ '<a href="javascript:" class="smarty-choice smarty-useoriginal">&rsaquo; I certify what I typed is correct ('+addr.toString()+')</a></div>';

			$(html).hide().appendTo('body').slideDown(defaults.speed);
			//$('body *').not('.smarty-address-invalid, .smarty-address-invalid *').css('opacity', '.8'); NOTE: Looks bad on dark sites, also needs code to revert when done

			// Scroll to it if necessary
			if ($(document).scrollTop() > corners.top - 100
				|| $(document).scrollTop() < corners.top - $(window).height() + 100)
			{
				$('html, body').stop().animate({
					scrollTop: $('.smarty-address-invalid').offset().top - 100
				}, 500);
			}

			$('body').delegate('.smarty-address-invalid .smarty-invalid-rejectoriginal', 'click', data, function(e)
			{
				// User rejects original input and agrees to double-check it
				$('.smarty-addr-'+addr.id()+'.smarty-address-invalid').slideUp(defaults.speed, function()
				{
					$(this).remove();
				});

				trigger("InvalidAddressRejected", e.data);
			});

			$('body').delegate('.smarty-address-invalid .smarty-useoriginal', 'click', data, function(e)
			{
				// User certifies that what they typed is correct
				$('.smarty-addr-'+addr.id()+'.smarty-address-invalid').slideUp(defaults.speed, function()
				{
					$(this).remove();
				});

				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function(e)
			{
				if (e.keyCode == 27) //Esc
					userAborted('.smarty-addr-'+e.data.address.id()+'.smarty-address-invalid', e);
			});

			// User clicks "x" in corner (same effect as Esc key)
			$('.smarty-address-invalid.smarty-addr-'+addr.id()+' .smarty-abort').click(data, function(e)
			{
					userAborted($(this).parents('.smarty-address-invalid')[0], e);
			});
		};
	}








	/*
		Represents an address inputted by the user,
		whether it has been verified yet or not.
	*/
	function Address(domMap, formObj)
	{
		// PRIVATE MEMBERS //

		var self = this;								// Pointer to self so that internal functions can reference its parent
		var fields = {};								// Data values and references to DOM elements
		var id = randomInt(1, 99999);					// An ID by which to classify this address on the DOM
		var addrCssClassPrefix = "smarty-field-";		// Related to the CSS class info in the UI object below (TODO: NOT USED??? Do a search...)
		var cssClass = addrCssClassPrefix + id;			// CSS class used to group fields in this address on the DOM
		var state = "unchanged"; 						// Can be: unchanged, changed, accepted -- TODO: Consolidate to accepted, changed?
		var acceptableFields = ["street", "street2", "secondary",
								"city", "state", "zipcode", "lastline",
								"addressee", "urbanization"];
		// Example of a field:  street: { value: "123 main", dom: DOMElement, undo: "123 mai" }
		// Some of the above fields will only be mapped manually, not automatically.


		// Constructor-esque functionality (save the fields in this address object)
		if (typeof domMap === 'object')
		{

			// Find the last field likely to appear on the DOM
			this.lastField = domMap.country || domMap.zipcode  || domMap.state || domMap.city || domMap.street;

			for (var prop in domMap)
			{
				if (!arrayContains(acceptableFields, prop))
					continue;

				var elem = $(domMap[prop]).addClass(cssClass);
				var val = elem.val();

				if (config.debug)
				{
					elem.css('background', '#FFFFCC');
					elem.attr('placeholder', prop);
				}

				fields[prop] = {};
				fields[prop].dom = domMap[prop];
				fields[prop].value = val;
				fields[prop].undo = val;


				// This has to be passed in at bind-time; they cannot be obtained at run-time
				var data = {
					address: this,
					field: prop,
					value: val
				};
				
				// Bind the DOM element to needed events, passing in the data above
				$(domMap[prop]).change(data, function(e)
				{
					e.data.address.set(e.data.field, e.target.value, false, e);
				});
			}
		}
		
		// Internal method that actually changes the address
		// The keepState parameter is used by the results of verification
		// after an address is chosen; otherwise an infinite loop of requests
		// is executed because the address keeps changing!	
		var doSet = function(key, value, updateDomElement, sourceEvent, keepState)
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

			if (differentVal && !keepState)
			{
				state = "changed";
				ui.hideValid(self);
			}
			
			var eventMeta = {
				sourceEvent: sourceEvent,	// may be undefined
				field: key,
				address: self,
				value: value
			};
			
			if (differentVal && state != "accepted")
				trigger("AddressChanged", eventMeta);

			return true;
		};




		// PUBLIC MEMBERS //

		this.form = formObj;	// Reference to the parent form object
		this.verifyCount = 0;	// Number of times this address was submitted for verification
		this.lastField;			// The last field found (last to appear in the DOM) during mapping, or the order given

		this.set = function(key, value, updateDomElement, sourceEvent, keepState)
		{
			if (typeof key === 'string' && arguments.length >= 2)
				return doSet(key, value, updateDomElement, sourceEvent, keepState);
			else if (typeof key === 'object')
			{
				var successful = true;
				for (var prop in key)
					successful = doSet(prop, key[prop], updateDomElement, sourceEvent, keepState) ? successful : false;
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

			if (this.isFreeform())
			{
				var singleLineAddr = (resp.addressee ? resp.addressee + " " : "") +
					(resp.delivery_line_1 ? resp.delivery_line_1 + " " : "") +
					(resp.delivery_line_2 ? resp.delivery_line_2 + " " : "") +
					(resp.components.urbanization ? resp.components.urbanization + " " : "") +
					(resp.last_line ? resp.last_line : "");

				this.set("street", singleLineAddr, updateDomElement, e, true);
			}
			else
			{
				if (resp.addressee)
					this.set("addressee", resp.addressee, updateDomElement, e, true);
				if (resp.delivery_line_1)
					this.set("street", resp.delivery_line_1, updateDomElement, e, true);
				this.set("street2", resp.delivery_line_2 || "", updateDomElement, e, true);	// Rarely used; must otherwise be blank.
				this.set("secondary", "", updateDomElement, e, true);	// Not used in standardized addresses
				if (resp.components.urbanization)
					this.set("urbanization", resp.components.urbanization, updateDomElement, e, true);
				if (resp.components.city_name)
					this.set("city", resp.components.city_name, updateDomElement, e, true);
				if (resp.components.state_abbreviation)
					this.set("state", resp.components.state_abbreviation, updateDomElement, e, true);
				if (resp.components.zipcode && resp.components.plus4_code)
					this.set("zipcode", resp.components.zipcode + "-" + resp.components.plus4_code, updateDomElement, e, true);
			}
		};

		this.lowestCommonAncestor = function()
		{
			// TODO: Needed anymore?

			// Find the containing element of this address in the DOM which is
			// the lowest common ancestor of all the address fields.

			var items = [], total, lca;
			for (var key in fields)
				if (fields[key].dom)
					items.push(fields[key].dom);
			total = items.length;

			if (!items.length || !cssClass)
				return null;

			var validParents = 'form, td, div, span, li, section, article, p, header, nav, form, fieldset';
			$(items[0]).parents(validParents).each(function()
			{
				if ($(this).find("." + cssClass).length == total)
				{
					lca = this;
					return false;
				}
			});

			return lca;
		};

		this.corners = function()
		{
			var corners = {};

			for (var prop in fields)
			{
				if (!fields[prop].dom)
					continue;

				var dom = fields[prop].dom;
				var offset = $(dom).offset();
				offset.right = offset.left + $(dom).width();
				offset.bottom = offset.top + $(dom).height();

				corners.top = !corners.top ? offset.top : Math.min(corners.top, offset.top);
				corners.left = !corners.left ? offset.left : Math.min(corners.left, offset.left);
				corners.right = !corners.right ? offset.right : Math.max(corners.right, offset.right);
				corners.bottom = !corners.bottom ? offset.bottom : Math.max(corners.bottom, offset.bottom);
			}

			corners.width = corners.right - corners.left;
			corners.height = corners.bottom - corners.top;

			return corners;
		};

		this.verify = function(invocation)
		{
			// Invoke contains the method to perform on invokeOn once we're all done (may be undefined)
			if (!invocation && !self.enoughInput())
				return null;

			ui.disableFields(self);
			self.verifyCount ++;
			var addrData = self.toRequest();

			$.ajax(
			{
				url: defaults.requestUrl+"?auth-token="+config.key+"&callback=?",
				dataType: "jsonp",
				data: addrData,
				timeout: config.timeout//,	NOTE: Cannot add custom headers to JSONP requests
				//headers: { "x-standardize-only": config.standardizeOnly ? "true": "false" }
			})
			.done(function(response, statusText, xhr)
			{
				trigger("ResponseReceived", { address: self, response: new Response(response), invocation: invocation });
				//delete self.form.processing;	// Tell the potentially duplicate event handlers that we're done.
				//console.log("Success!", Response, statusText, xhr);
			})
			.fail(function(xhr, statusText)
			{
				trigger("RequestTimedOut", { address: self, status: statusText, invocation: invocation });
				self.verifyCount --; 			// Address verification didn't actually work
				//delete self.form.processing;	// Tell the potentially duplicate event handlers (from postMappingOperations) that we're done.
			});
			/* 
				This next one acts like a "complete" callback, no matter failed or successful.
				Added in jQuery 1.6, but we're trying to stay compatible with jQuery 1.5...
				
				.always(function(response, statusText, xhr)
				{
					console.log("Complete", response, statusText, xhr);
				});
			*/


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
				keyval[key] = fields[key].value;
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

		// Based on the properties in "fields," determines if this is a single-line address
		this.isFreeform = function()
		{
			return fields.street && !fields.street2 && !fields.secondary
					&& !fields.addressee && !fields.city && !fields.state
					&& !fields.zipcode && !fields.urbanization && !fields.lastline;
		}

		this.mark = function(status)
		{
			if (status != "changed" &&
				status != "unchanged" &&
				status != "accepted")
				return false;
			state = status;
			return true;
		};
		
		this.get = function(key)
		{
			return fields[key] ? fields[key].value : null
		};

		this.undo = function(updateDomElement)
		{
			updateDomElement = typeof updateDomElement === 'undefined' ? true : updateDomElement;

			for (var key in fields)
			{
				this.set(key, fields[key].undo);
				if (updateDomElement && fields[key].dom)
					fields[key].dom.value = fields[key].value;
			}
		};

		this.accept = function(replacement, updateDomElement, event, data)
		{
			self.mark("accepted");
			if (replacement)		// This could be undefined if the user is using their original input
				self.replaceWith(replacement, updateDomElement, event);
			ui.enableFields(self);
			if (replacement)		// Again, if user chooses original input, the address wasn't "verified"
				ui.showValid(self);

			trigger("AddressAccepted", data);
		};

		this.getUndoValue = function(key)
		{
			return fields[key].undo;
		};

		this.status = function()
		{
			return state;
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

		this.id = function()
		{
			return id;
		};
	}





	




	/*
		Represents a <form> tag which must house mapped
		fields.
	*/
	function Form(domElement)
	{
		var triedSubmit = false;

		this.addresses = [];
		this.dom = domElement;

		this.triedSubmit = function()
		{
			return triedSubmit;
		}

		this.allAddressesAccepted = function(orUnchanged)
		{
			for (var i = 0; i < this.addresses.length; i++)
			{
				var addr = this.addresses[i];
				if (addr.status() != "accepted" && (!orUnchanged || (orUnchanged && addr.status() != "unchanged")))
					return false;
			}
			return true;
		};

		this.addressesNotAccepted = function(andNotUnchanged)
		{
			var addrs = [];

			for (var i = 0; i < this.addresses.length; i++)
			{
				var addr = this.addresses[i];
				if (addr.status() != "accepted" && (!andNotUnchanged || (andNotUnchanged && addr.status() != "unchanged")))
					addrs.push(addr);
			}

			return addrs;
		};
	}




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

		this.isMissingSecondary = function(idx)
		{
			idx = maybeDefault(idx);
			checkBounds(idx);
			return this.raw[idx].analysis.dpv_footnotes.indexOf("N1") > -1;
		};
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
			
			if (config.autoVerify && data.address.enoughInput() && (data.address.verifyCount == 0 || data.address.isFreeform()))
				trigger("VerificationInvoked", { address: data.address });
		},

		VerificationInvoked: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "VerificationInvoked", "(Verification invoked)", event, data);

			data.address.form.processing = true;
			data.address.verify(data.invocation);
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
			
			if (data.response.isInvalid())
			{
				trigger("AddressWasInvalid", data);
			}
			else if (data.response.isValid())
			{
				trigger("AddressWasValid", data);
			}
			else
			{
				trigger("AddressWasAmbiguous", data);
			}
		},

		RequestTimedOut: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "RequestTimedOut", "(Request timed out)", event, data);

			delete data.address.form.processing;	// Tell the potentially duplicate event handlers that we're done.

			// If this was a form submit, don't let a network failure hold back the user. Invoke the submit event.
			if (data.invocation)
			{
				data.address.accept(undefined, false, event, data);
				data.invocation.element[data.invocation.event]();
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

			addr.accept(resp.raw[0], true, event, data);
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

			data.address.accept(undefined, false, event, data);
		},

		UsedSuggestedAddress: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "UsedSuggestedAddress", "(User chose to a suggested address)", event, data);

			data.address.accept(data.chosenCandidate, true, event, data);
		},

		InvalidAddressRejected: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "InvalidAddressRejected", "(User chose to correct an invalid address)", event, data);

			delete data.address.form.processing;	// Tell the potentially duplicate event handlers that we're done.
			trigger("Completed", data);
		},

		AddressAccepted: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "AddressAccepted", "(Address marked accepted)", event, data);

			delete data.address.form.processing;	// Tell the potentially duplicate event handlers that we're done.

			// If this was the result of a form submit somehow, re-submit the form
			if (data.invocation)
				data.invocation.element[data.invocation.event]();
		},

		Completed: function(event, data)
		{
			if (config.debug)
				console.log("EVENT:", "Completed", "(All done)", event, data);

			ui.enableFields(data.address);
			delete data.address.form.processing;	// Tell the potentially duplicate event handlers that we're done.
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