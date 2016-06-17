/**
 LiveAddress International API jQuery Plugin
 by SmartyStreets - smartystreets.com

 (c) 2016 SmartyStreets

 LICENSED UNDER THE GNU GENERAL PUBLIC LICENSE VERSION 3
 (http://opensource.org/licenses/gpl-3.0.html)

 Documentation:      http://smartystreets.com/kb/liveaddress-api/website-forms
 Version:        (See variable below for version)
 Minified:        (See documentation or GitHub repository for minified script file)
 Latest stable version:  (See documentation)
 Bleeding-edge release:  https://github.com/smartystreets/jquery.liveaddress

 Feel free to contribute to this project on GitHub by
 submitting pull requests and reporting issues.
 **/


;(function(factory) { // eslint-disable-line no-extra-semi
     'use strict';
     if (typeof define === 'function' && define.amd) {
         // AMD
         define(['jquery'], factory);
     } else if (typeof module !== 'undefined' && module.exports) {
         // CommonJS
         module.exports = factory(require('jquery'));
     } else {
         // Global
         factory(jQuery);
     }
 })(function ($, window, document) {
	"use strict"; //  http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/

	/*
	 *	PRIVATE MEMBERS
	 */

	var instance; // Contains public-facing functions and variables
	var ui = new UI; // Internal use only, for UI-related tasks
	var version = "3.1.3"; // Version of this copy of the script

	var defaults = {
		candidates: 3, // Number of suggestions to show if ambiguous
		autocomplete: 10, // Number of autocomplete suggestions; set to 0 or false to disable
		requestUrlInternational: "https://international-street.api.smartystreets.com/verify", // International API endpoint
		requestUrlUS: "https://api.smartystreets.com/street-address", // US API endpoint
		timeout: 5000, // How long to wait before the request times out (5000 = 5 seconds)
		speed: "medium", // Animation speed
		ambiguousMessage: "Matched multiple addresses.<br>Which address did you mean?", // Message when address is ambiguous
		invalidMessage: "You entered an unknown address", // Message when address is invalid
		invalidCountryMessage: "Unknown country", // Message when the country is invalid
		missingSecondaryMessage: "Did you forget your apt/suite number?", // Message when address is missing a secondary number
		certifyMessage: "Use it the way I typed it.",
		missingInputMessage: "You didn't enter enough information<br>",
		changeMessage: "Take me back so I can try again.",
		fieldSelector: "input[type=text], input:not([type]), textarea, select", // Selector for possible address-related form elements
		submitSelector: "[type=submit], [type=image], [type=button]:last, button:last", // Selector to find a likely submit button or submit image (in a form)
		target: "US"
	};
	var config = {}; // Configuration settings as set by the user or just the defaults
	var forms = []; // List of forms (which hold lists of addresses)
	var defaultSelector = 'body'; // Default selector which should be over the whole page (must be compatible with the .find() function; not document)
	var mappedAddressCount = 0; // The number of currently-mapped addresses
	var acceptableFields = [
		"freeform", "address1", "address2", "address3", "address4", "organization", "locality", "administrative_area", "postal_code", "country"
	]; // API input field names

	/*
	 *	ENTRY POINT
	 */

	$.LiveAddress = function (arg) {
		return $(defaultSelector).LiveAddress(arg);
	};

	$.fn.LiveAddress = function (arg) {
		var matched = this,
			wasChained = matched.prevObject ? !!matched.prevObject.prevObject : false;

		// Make sure the jQuery version is compatible
		var vers = $.fn.jquery.split(".");
		if (vers.length >= 2) {
			if (vers[0] < 1 || (vers[0] == 1 && vers[1] < 5)) {
				console.log("jQuery version " + $.fn.jquery + " found, but LiveAddress requires jQuery version 1.5 or higher. Aborting.");
				return false;
			}
		} else
			return false;

		if (arg.debug)
			console.log("LiveAddress API jQuery Plugin version " + version + " (Debug mode)");

		// Mapping fields requires that the document be fully loaded in order to attach UI elements
		if (document.readyState === "complete")
			window.loaded = true;
		else
			$(window).load(function () {
				window.loaded = true;
			});

		// Determine if user passed in an API key or a settings/config object
		if (typeof arg === 'string') {
			// Use the default configuration
			config = {
				key: arg
			};
		} else if (typeof arg === 'object') {
			// Use the user's configuration on top of the default
			config = arg;
		}

		// Enforce some defaults
		config.candidates = config.candidates || defaults.candidates;
		config.ui = typeof config.ui === 'undefined' ? true : config.ui;
		config.autoVerify = config.autoVerify !== true && config.autoVerify !== false ? true : config.autoVerify;
		config.submitVerify = typeof config.submitVerify === 'undefined' ? true : config.submitVerify;
		config.timeout = config.timeout || defaults.timeout;
		config.ambiguousMessage = config.ambiguousMessage || defaults.ambiguousMessage;
		config.invalidMessage = config.invalidMessage || defaults.invalidMessage;
		config.invalidCountryMessage = config.invalidCountryMessage || defaults.invalidCountryMessage;
		config.missingSecondaryMessage = config.missingSecondaryMessage || defaults.missingSecondaryMessage;
		config.certifyMessage = config.certifyMessage || defaults.certifyMessage;
		config.missingInputMessage = config.missingInputMessage || defaults.missingInputMessage;
		config.changeMessage = config.changeMessage || defaults.changeMessage;
		config.fieldSelector = config.fieldSelector || defaults.fieldSelector;
		config.submitSelector = config.submitSelector || defaults.submitSelector;
		config.requestUrlInternational = config.requestUrlInternational || defaults.requestUrlInternational;
		config.requestUrlUS = config.requestUrlUS || defaults.requestUrlUS;
		config.autocomplete = typeof config.autocomplete === 'undefined' ? defaults.autocomplete : config.autocomplete;
		config.cityFilter = typeof config.cityFilter === 'undefined' ? "" : config.cityFilter;
		config.stateFilter = typeof config.stateFilter === 'undefined' ? "" : config.stateFilter;
		config.cityStatePreference = typeof config.cityStatePreference === 'undefined' ? "" : config.cityStatePreference;
		config.geolocate = typeof config.geolocate === 'undefined' ? true : config.geolocate;
		config.geolocatePrecision = typeof config.geolocatePrecision === 'undefined' ? 'city' : config.geolocatePrecision;
		config.waitForStreet = typeof config.waitForStreet === 'undefined' ? false : config.waitForStreet;
		config.verifySecondary = typeof config.verifySecondary === 'undefined' ? false : config.verifySecondary;
		config.geocode = typeof config.geocode === 'undefined' ? false : config.geocode;
		config.enforceVerification = typeof config.enforceVerification === 'undefined' ? false : config.enforceVerification;
		config.agent = typeof config.agent === 'undefined' ? "" : config.agent;

		config.candidates = config.candidates < 1 ? 0 : (config.candidates > 10 ? 10 : config.candidates);

		// Parameter used for internal uses. If set to true, freeform will fail. Use with caution
		config.xIncludeInvalid = typeof config.xIncludeInvalid === 'undefined' ? false : config.xIncludeInvalid;

		if (typeof config.autocomplete === 'number')
			config.autocomplete = config.autocomplete < 1 ? false : (config.autocomplete > 10 ? 10 : config.autocomplete);

		config.target = config.target || defaults.target;
		config.target = config.target.toUpperCase().replace(/\s+/g, "").split("|");

		/*
		 *	EXPOSED (PUBLIC) FUNCTIONS
		 */
		instance = {
			events: {
				FieldsMapped: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "FieldsMapped", "(Fields mapped to their respective addresses)", event, data);

					// We wait until the window is all loaded in case some elements are still loading
					window.loaded ? ui.postMappingOperations() : $(window).load(ui.postMappingOperations);
				},

				MapInitialized: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "MapInitialized", "(Mapped fields have been wired up to the window" +
							(config.ui ? ", document, and UI" : " and document") + ")", event, data);
				},

				AutocompleteInvoked: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AutocompleteInvoked",
							"(A request is about to be sent to the autocomplete service)", event, data);
					ui.requestAutocomplete(event, data);
				},

				AutocompleteReceived: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AutocompleteReceived",
							"(A response has just been received from the autocomplete service)", event, data);
					ui.showAutocomplete(event, data);
				},

				AutocompleteUsed: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AutocompleteUsed",
							"(A suggested address was used from the autocomplete service)", event, data);
				},

				AddressChanged: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AddressChanged", "(Address changed)", event, data);

					// If autoVerify is on, AND there's enough input in the address,
					// AND it hasn't been verified automatically before -OR- it's a freeform address,
					// AND autoVerification isn't suppressed (from an Undo click, even on a freeform address)
					// AND it has a DOM element (it's not just a programmatic Address object)
					// AND the address is "active" for verification
					// AND the autocomplete suggestions aren't visible
					// AND the form, if any, isn't already chewing on an address...
					// THEN verification has been invoked.
					if (config.autoVerify && data.address.enoughInput() && (data.address.verifyCount == 0 ||
						data.address.isFreeform() || data.address.usedAutocomplete) && !data.suppressAutoVerification && data.address.hasDomFields() &&
						data.address.active && !data.address.autocompleteVisible() &&
						(data.address.form && !data.address.form.processing))
						trigger("VerificationInvoked", {
							address: data.address
						});
					data.address.usedAutocomplete = false;
				},

				VerificationInvoked: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "VerificationInvoked", "(Address verification invoked)", event, data);

					// Abort now if an address in the same form is already being processed
					if (!data.address || (data.address && data.address.form && data.address.form.processing)) {
						if (config.debug)
							console.log("NOTICE: VerificationInvoked event handling aborted. Address is missing or an address in the " +
								"same form is already processing.");
						return;
					} else if (data.address.status() == "accepted" && !data.verifyAccepted) {
						if (config.debug)
							console.log("NOTICE: VerificationInvoked raised on an accepted or un-changed address. Nothing to do.");
						return trigger("Completed", data);
					} else if (data.address.form)
						data.address.form.processing = true;

					data.address.verify(data.invoke, data.invokeFn);
				},

				RequestSubmitted: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "RequestSubmitted", "(Request submitted to server)", event, data);

					ui.showLoader(data.address);
				},

				ResponseReceived: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "ResponseReceived",
							"(Response received from server, but has not been inspected)", event, data);

					ui.hideLoader(data.address);

					if (typeof data.invoke === "function")
						data.invoke(data.response); // User-defined callback function; we're all done here.

					if (data.response.isInvalid())
						trigger("AddressWasInvalid", data);
					else if (data.response.isAmbiguous())
						trigger("AddressWasAmbiguous", data);
					else if (config.verifySecondary && data.response.isMissingSecondary())
						trigger("AddressWasMissingSecondary", data);
					else if (data.response.isValid())
						trigger("AddressWasValid", data);
				},

				RequestTimedOut: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "RequestTimedOut", "(Request timed out)", event, data);

					if (data.address.form)
						delete data.address.form.processing; // Tell the potentially duplicate event handlers that we're done.

					// If this was a form submit, don't let a network failure hold them back; just accept it and move on
					if (data.invoke)
						data.address.accept(data, false);

					ui.enableFields(data.address);
					ui.hideLoader(data.address);
				},

				AddressWasValid: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AddressWasValid", "(Response indicates input address was valid)", event, data);

					var addr = data.address;
					var resp = data.response;

					data.response.chosen = resp.raw[0];
					addr.replaceWith(resp.raw[0], true, event);
					addr.accept(data);
				},

				AddressWasAmbiguous: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AddressWasAmbiguous", "(Response indiciates input address was ambiguous)", event, data);

					ui.showAmbiguous(data);
				},

				AddressWasInvalid: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AddressWasInvalid", "(Response indicates input address was invalid)", event, data);

					ui.showInvalid(data);
				},

				CountryWasInvalid: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "CountryWasInvalid", "(Pre-verification check indicates that the country was invalid)", event, data);
					ui.showInvalidCountry(data);
				},

				AddressWasMissingSecondary: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AddressWasMissingSecondary",
							"(Response indicates input address was missing secondary", event, data);

					ui.showMissingSecondary(data);
				},

				AddressWasMissingInput: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AddressWasMissingInput", "(Pre-verification check indicates that there was not enough input)", event, data);
					ui.showMissingInput(data);
				},

				OriginalInputSelected: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "OriginalInputSelected", "(User chose to use original input)", event, data);

					data.address.accept(data, false);
				},

				UsedSuggestedAddress: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "UsedSuggestedAddress", "(User chose to a suggested address)", event, data);

					data.response.chosen = data.chosenCandidate;
					data.address.replaceWith(data.chosenCandidate, true, event);
					data.address.accept(data);
				},

				InvalidAddressRejected: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "InvalidAddressRejected", "(User chose to correct an invalid address)", event, data);

					if (data.address.form)
						delete data.address.form.processing; // We're done with this address and ready for the next, potentially

					trigger("Completed", data);
				},

				AddressAccepted: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "AddressAccepted", "(Address marked accepted)", event, data);

					if (!data)
						data = {};

					if (data.address && data.address.form)
						delete data.address.form.processing; // We're done with this address and ready for the next, potentially

					// If this was the result of a form submit, re-submit the form (whether by clicking the button or raising form submit event)
					if (data.invoke && data.invokeFn)
						submitForm(data.invoke, data.invokeFn);

					trigger("Completed", data);
				},

				Completed: function (event, data) {
					if (config.debug)
						console.log("EVENT:", "Completed", "(All done)", event, data);

					if (data.address) {
						ui.enableFields(data.address);
						if (data.address.form)
							delete data.address.form.processing; // We're done with this address and ready for the next, potentially
					}
				}
			},
			on: function (eventType, userHandler) {
				if (!this.events[eventType] || typeof userHandler !== 'function')
					return false;

				var previousHandler = this.events[eventType];
				this.events[eventType] = function (event, data) {
					userHandler(event, data, previousHandler);
				};
			},
			mapFields: function (map) {
				var doMap = function (map) {
					if (typeof map === 'object')
						return ui.mapFields(map, matched);
					else if (!map && typeof config.addresses === 'object')
						return ui.mapFields(config.addresses, matched);
					else
						return false;
				};
				if ($.isReady)
					doMap(map);
				else
					$(function () {
						if (!wasChained)
							matched = $(matched.selector);
						doMap(map);
					});
			},
			makeAddress: function (addressData) {
				if (typeof addressData !== "object")
					return instance.getMappedAddressByID(addressData) || new Address({
							address1: addressData
						});
				else
					return new Address(addressData);
			},
			verify: function (input, callback) {
				var addr = instance.makeAddress(input); // Below means, force re-verify even if accepted/unchanged.
				trigger("VerificationInvoked", {
					address: addr,
					verifyAccepted: true,
					invoke: callback
				});
			},
			getMappedAddresses: function () {
				var addr = [];
				for (var i = 0; i < forms.length; i++)
					for (var j = 0; j < forms[i].addresses.length; j++)
						addr.push(forms[i].addresses[j]);
				return addr;
			},
			getMappedAddressByID: function (addressID) {
				for (var i = 0; i < forms.length; i++)
					for (var j = 0; j < forms[i].addresses.length; j++)
						if (forms[i].addresses[j].id() == addressID)
							return forms[i].addresses[j];
			},
			setKey: function (htmlkey) {
				config.key = htmlkey;
			},
			setCityFilter: function (cities) {
				config.cityFilter = cities;
			},
			setStateFilter: function (states) {
				config.stateFilter = states;
			},
			setCityStatePreference: function (pref) {
				config.cityStatePreference = pref;
			},
			activate: function (addressID) {
				var addr = instance.getMappedAddressByID(addressID);
				if (addr) {
					addr.active = true;
					ui.showSmartyUI(addressID);
				}
			},
			deactivate: function (addressID) {
				if (!addressID)
					return ui.clean();
				var addr = instance.getMappedAddressByID(addressID);
				if (addr) {
					addr.active = false;
					addr.verifyCount = 0;
					addr.unaccept();
					ui.hideSmartyUI(addressID);
				}
			},
			autoVerify: function (setting) {
				if (typeof setting === 'undefined')
					return config.autoVerify;
				else if (setting === false)
					config.autoVerify = false;
				else if (setting === true)
					config.autoVerify = true;
				for (var i = 0; i < forms.length; i++) {
					for (var j = 0; j < forms[i].addresses.length; j++) {
						forms[i].addresses[j].verifyCount = 0;
					}
				}
			},
			version: version
		};

		// Unbind old handlers then bind each handler to an event
		for (var prop in instance.events) {
			$(document).unbind(prop, HandleEvent);
			bind(prop);
		}

		// Map the fields
		if (config.target.indexOf("US") >= 0 || config.target.indexOf("INTERNATIONAL") >= 0) {
			instance.mapFields();
		} else if (config.debug) {
			console.log("Proper target not set in configuration. Please use 'US' or 'INTERNATIONAL'.");
		}

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
	function UI() {
		var submitHandler; // Function which is later bound to handle form submits
		var formDataProperty = "smarty-form"; // Indicates whether we've stored the form already
		var autocompleteResponse; // The latest response from the autocomplete server
		var autocplCounter = 0; // A counter so that only the most recent JSONP request is used
		var autocplRequests = []; // The array that holds autocomplete requests in order
		var loaderWidth = 24,
			loaderHeight = 8; // TODO: Update these if the image changes
		var uiCss = "<style>" + ".smarty-dots { display: none; position: absolute; z-index: 999; width: " +
			loaderWidth + "px; height: " + loaderHeight + "px; " +
			"background-image: url('data:image/gif;base64,R0lGODlhGAAIAOMAALSytOTi5MTCxPTy9Ly6vPz6/Ozq7MzKzLS2tOTm5PT29Ly+v" +
			"Pz+/MzOzP///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJBgAOACwAAAAAGAAIAAAEUtA5NZi8jNrr2FBScQAAYVyKQC6gZBDkUTRkXUhLDSw" +
			"hojc+XcAx0JEGjoRxCRgWjcjAkqZr5WoIiSJIaohIiATqimglg4KWwrDBDNiczgDpiAAAIfkECQYAFwAsAAAAABgACACEVFZUtLK05OLkxMbE9" +
			"PL0jI6MvL68bG5s7Ors1NbU/Pr8ZGJkvLq8zM7MXFpctLa05ObkzMrM9Pb0nJqcxMLE7O7s/P78////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
			"ABWDgZVWQcp2nJREWmhLSKRWOcySoRAWBEZ8IBi+imAAcxwXhZODxDCfFwxloLI6A7OBCoPKWEG/giqxRuOLKRSA2lpVM6kM2dTZmyBuK0Aw8f" +
			"hcQdQMxIwImLiMSLYkVPyEAIfkECQYAFwAsAAAAABgACACEBAIEpKak1NbU7O7svL68VFZU/Pr8JCIktLK05OLkzMrMDA4M9Pb0vLq87Ors9PL" +
			"0xMLEZGZk/P78tLa05ObkzM7MFBIU////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABWLgJVGCcZ2n9DASmq7nUwDAQaAPhCAEgzqNncIQodEWg" +
			"xNht7tdDBMmorIw0gKXh3T3uCSYgV3VitUiwrskZTspGpFKsJMRRVdkNBuKseT5Tg4TUQo+BgkCfygSDCwuIgN/IQAh+QQJBgAXACwAAAAAGAA" +
			"IAIRUVlS0srTk4uR8enz08vTExsRsbmzs6uyMjoz8+vzU1tRkYmS8urzMzsxcWly0trTk5uR8fnz09vTMyszs7uycmpz8/vz///8AAAAAAAAAA" +
			"AAAAAAAAAAAAAAAAAAAAAAFYOBlUVBynad1QBaaEtIpIY5jKOgxAM5w5IxAYJKo8HgLwmnnAAAGsodQ2FgcnYUL5Nh0QLTTqbXryB6cXcBPEBY" +
			"aybEL0wm9SNqFWfOWY0Z+JxBSAXkiFAImLiolLoZxIQAh+QQJBgAQACwAAAAAGAAIAIQEAgS0srTc2tz08vTMyszk5uT8+vw0MjS8ury0trTk4" +
			"uT09vTMzszs6uz8/vw0NjT///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFWiAELYMjno4gmCfkDItoEEG" +
			"ANKfwAMAjnA1EjWBg1I4G14HHO5gMiWOAEZUqIAIm86eQeo/XrBbA/RqlMceS6RxVa4xZLVHI7QCHn6hQRbAWDSwoKoIiLzEQIQAh+QQJBgAXA" +
			"CwAAAAAGAAIAIRUVlS0srTk4uR8enz08vTExsRsbmzs6uyMjoz8+vzU1tRkYmS8urzMzsxcWly0trTk5uR8fnz09vTMyszs7uycmpz8/vz///8" +
			"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFY+B1SYQlntYBmeeVQJSZTEHAHCcUOUCEiwqDw4GQNGrIhGgA4DkGIsIC0ARUHsia4AKpOiGXghewy" +
			"Gq5YwCu4Gw6jlnJ0gu9SKvWRKH2AIt0TQN+F0FNRSISMS0XKSuLCQKKIQAh+QQJBgAXACwAAAAAGAAIAIQEAgSkpqTU1tTs7uy8vrxUVlT8+vw" +
			"kIiS0srTk4uTMyswMDgz09vS8urzs6uz08vTEwsRkZmT8/vy0trTk5uTMzswUEhT///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFZOB1MY8kn" +
			"hJpnpchUKahIEjjnAxEE8xJHABA4VGhGQ0ighFBEA0swWBkYgxMEpfHkva4BKLBxRaBHdACCHT3C14U0VbkRWlsXgYLcERGJQxOD3Q8PkBCfyM" +
			"DKygMDIoiDAIJJiEAIfkECQYAFwAsAAAAABgACACEVFZUtLK05OLkxMbE9PL0jI6MvL68bG5s7Ors1NbU/Pr8ZGJkvLq8zM7MXFpctLa05Obkz" +
			"MrM9Pb0nJqcxMLE7O7s/P78////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABWPgdUmEJZ4WaZ6XAlWmEgUBg5wSRRvSmRwOR0HSoBkVIoMxYBA" +
			"RFgBHdPJYBgSXijVAuAykUsBii5VsK96oelFc9i5K40MkgYInigHtAcHFH28XP1EFXSMwLBcWFRIrJwoCiCEAOw=='); }" +
			".smarty-ui { position: absolute; z-index: 999; text-shadow: none; text-align: left; text-decoration: none; }" +
			".smarty-popup { border: 3px solid #4C4C4C; padding: 0; background: #F6F6F6; " +
			"box-shadow: 0px 10px 35px rgba(0, 0, 0, .8); }" + ".smarty-popup-header { background: #DDD; height: 12px; " +
			"text-transform: uppercase; font: bold 12px/1em 'Arial Black', sans-serif; padding: 12px; }" +
			".smarty-popup-ambiguous-header { color: #333; height: 20px; }" + ".smarty-popup-invalid-header { color: #CC0000; }" +
			".smarty-popup-missing-input-header { color: #CC0000; height: 58px; }" +
			".smarty-popup-close { color: #CC0000 !important; text-decoration: none !important; position: absolute; " +
			"right: 15px; top: 10px; display: block; padding: 4px 6px; text-transform: uppercase; }" +
			".smarty-popup-close:hover { color: #FFF !important; background: #CC0000; }" +
			".smarty-choice-list .smarty-choice { background: #FFF; padding: 10px 15px; color: #1A1A1A; }" +
			".smarty-choice { display: block; font: 300 14px/1.5em sans-serif; text-decoration: none !important; " +
			"border-top: 1px solid #CCC; }" + ".smarty-choice-list .smarty-choice:hover { color: #EEE !important; " +
			"background: #333; text-decoration: none !important; }" + ".smarty-choice-alt { border-top: 1px solid #4C4C4C; " +
			"background: #F6F6F6 !important; box-shadow: inset 0 4px 15px -5px rgba(0, 0, 0, .45); }" + ".smarty-choice-alt" +
			" .smarty-choice-abort, .smarty-choice-override { padding: 6px 15px; color: #B3B3B3 !important; " +
			"font-size: 12px; text-decoration: none !important; }" + ".smarty-choice-alt " +
			".smarty-choice:first-child { border-top: 0; }" + ".smarty-choice-abort:hover { color: #333 !important; }" +
			".smarty-choice-override:hover { color: #CC0000 !important; }" + ".smarty-tag { position: absolute; " +
			"display: block; overflow: hidden; font: 15px/1.2em sans-serif; text-decoration: none !important; width: 20px; " +
			"height: 18px; border-radius: 25px; transition: all .25s; -moz-transition: all .25s; " +
			"-webkit-transition: all .25s; -o-transition: all .25s; }" + ".smarty-tag:hover { width: 70px; " +
			"text-decoration: none !important; color: #999; }" + ".smarty-tag:hover .smarty-tag-text " +
			"{ color: #000 !important; }" + ".smarty-tag-grayed { border: 1px solid #B4B4B4 !important; " +
			"color: #999 !important; background: #DDD !important; box-shadow: inset 0 9px 15px #FFF; }" +
			".smarty-tag-green { border: 1px solid #407513 !important; color: #407513 !important; " +
			"background: #A6D187 !important; box-shadow: inset 0 9px 15px #E3F6D5; }" + ".smarty-tag-grayed:hover " +
			"{ border-color: #333 !important; }" + ".smarty-tag-check { padding-left: 4px; " +
			"text-decoration: none !important; }" + ".smarty-tag-text { font-size: 12px !important; position: absolute; " +
			"top: 0; left: 16px; width: 50px !important; text-align: center !important; }" + ".smarty-autocomplete " +
			"{ border: 1px solid #777; background: white; overflow: hidden; white-space: nowrap; " +
			"box-shadow: 1px 1px 3px #555; }" + ".smarty-suggestion { display: block; color: #444; " +
			"text-decoration: none !important; font-size: 12px; padding: 1px 5px; }" + ".smarty-active-suggestion " +
			"{ background: #EEE; color: #000; border: none; outline: none; }" + ".smarty-no-suggestions " +
			"{ padding: 1px 5px; font-size: 12px; color: #AAA; font-style: italic; }" + "</style>";

		this.postMappingOperations = function () {
			// Injects materials into the DOM, binds to form submit events, etc... very important.

			if (config.ui) {
				// Prepend CSS to head tag to allow cascading and give their style rules priority
				$('head').prepend(uiCss);

				// For each address on the page, inject the loader and "address verified" markup after the last element
				var addresses = instance.getMappedAddresses();
				for (var i = 0; i < addresses.length; i++) {
					var id = addresses[i].id();
					$('body').append('<div class="smarty-ui"><div title="Loading..." class="smarty-dots smarty-addr-' + id + '"></div></div>');
					var offset = uiTagOffset(addresses[i].corners(true));
					$('body').append('<div class="smarty-ui" style="top: ' + offset.top + 'px; left: ' + offset.left +
						'px;"><a href="javascript:" class="smarty-tag smarty-tag-grayed smarty-addr-' + id +
						'" title="Address not verified. Click to verify." data-addressid="' + id +
						'"><span class="smarty-tag-check">&#10003;</span><span class="smarty-tag-text">Verify</span></a></div>');

					// Move the UI elements around when browser window is resized
					$(window).resize({
						addr: addresses[i]
					}, function (e) {
						var addr = e.data.addr;
						var offset = uiTagOffset(addr.corners(true)); // Position of lil' tag
						$('.smarty-tag.smarty-addr-' + addr.id())
							.parent('.smarty-ui')
							.css('top', offset.top + 'px')
							.css('left', offset.left + 'px');

						var addrOffset = addr.corners(); // Position of any popup windows
						$('.smarty-popup.smarty-addr-' + addr.id())
							.parent('.smarty-ui')
							.css('top', addrOffset.top + 'px')
							.css('left', addrOffset.left + 'px');

						if (config.autocomplete) { // Position of autocomplete boxes
							var containerUi = $('.smarty-autocomplete.smarty-addr-' + addr.id()).closest('.smarty-ui');
							var domFields = addr.getDomFields();
							var mainInput = '';
							if (domFields['address1']) {
								mainInput = 'address1';
							} else if (domFields['freeform']) {
								mainInput = 'freeform';
							}
							if (mainInput !== '') {
								containerUi.css({
									"left": $(domFields[mainInput]).offset().left + "px",
									"top": ($(domFields[mainInput]).offset().top + $(domFields[mainInput]).outerHeight(false)) + "px"
								});
							}
						}
					});
				}

				$('body').delegate('.smarty-tag-grayed', 'click', function (e) {
					// "Verify" clicked -- manually invoke verification
					var addrId = $(this).data('addressid');
					instance.verify(addrId);
				});

				$('body').delegate('.smarty-undo', 'click', function (e) {
					// "Undo" clicked -- replace field values with previous input
					var addrId = $(this).parent().data('addressid');
					var addr = instance.getMappedAddressByID(addrId);
					addr.undo(true);
					// If fields are re-mapped after an address was verified, it loses its "accepted" status even if no values were changed.
					// Thus, in some rare occasions, the undo link and the "verified!" text may not disappear when the user clicks "Undo",
					// The undo functionality still works in those cases, but with no visible changes, the address doesn't fire "AddressChanged"...
				});

				// Prepare autocomplete UI
				if (config.autocomplete && config.key) {
					// For every mapped address, wire up autocomplete
					for (var i = 0; i < forms.length; i++) {
						var f = forms[i];

						for (var j = 0; j < f.addresses.length; j++) {
							var addr = f.addresses[j];
							var domFields = addr.getDomFields();
							var mainInput = '';
							if (domFields['address1']) {
								mainInput = 'address1';
							} else if (domFields['freeform']) {
								mainInput = 'freeform';
							}
							if (mainInput !== '') {
								var strField = $(domFields[mainInput]);
								var containerUi = $('<div class="smarty-ui"></div>');
								var autoUi = $('<div class="smarty-autocomplete"></div>');

								autoUi.addClass('smarty-addr-' + addr.id());
								containerUi.data("addrID", addr.id());
								containerUi.append(autoUi);

								containerUi.css({
									"position": "absolute",
									"left": strField.offset().left + "px",
									"top": (strField.offset().top + strField.outerHeight(false)) + "px"
								});

								containerUi.hide().appendTo("body");

								containerUi.delegate(".smarty-suggestion", "click", {
									addr: addr,
									containerUi: containerUi
								}, function (event) {
									var sugg = autocompleteResponse.suggestions[$(this).data('suggIndex')];
									useAutocompleteSuggestion(event.data.addr, sugg, event.data.containerUi);
								});

								containerUi.delegate(".smarty-suggestion", "mouseover", function () {
									$('.smarty-active-suggestion').removeClass('smarty-active-suggestion');
									$(this).addClass('smarty-active-suggestion');
								});

								containerUi.delegate(".smarty-active-suggestion", "mouseleave", function () {
									$(this).removeClass('smarty-active-suggestion');
								});
								strField.attr("autocomplete", "off"); // Tell Firefox to keep quiet

								strField.blur({
									containerUi: containerUi
								}, function (event) {
									setTimeout((function (event) {
										return function () {
											if (event.data) event.data.containerUi.hide();
										};
									})(event), 300); // This line is proudly IE9-compatible
								});

								strField.keydown({
									containerUi: containerUi,
									addr: addr
								}, function (event) {
									var suggContainer = $('.smarty-autocomplete', event.data.containerUi);
									var currentChoice = $('.smarty-active-suggestion:visible', suggContainer).first();
									var choiceSelectionIsNew = false;

									if (event.keyCode == 9) { // Tab key
										if (currentChoice.length > 0) {
											var domFields = event.data.addr.getDomFields();
											if (domFields['zipcode'])
												$(domFields['zipcode']).focus();
											else
												$(domFields[mainInput]).blur();
											useAutocompleteSuggestion(event.data.addr, autocompleteResponse.suggestions[currentChoice.data("suggIndex")], event.data.containerUi);
											return addr.isFreeform() ? true : suppress(event);
										} else
											event.data.containerUi.hide();
									} else if (event.keyCode == 40) { // Down arrow
										if (!currentChoice.hasClass('smarty-suggestion')) {
											currentChoice = $('.smarty-suggestion', suggContainer).first().mouseover();
											choiceSelectionIsNew = true;
										}

										if (!choiceSelectionIsNew) {
											if (currentChoice.next('.smarty-addr-' + event.data.addr.id() + ' .smarty-suggestion').length > 0)
												currentChoice.next('.smarty-suggestion').mouseover();
											else
												currentChoice.removeClass('smarty-active-suggestion');
										}

										moveCursorToEnd(this);
									} else if (event.keyCode == 38) { // Up arrow
										if (!currentChoice.hasClass('smarty-suggestion')) {
											currentChoice = $('.smarty-suggestion', suggContainer).last().mouseover();
											choiceSelectionIsNew = true;
										}

										if (!choiceSelectionIsNew) {
											if (currentChoice.prev('.smarty-addr-' + event.data.addr.id() + ' .smarty-suggestion').length > 0)
												currentChoice.prev('.smarty-suggestion').mouseover();
											else
												currentChoice.removeClass('smarty-active-suggestion');
										}

										moveCursorToEnd(this);
									}
								});

								// Flip the on switch!
								strField.keyup({
									form: f,
									addr: addr,
									streetField: strField,
									containerUi: containerUi
								}, doAutocomplete);
							}
						}

						$(document).keyup(function (event) {
							if (event.keyCode == 27) // Esc key
								$('.smarty-autocomplete').closest('.smarty-ui').hide();
						});
					}

					// Try .5 and 1.5 seconds after the DOM loads to re-position UI elements; hack for Firefox.
					setTimeout(function () {
						$(window).resize();
					}, 500);
					setTimeout(function () {
						$(window).resize();
					}, 1500);
				}

			}

			if (config.submitVerify) {
				// Bind to form submits through form submit and submit button click events
				for (var i = 0; i < forms.length; i++) {
					var f = forms[i];

					submitHandler = function (e) {
						// Don't invoke verification if it's already processing or autocomplete is open and the user was pressing Enter to use a suggestion
						if ((e.data.form && e.data.form.processing) || $('.smarty-active-suggestion:visible').length > 0)
							return suppress(e);

						/*
						 IMPORTANT!
						 Prior to version 2.4.8, the plugin would call syncWithDom() at submit-time
						 in case programmatic changes were made to the address input fields, including
						 browser auto-fills. The sync function would detect those changes and force
						 a re-verification to not let invalid addresses through. Unfortunately, this
						 frequently caused infinite loops (runaway lookups), ultimately preventing
						 form submission, which is unacceptable. As a safety measure to protect our
						 customer's subscriptions, we've removed syncWithDom(). The website owner is
						 responsible for making sure that any changes to address field values raise the
						 "change" event on that element. Example: $('#city').val('New City').change();
						 */

						if (!e.data.form.allActiveAddressesAccepted()) {
							// We could verify all the addresses at once, but that can overwhelm the user.
							// An API request is usually quick, so let's do one at a time: it's much cleaner.
							var unaccepted = e.data.form.activeAddressesNotAccepted();
							if (unaccepted.length > 0)
								trigger("VerificationInvoked", {
									address: unaccepted[0],
									invoke: e.data.invoke,
									invokeFn: e.data.invokeFn
								});
							return suppress(e);
						}
					};

					// Performs the tricky operation of uprooting existing event handlers that we have references to
					// (either by jQuery's data cache or HTML attributes) planting ours, then laying theirs on top
					var bindSubmitHandler = function (domElement, eventName) {
						if (!domElement || !eventName)
							return;

						var oldHandlers = [],
							eventsRef = $._data(domElement, 'events');

						// If there are previously-bound-event-handlers (from jQuery), get those.
						if (eventsRef && eventsRef[eventName] && eventsRef[eventName].length > 0) {
							// Get a reference to the old handlers previously bound by jQuery
							oldHandlers = $.extend(true, [], eventsRef[eventName]);
						}

						// Unbind them...
						$(domElement).unbind(eventName);

						// ... then bind ours first ...
						$(domElement)[eventName]({
							form: f,
							invoke: domElement,
							invokeFn: eventName
						}, submitHandler);

						// ... then bind theirs last:
						// First bind their onclick="..." or onsubmit="..." handles...
						if (typeof domElement['on' + eventName] === 'function') {
							var temp = domElement['on' + eventName];
							domElement['on' + eventName] = null;
							$(domElement)[eventName](temp);
						}

						// ... then finish up with their old jQuery handles.
						for (var j = 0; j < oldHandlers.length; j++)
							$(domElement)[eventName](oldHandlers[j].data, oldHandlers[j].handler);
					};

					// Take any existing handlers (bound via jQuery) and re-bind them for AFTER our handler(s).
					var formSubmitElements = $(config.submitSelector, f.dom);

					// Highlight the submit button
					if (config.debug) {
						for (var j = 0; j < formSubmitElements.length; j++) {
							formSubmitElements[j].style.color = '#4BA341';
						}
					}

					// Form submit() events are apparently invoked by CLICKING the submit button (even jQuery does this at its core for binding)
					// (but jQuery, when raising a form submit event with .submit() will NOT necessarily click the submit button)
					formSubmitElements.each(function (idx) {
						bindSubmitHandler(this, 'click'); // These get fired first
					});

				}
			}

			trigger("MapInitialized");
		};

		function doAutocomplete(event) {
			var addr = event.data.addr;
			var streetField = event.data.streetField;
			var input = $.trim(event.data.streetField.val());
			var containerUi = event.data.containerUi;
			var suggContainer = $('.smarty-autocomplete', containerUi);

			if (!input) {
				addr.lastStreetInput = input;
				suggContainer.empty();
				containerUi.hide();
			}

			if (event.keyCode == 13) { // Enter/return
				if ($('.smarty-active-suggestion:visible').length > 0)
					useAutocompleteSuggestion(addr, autocompleteResponse.suggestions[$('.smarty-active-suggestion:visible').first().data('suggIndex')], containerUi);
				containerUi.hide();
				streetField.blur();
				return suppress(event);
			}

			if (event.keyCode == 40) { // Down arrow
				moveCursorToEnd(streetField[0]);
				return;
			}

			if (event.keyCode == 38) { // Up arrow
				moveCursorToEnd(streetField[0]);
				return;
			}

			if (!input || input == addr.lastStreetInput || !addr.isDomestic())
				return;

			addr.lastStreetInput = input; // Used so that autocomplete only fires on real changes (i.e. not just whitespace)
			if (addr.isDomestic() && config.target.indexOf("US") >= 0) {
				trigger('AutocompleteInvoked', {
					containerUi: containerUi,
					suggContainer: suggContainer,
					streetField: streetField,
					input: input,
					addr: addr
				});
			}
		}

		this.requestAutocomplete = function (event, data) {
			if (data.input && data.addr.isDomestic() && autocompleteResponse)
				data.containerUi.show();

			var autocplrequest = {
				callback: function (counter, json) {
					var patt = new RegExp("^\\w+\\s\\w+|^[A-Za-z]+$|^[A-Za-z]+\\s\\w*");
					var filtering = patt.test(data.input);
					autocompleteResponse = json;
					data.suggContainer.empty();

					if (!json.suggestions || json.suggestions.length == 0) {
						data.suggContainer.html('<div class="smarty-no-suggestions">No suggestions</div>');
						return;
					}

					if (config.waitForStreet && filtering == false) {
						var message = "";
						if (config.stateFilter || config.cityFilter || config.geolocate || config.cityStatePreference) {
							message = "filtered";
						} else {
							message = "address";
						}
						data.suggContainer.html('<div class="smarty-no-suggestions">Type more for ' + message + ' suggestions</div>')
					} else {
						for (var j = 0; j < json.suggestions.length; j++) {
							var suggAddr = json.suggestions[j].text.replace(/<|>/g, "");
							suggAddr = suggAddr.replace(new RegExp('(' + data.input + ')', 'ig'), '<b>$1</b>');
							var link = $('<a href="javascript:" class="smarty-suggestion">' + suggAddr + '</a>');
							link.data("suggIndex", j);

							data.suggContainer.append(link);
						}
					}

					data.suggContainer.css({
						"width": Math.max(data.streetField.outerWidth(false), 250) + "px"
					});

					data.containerUi.show();

					// Delete all older callbacks so they don't get executed later because of latency
					autocplRequests.splice(0, counter);
				},
				number: autocplCounter++
			};

			autocplRequests[autocplrequest.number] = autocplrequest;

			$.getJSON("https://autocomplete-api.smartystreets.com/suggest?callback=?", {
				"auth-id": config.key,
				"auth-token": config.token,
				prefix: data.input,
				city_filter: config.cityFilter,
				state_filter: config.stateFilter,
				prefer: config.cityStatePreference,
				suggestions: config.autocomplete,
				geolocate: config.geolocate,
				geolocate_precision: config.geolocatePrecision,
				agent: "plugin:jquery@" + instance.version + "\|" + config.agent
			}, function (json) {
				trigger("AutocompleteReceived", $.extend(data, {
					json: json,
					autocplrequest: autocplrequest
				}));
			});
		};

		this.showAutocomplete = function (event, data) {
			if (autocplRequests[data.autocplrequest.number])
				autocplRequests[data.autocplrequest.number].callback(data.autocplrequest.number, data.json);
		};

		function useAutocompleteSuggestion(addr, suggestion, containerUi) {
			var domfields = addr.getDomFields();
			containerUi.hide(); // It's important that the suggestions are hidden before AddressChanged event fires

			if (addr.isFreeform())
				$(domfields['freeform']).val(suggestion.text).change();
			else {
				if (domfields['postal_code']) {
					$(domfields['postal_code']).val("").change();
				}
				if (domfields['address1'])
					$(domfields['address1']).val(suggestion.street_line).change();
				// State filled in before city so autoverify is not invoked without finishing using the suggestion
				if (domfields['administrative_area']) {
					if (domfields['administrative_area'].options) { // Checks for dropdown
						for (var i = 0; i < domfields['administrative_area'].options.length; i++) {
							// Checks for abbreviation match and maps full state name to abbreviation
							if (domfields['administrative_area'].options[i].text.toUpperCase() === suggestion.state || allStatesByName[domfields['administrative_area'].options[i].text.toUpperCase()] === suggestion.state) {
								$(domfields['administrative_area'])[0].selectedIndex = i;
								$(domfields['administrative_area']).change();
								break;
							}
						}
					} else {
						$(domfields['administrative_area']).val(suggestion.state).change();
					}
				}
				if (domfields['locality']) {
					$(domfields['locality']).val("").change();
					addr.usedAutocomplete = true;
					$(domfields['locality']).val(suggestion.city).change();
				}
			}
			if (domfields['country'] && !domfields['country'].options) {
				$(domfields['country']).val("USA").change();
			}
			trigger("AutocompleteUsed", {
				address: addr,
				suggestion: suggestion
			});
		}

		// Computes where the little checkmark tag of the UI goes, relative to the boundaries of the last field
		function uiTagOffset(corners) {
			return {
				top: corners.top + corners.height / 2 - 10,
				left: corners.right - 6
			};
		}

		// This function is used to find and properly map elements to their field type
		function filterDomElement(domElement, names, labels) {
			/*
			 Where we look to find a match, in this order:
			 name, id, <label> tags, placeholder, title
			 Our searches first conduct fairly liberal "contains" searches:
			 if the attribute even contains the name or label, we map it.
			 The names and labels we choose to find are very particular.
			 */

			var name = lowercase(domElement.name);
			var id = lowercase(domElement.id);
			var selectorSafeID = id.replace(/[\[|\]|\(|\)|\:|\'|\"|\=|\||\#|\.|\!|\||\@|\^|\&|\*]/g, '\\\\$&');
			var placeholder = lowercase(domElement.placeholder);
			var title = lowercase(domElement.title);

			// First look through name and id attributes of the element, the most common
			for (var i = 0; i < names.length; i++)
				if (name.indexOf(names[i]) > -1 || id.indexOf(names[i]) > -1)
					return true;

			// If we can't find it in name or id, look at labels associated to the element.
			// Webkit automatically associates labels with form elements for us. But for other
			// browsers, we have to find them manually, which this next block does.
			if (!('labels' in domElement)) {
				var lbl = $('label[for="' + selectorSafeID + '"]')[0] || $(domElement).parents('label')[0];
				domElement.labels = !lbl ? [] : [lbl];
			}

			// Iterate through the <label> tags now to search for a match.
			for (var i = 0; i < domElement.labels.length; i++) {
				// This inner loop compares each label value with what we're looking for
				for (var j = 0; j < labels.length; j++)
					if ($(domElement.labels[i]).text().toLowerCase().indexOf(labels[j]) > -1)
						return true;
			}

			// Still not found? Then look in "placeholder" or "title"...
			for (var i = 0; i < labels.length; i++)
				if (placeholder.indexOf(labels[i]) > -1 || title.indexOf(labels[i]) > -1)
					return true;

			// Got all the way to here? Probably not a match then.
			return false;
		}

		// User aborted the verification process (X click or esc keyup)
		function userAborted(uiPopup, e) {
			// Even though there may be more than one bound, and this disables the others,
			// this is for simplicity: and I figure, it won't happen too often.
			// (Otherwise "Completed" events are raised by pressing Esc even if nothing is happening)
			$(document).unbind('keyup');
			$(uiPopup).slideUp(defaults.speed, function () {
				$(this).parent('.smarty-ui').remove();
			});
			trigger("Completed", e.data);
		}

		// When we're done with a "pop-up" where the user chooses what to do,
		// we need to remove all other events bound on that whole "pop-up"
		// so that it doesn't interfere with any future "pop-ups".
		function undelegateAllClicks(selectors) {
			if (Array.isArray(selectors) || typeof selectors == "object") {
				for (var selector in selectors) {
					$('body').undelegate(selectors[selector], 'click');
				}
			} else if (typeof selectors === "string") {
				$('body').undelegate(selectors, 'click');
			} else {
				alert("ERROR: Not an array, string, or object passed in to undelegate all clicks");
			}
		}

		// Utility function
		function moveCursorToEnd(el) { // Courtesy of http://css-tricks.com/snippets/javascript/move-cursor-to-end-of-input/
			if (typeof el.selectionStart == "number")
				el.selectionStart = el.selectionEnd = el.value.length;
			else if (typeof el.createTextRange != "undefined") {
				el.focus();
				var range = el.createTextRange();
				range.collapse(false);
				range.select();
			}
		}

		//shows the SmartyUI when activating 1 address
		this.showSmartyUI = function (addressID) {
			var smartyui = $('.deactivated.smarty-addr-' + addressID);
			smartyui.push(smartyui[0].parentElement);
			smartyui.removeClass("deactivated");
			smartyui.addClass("activated");
			smartyui.show();
		};

		//hides the SmartyUI when deactivating 1 address
		this.hideSmartyUI = function (addressID) {
			var smartyui = $('.smarty-addr-' + addressID + ':visible');
			var autocompleteui = $('.smarty-autocomplete.smarty-addr-' + addressID);
			smartyui.addClass("deactivated");
			smartyui.parent().addClass("deactivated");
			autocompleteui.addClass("deactivated");
			smartyui.hide();
			smartyui.parent().hide();
			autocompleteui.hide();
		};

		// If anything was previously mapped, this resets it all for a new mapping.
		this.clean = function () {
			if (forms.length == 0)
				return;

			if (config.debug)
				console.log("Cleaning up old form map data and bindings...");

			// Spare none alive!

			for (var i = 0; i < forms.length; i++) {
				$(forms[i].dom).data(formDataProperty, '');

				// Clean up each form's DOM by resetting the address fields to the way they were
				for (var j = 0; j < forms[i].addresses.length; j++) {
					var doms = forms[i].addresses[j].getDomFields();
					for (var prop in doms) {
						if (config.debug) {
							$(doms[prop]).css('background', 'none').attr('placeholder', '');
							var submitButtons = $(config.submitSelector);
							for (var k = 0; k < submitButtons.length; k++) {
								submitButtons[k].style.color = 'black';
							}
						}
						$(doms[prop]).unbind('change');
					}
					if (doms['address1'])
						$(doms['address1']).unbind('keyup').unbind('keydown').unbind('blur');
					else if (doms['freeform'])
						$(doms['freeform']).unbind('keyup').unbind('keydown').unbind('blur');
				}

				// Unbind our form submit and submit-button click handlers
				$.each(forms, function (idx) {
					$(this.dom).unbind('submit', submitHandler);
				});
				$(config.submitSelector, forms[i].dom).each(function (idx) {
					$(this).unbind('click', submitHandler);
				});
			}

			$('.smarty-ui').undelegate('.smarty-suggestion', 'click').undelegate('.smarty-suggestion', 'mouseover').undelegate('.smarty-suggestion', 'mouseleave').remove();
			$('body').undelegate('.smarty-undo', 'click');
			$('body').undelegate('.smarty-tag-grayed', 'click');
			$(window).unbind('resize');
			$(document).unbind('keyup');

			forms = [];
			mappedAddressCount = 0;

			if (config.debug)
				console.log("Done cleaning up; ready for new mapping.");
		};

		function disableBrowserAutofill(dom) {
			//Does not disable autofill if config.autocomplete is disabled
			if (config.autocomplete > 0) {
				for (var i = 0; i < dom.getElementsByTagName("input").length; i++) {
					dom.getElementsByTagName("input")[i].autocomplete = "smartystreets";
				}
			}
		}

		function addDefaultToStateDropdown(dom) {
			if (dom.getElementsByTagName("option").length > 0) {
				if (arrayContains(stateNames, dom.getElementsByTagName("option")[0].text.toUpperCase()) ||
					arrayContains(stateAbbreviations, dom.getElementsByTagName("option")[0].text.toUpperCase())) {
					var option = document.createElement("OPTION");
					option.innerText = "Pick a state";
					option.selected = true;
					$(dom.getElementsByTagName("select")[0]).prepend(option);
					$(dom).change();
				}
			}
		}

		// ** MANUAL MAPPING ** //
		this.mapFields = function (map, context) {
			// "map" should be an array of objects mapping field types
			// to a field by selector, all supplied by the user.
			// "context" should be the set of elements in which fields will be mapped
			// Context can be acquired like: $('#something').not('#something-else').LiveAddress( ... ); ...

			if (config.debug)
				console.log("Manually mapping fields given this data:", map);

			this.clean();
			var formsFound = [];
			map = map instanceof Array ? map : [map];

			for (var addrIdx in map) {
				var address = map[addrIdx];

				if (!address.country && config.target.indexOf("US") < 0)
					continue;

				// Convert selectors into actual DOM references
				for (var fieldType in address) {
					if (fieldType != "id") {
						if (!arrayContains(acceptableFields, fieldType)) { // Make sure the field name is allowed
							if (config.debug)
								console.log("NOTICE: Field named " + fieldType + " is not allowed. Skipping...");
							delete address[fieldType];
							continue;
						}
						var matched = $(address[fieldType], context);
						if (matched.length == 0) { // Don't try to map an element that couldn't be matched or found at all
							if (config.debug)
								console.log("NOTICE: No matches found for selector " + address[fieldType] + ". Skipping...");
							delete address[fieldType];
						} else if (matched.parents('form').length == 0) { // We should only map elements inside a <form> tag; otherwise we can't bind to submit handlers later
							if (config.debug)
								console.log("NOTICE: Element with selector \"" + address[fieldType] + "\" is not inside a <form> tag. Skipping...");
							delete address[fieldType];
						} else
							address[fieldType] = matched[0];
					}
				}
				if (config.target.indexOf("INTERNATIONAL") >= 0) {
					if (!((address.country && address.freeform) || (address.country && address.address1 && address.postal_code) || (address.country && address.address1 && address.locality && address.administrative_area))) {
						if (config.debug)
							console.log("NOTICE: Address map (index " + addrIdx + ") was not mapped to a complete street address. Skipping...");
						continue;
					}
				} else {
					if (!((address.freeform) || (address.address1 && address.postal_code) || (address.address1 && address.locality && address.administrative_area))) {
						if (config.debug)
							console.log("NOTICE: Address map (index " + addrIdx + ") was not mapped to a complete street address. Skipping...");
						continue;
					}
				}

				// Acquire the form based on the first member
				var formDom = $(address.address1).parents('form')[0];
				if (!formDom) {
					formDom = $(address.freeform).parents('form')[0];
				}
				var form = new Form(formDom);

				// Persist a reference to the form if it wasn't acquired before
				if (!$(formDom).data(formDataProperty)) {
					// Mark the form as mapped then add it to our list
					$(formDom).data(formDataProperty, 1);
					disableBrowserAutofill(form.dom);
					addDefaultToStateDropdown(form.dom);
					formsFound.push(form);
				} else {
					// Find the form in our list since we already put it there
					for (var i = 0; i < formsFound.length; i++) {
						if (formsFound[i].dom == formDom) {
							form = formsFound[i];
							break;
						}
					}
				}

				// Add this address to the form
				mappedAddressCount++;
				form.addresses.push(new Address(address, form, address.id));

				if (config.debug)
					console.log("Finished mapping address with ID: " + form.addresses[form.addresses.length - 1].id());
			}

			forms = formsFound;
			trigger("FieldsMapped");
		};

		this.disableFields = function (address) {
			// Given an address, disables the input fields for the address, also the submit button
			if (!config.ui)
				return;

			var fields = address.getDomFields();
			for (var field in fields)
				$(fields[field]).prop ? $(fields[field]).prop('disabled', true) : $(fields[field]).attr('disabled', 'disabled');

			// Disable submit buttons
			if (address.form && address.form.dom) {
				var buttons = $(config.submitSelector, address.form.dom);
				buttons.prop ? buttons.prop('disabled', true) : buttons.attr('disabled', 'disabled');
			}
		};

		this.enableFields = function (address) {
			// Given an address, re-enables the input fields for the address
			if (!config.ui)
				return;

			var fields = address.getDomFields();
			for (var field in fields)
				$(fields[field]).prop ? $(fields[field]).prop('disabled', false) : $(fields[field]).removeAttr('disabled');

			// Enable submit buttons
			if (address.form && address.form.dom) {
				var buttons = $(config.submitSelector, address.form.dom);
				buttons.prop ? buttons.prop('disabled', false) : buttons.removeAttr('disabled');
			}
		};

		this.showLoader = function (addr) {
			if (!config.ui || !addr.hasDomFields())
				return;

			// Get position information now instead of earlier in case elements shifted since page load
			var lastFieldCorners = addr.corners(true);
			var loaderUI = $('.smarty-dots.smarty-addr-' + addr.id()).parent();

			loaderUI.css("top", (lastFieldCorners.top + lastFieldCorners.height / 2 - loaderHeight / 2) + "px")
				.css("left", (lastFieldCorners.right - loaderWidth - 10) + "px");
			$('.smarty-dots', loaderUI).show();
		};

		this.hideLoader = function (addr) {
			if (config.ui)
				$('.smarty-dots.smarty-addr-' + addr.id()).hide();
		};

		this.markAsValid = function (addr) {
			if (!config.ui || !addr)
				return;

			var domTag = $('.smarty-tag.smarty-tag-grayed.smarty-addr-' + addr.id());
			domTag.removeClass('smarty-tag-grayed').addClass('smarty-tag-green').attr("title", "Address verified! Click to undo.");
			$('.smarty-tag-text', domTag).text('Verified').hover(function () {
				$(this).text('Undo');
			}, function () {
				$(this).text('Verified');
			}).addClass('smarty-undo');
		};

		this.unmarkAsValid = function (addr) {
			var validSelector = '.smarty-tag.smarty-addr-' + addr.id();
			if (!config.ui || !addr || $(validSelector).length == 0)
				return;

			var domTag = $('.smarty-tag.smarty-tag-green.smarty-addr-' + addr.id());
			domTag.removeClass('smarty-tag-green').addClass('smarty-tag-grayed').attr("title", "Address not verified. Click to verify.");
			$('.smarty-tag-text', domTag).text('Verify').unbind('mouseenter mouseleave').removeClass('smarty-undo');
		};

		this.showAmbiguous = function (data) {
			if (!config.ui || !data.address.hasDomFields())
				return;

			var addr = data.address;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 300); // minimum width
			corners.height = Math.max(corners.height, response.length * 63 + 127); // minimum height
			if (config.enforceVerification) {
				corners.height -= 49;
			}

			var html = '<div class="smarty-ui" style="top: ' + corners.top + 'px; left: ' + corners.left + 'px; width: ' +
				corners.width + 'px; height: ' + corners.height + 'px;">' + '<div class="smarty-popup smarty-addr-' +
				addr.id() + '" style="width: ' + (corners.width - 6) + 'px; height: ' + (corners.height - 3) + 'px;">' +
				'<div class="smarty-popup-header smarty-popup-ambiguous-header">' + config.ambiguousMessage +
				'<a href="javascript:" class="smarty-popup-close smarty-abort" title="Cancel">x</a></div>' +
				'<div class="smarty-choice-list">';

			if (addr.isDomestic()) {
				for (var i = 0; i < response.raw.length; i++) {
					var line1 = response.raw[i].delivery_line_1,
						city = response.raw[i].components.city_name,
						st = response.raw[i].components.state_abbreviation,
						zip = response.raw[i].components.zipcode + "-" + response.raw[i].components.plus4_code;
					html += '<a href="javascript:" class="smarty-choice" data-index="' + i + '">' + line1 + '<br>' + city + ', ' + st + ' ' + zip + '</a>';
				}
			} else {
				var numCandidates = config.candidates;
				if (response.raw.length < numCandidates) {
					numCandidates = response.raw.length;
				}
				for (var i = 0; i < numCandidates; i++) {
					var ambigAddr = '';
					if (response.raw[i].address1) {
						ambigAddr += response.raw[i].address1;
					}
					if (response.raw[i].address2) {
						ambigAddr = ambigAddr + '<br>' + response.raw[i].address2;
					}
					if (response.raw[i].address3) {
						ambigAddr = ambigAddr + '<br>' + response.raw[i].address3;
					}
					if (response.raw[i].address4) {
						ambigAddr = ambigAddr + '<br>' + response.raw[i].address4;
					}
					if (response.raw[i].address5) {
						ambigAddr = ambigAddr + '<br>' + response.raw[i].address5;
					}
					if (response.raw[i].address6) {
						ambigAddr = ambigAddr + '<br>' + response.raw[i].address6;
					}
					html += '<a href="javascript:" class="smarty-choice" data-index="' + i + '">' + ambigAddr + '</a>';
				}
			}

			html += '</div><div class="smarty-choice-alt">';
			html += '<a href="javascript:" class="smarty-choice smarty-choice-abort smarty-abort">' + config.changeMessage + '</a>';
			if (!config.enforceVerification) {
				html += '<a href="javascript:" class="smarty-choice smarty-choice-override">' + config.certifyMessage + '<br>(' +
					addr.toString() + ')</a>';
			}
			html += '</div></div></div>';
			$(html).hide().appendTo('body').show(defaults.speed);

			// Scroll to it if needed
			if ($(document).scrollTop() > corners.top - 100 || $(document).scrollTop() < corners.top - $(window).height() + 100) {
				$('html, body').stop().animate({
					scrollTop: $('.smarty-popup.smarty-addr-' + addr.id()).offset().top - 100
				}, 500);
			}

			data.selectors = {
				goodAddr: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-choice-list .smarty-choice',
				useOriginal: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-choice-override',
				abort: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-abort'
			};

			// User chose a candidate address
			$('body').delegate(data.selectors.goodAddr, 'click', data, function (e) {
				$('.smarty-popup.smarty-addr-' + addr.id()).slideUp(defaults.speed, function () {
					$(this).parent('.smarty-ui').remove();
					$(this).remove();
				});

				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;

				trigger("UsedSuggestedAddress", {
					address: e.data.address,
					response: e.data.response,
					invoke: e.data.invoke,
					invokeFn: e.data.invokeFn,
					chosenCandidate: response.raw[$(this).data('index')]
				});
			});

			// User wants to revert to what they typed (forced accept)
			$('body').delegate(data.selectors.useOriginal, 'click', data, function (e) {
				$(this).parents('.smarty-popup').slideUp(defaults.speed, function () {
					$(this).parent('.smarty-ui').remove();
					$(this).remove();
				});

				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;
				trigger("OriginalInputSelected", e.data);
			});

			// User presses Esc key
			$(document).keyup(data, function (e) {
				if (e.keyCode == 27) { //Esc
					undelegateAllClicks(e.data.selectors);
					delete e.data.selectors;
					userAborted($('.smarty-popup.smarty-addr-' + e.data.address.id()), e);
					suppress(e);
				}
			});

			// User clicks "x" in corner or chooses to try a different address (same effect as Esc key)
			$('body').delegate(data.selectors.abort, 'click', data, function (e) {
				undelegateAllClicks(e.data.selectors);
				delete e.data.selectors;
				userAborted($(this).parents('.smarty-popup'), e);
			});
		};

		this.showInvalid = function (data) {
			if (!config.ui || !data.address.hasDomFields())
				return;

			var addr = data.address;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 320); // minimum width
			corners.height = Math.max(corners.height, 180); // minimum height
			if (config.enforceVerification) {
				corners.height -= 49;
			}

			var html = '<div class="smarty-ui" style="top: ' + corners.top + 'px; left: ' + corners.left + 'px; width: ' +
				corners.width + 'px; height: ' + corners.height + 'px;">' + '<div class="smarty-popup smarty-addr-' +
				addr.id() + '" style="width: ' + (corners.width - 6) + 'px; height: ' + (corners.height - 3) + 'px;">' +
				'<div class="smarty-popup-header smarty-popup-invalid-header">' + config.invalidMessage +
				'<a href="javascript:" class="smarty-popup-close smarty-abort" title="Cancel">x</a></div>' +
				'<div class="smarty-choice-list"><a href="javascript:" ' +
				'class="smarty-choice smarty-choice-abort smarty-abort">' + config.changeMessage + '</a></div>' +
				'<div class="smarty-choice-alt">';
			if (!config.enforceVerification) {
				html += '<a href="javascript:" class="smarty-choice smarty-choice-override">' +
					config.certifyMessage + '<br>(' + addr.toString() + ')</a>';
			}
			html += '</div></div></div>';

			$(html).hide().appendTo('body').show(defaults.speed);

			data.selectors = {
				useOriginal: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-choice-override ',
				abort: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-abort'
			};

			// Scroll to it if necessary
			if ($(document).scrollTop() > corners.top - 100 || $(document).scrollTop() < corners.top - $(window).height() + 100) {
				$('html, body').stop().animate({
					scrollTop: $('.smarty-popup.smarty-addr-' + addr.id()).offset().top - 100
				}, 500);
			}

			undelegateAllClicks(data.selectors.abort);
			// User rejects original input and agrees to double-check it
			$('body').delegate(data.selectors.abort, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("InvalidAddressRejected", e.data);
			});

			undelegateAllClicks(data.selectors.useOriginal);
			// User certifies that what they typed is correct
			$('body').delegate(data.selectors.useOriginal, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function (e) {
				if (e.keyCode == 27) { //Esc
					undelegateAllClicks(e.data.selectors);
					$(data.selectors.abort).click();
					userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				}
			});
		};

		this.showInvalidCountry = function (data) {
			if (!config.ui || !data.address.hasDomFields())
				return;

			var addr = data.address;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 250); // minimum width
			corners.height = Math.max(corners.height, 180); // minimum height
			if (config.enforceVerification) {
				corners.height -= 49;
			}

			var html = '<div class="smarty-ui" style="top: ' + corners.top + 'px; left: ' + corners.left + 'px; width: ' +
				corners.width + 'px; height: ' + corners.height + 'px;">' + '<div class="smarty-popup smarty-addr-' +
				addr.id() + '" style="width: ' + (corners.width - 6) + 'px; height: ' + (corners.height - 3) + 'px;">' +
				'<div class="smarty-popup-header smarty-popup-invalid-header">' + config.invalidCountryMessage +
				'<a href="javascript:" class="smarty-popup-close smarty-abort" title="Cancel">x</a></div>' +
				'<div class="smarty-choice-list"><a href="javascript:" ' +
				'class="smarty-choice smarty-choice-abort smarty-abort">' + config.changeMessage + '</a></div>' +
				'<div class="smarty-choice-alt">';
			if (!config.enforceVerification) {
				html += '<a href="javascript:" class="smarty-choice smarty-choice-override">' +
					config.certifyMessage + '<br>(' + addr.toString() + ')</a>';
			}
			html += '</div></div></div>';

			$(html).hide().appendTo('body').show(defaults.speed);

			data.selectors = {
				useOriginal: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-choice-override ',
				abort: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-abort'
			};

			// Scroll to it if necessary
			if ($(document).scrollTop() > corners.top - 100 || $(document).scrollTop() < corners.top - $(window).height() + 100) {
				$('html, body').stop().animate({
					scrollTop: $('.smarty-popup.smarty-addr-' + addr.id()).offset().top - 100
				}, 500);
			}

			undelegateAllClicks(data.selectors.abort);
			// User rejects original input and agrees to double-check it
			$('body').delegate(data.selectors.abort, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("InvalidAddressRejected", e.data);
			});

			undelegateAllClicks(data.selectors.useOriginal);
			// User certifies that what they typed is correct
			$('body').delegate(data.selectors.useOriginal, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function (e) {
				if (e.keyCode == 27) { //Esc
					undelegateAllClicks(e.data.selectors);
					$(data.selectors.abort).click();
					userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				}
			});
		};

		this.showMissingSecondary = function (data) {
			if (!config.ui || !data.address.hasDomFields())
				return;
			var addr = data.address;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 300);
			corners.height = Math.max(corners.height, 180);
			if (config.enforceVerification) {
				corners.height -= 49;
			}

			var html = '<div class="smarty-ui" style="top: ' + corners.top + 'px; left: ' + corners.left + 'px; width: ' +
				corners.width + 'px; height: ' + corners.height + 'px;">' + '<div class="smarty-popup smarty-addr-' +
				addr.id() + '" style="width: ' + (corners.width - 6) + 'px; height: ' + (corners.height - 3) + 'px;">' +
				'<div class="smarty-popup-header smarty-popup-missing-secondary-header">' + config.missingSecondaryMessage +
				'<a href="javascript:" class="smarty-popup-close smarty-abort" title="Cancel">x</a></div>' +
				'<div class="smarty-choice-list"><a href="javascript:" ' +
				'class="smarty-choice smarty-choice-abort smarty-abort">' + config.changeMessage + '</a></div>' +
				'<div class="smarty-choice-alt">';
			if (!config.enforceVerification) {
				html += '<a href="javascript:" class="smarty-choice smarty-choice-override">' +
					config.certifyMessage + '<br>(' + addr.toString() + ')</a>';
			}
			html += '</div>' + '</div></div>';

			$(html).hide().appendTo('body').show(defaults.speed);

			data.selectors = {
				useOriginal: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-choice-override ',
				abort: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-abort'
			};

			// Scroll to it if necessary
			if ($(document).scrollTop() > corners.top - 100 || $(document).scrollTop() < corners.top - $(window).height() + 100) {
				$('html, body').stop().animate({
					scrollTop: $('.smarty-popup.smarty-addr-' + addr.id()).offset().top - 100
				}, 500);
			}

			undelegateAllClicks(data.selectors.abort);
			// User rejects original input and agrees to double-check it
			$('body').delegate(data.selectors.abort, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("InvalidAddressRejected", e.data);
			});

			undelegateAllClicks(data.selectors.useOriginal);
			// User certifies that what they typed is correct
			$('body').delegate(data.selectors.useOriginal, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function (e) {
				if (e.keyCode == 27) { //Esc
					undelegateAllClicks(e.data.selectors);
					$(data.selectors.abort).click();
					userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				}
			});
		};

		this.showMissingInput = function (data) {
			if (!config.ui || !data.address.hasDomFields())
				return;

			var addr = data.address;
			var missing = data.address.missing;
			var response = data.response;
			var corners = addr.corners();
			corners.width = Math.max(corners.width, 300); // minimum width
			corners.height = Math.max(corners.height, 180); // minimum height
			if (config.enforceVerification) {
				corners.height -= 49;
			}

			var html = '<div class="smarty-ui" style="top: ' + corners.top + 'px; left: ' + corners.left + 'px; width: ' +
				corners.width + 'px; height: ' + corners.height + 'px;">' + '<div class="smarty-popup smarty-addr-' +
				addr.id() + '" style="width: ' + (corners.width - 6) + 'px; height: ' + (corners.height - 3) + 'px;">' +
				'<div class="smarty-popup-header smarty-popup-missing-input-header">' + config.missingInputMessage + missing +
				'<a href="javascript:" class="smarty-popup-close smarty-abort" title="Cancel">x</a></div>' +
				'<div class="smarty-choice-list"><a href="javascript:" ' +
				'class="smarty-choice smarty-choice-abort smarty-abort">' + config.changeMessage + '</a></div>' +
				'<div class="smarty-choice-alt">';
			if (!config.enforceVerification) {
				html += '<a href="javascript:" class="smarty-choice smarty-choice-override">' +
					config.certifyMessage + '<br>(' + addr.toString() + ')</a>';
			}
			html += '</div></div></div>';

			$(html).hide().appendTo('body').show(defaults.speed);

			data.selectors = {
				useOriginal: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-choice-override ',
				abort: '.smarty-popup.smarty-addr-' + addr.id() + ' .smarty-abort'
			};

			// Scroll to it if necessary
			if ($(document).scrollTop() > corners.top - 100 || $(document).scrollTop() < corners.top - $(window).height() + 100) {
				$('html, body').stop().animate({
					scrollTop: $('.smarty-popup.smarty-addr-' + addr.id()).offset().top - 100
				}, 500);
			}

			undelegateAllClicks(data.selectors.abort);
			// User rejects original input and agrees to double-check it
			$('body').delegate(data.selectors.abort, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("InvalidAddressRejected", e.data);
			});

			undelegateAllClicks(data.selectors.useOriginal);
			// User certifies that what they typed is correct
			$('body').delegate(data.selectors.useOriginal, 'click', data, function (e) {
				userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				delete e.data.selectors;
				trigger("OriginalInputSelected", e.data);
			});

			// User presses esc key
			$(document).keyup(data, function (e) {
				if (e.keyCode == 27) { //Esc
					undelegateAllClicks(e.data.selectors);
					$(data.selectors.abort).click();
					userAborted('.smarty-popup.smarty-addr-' + e.data.address.id(), e);
				}
			});
		};

	}

	var allStatesByName = {
		"ALABAMA": "AL",
		"ALASKA": "AK",
		"AMERICAN SAMOA": "AS",
		"ARIZONA": "AZ",
		"ARKANSAS": "AR",
		"CALIFORNIA": "CA",
		"COLORADO": "CO",
		"CONNECTICUT": "CT",
		"DELAWARE": "DE",
		"DISTRICT OF COLUMBIA": "DC",
		"FEDERATED STATES OF MICRONESIA": "FM",
		"FLORIDA": "FL",
		"GEORGIA": "GA",
		"GUAM": "GU",
		"HAWAII": "HI",
		"IDAHO": "ID",
		"ILLINOIS": "IL",
		"INDIANA": "IN",
		"IOWA": "IA",
		"KANSAS": "KS",
		"KENTUCKY": "KY",
		"LOUISIANA": "LA",
		"MAINE": "ME",
		"MARSHALL ISLANDS": "MH",
		"MARYLAND": "MD",
		"MASSACHUSETTS": "MA",
		"MICHIGAN": "MI",
		"MINNESOTA": "MN",
		"MISSISSIPPI": "MS",
		"MISSOURI": "MO",
		"MONTANA": "MT",
		"NEBRASKA": "NE",
		"NEVADA": "NV",
		"NEW HAMPSHIRE": "NH",
		"NEW JERSEY": "NJ",
		"NEW MEXICO": "NM",
		"NEW YORK": "NY",
		"NORTH CAROLINA": "NC",
		"NORTH DAKOTA": "ND",
		"NORTHERN MARIANA ISLANDS": "MP",
		"OHIO": "OH",
		"OKLAHOMA": "OK",
		"OREGON": "OR",
		"PALAU": "PW",
		"PENNSYLVANIA": "PA",
		"PUERTO RICO": "PR",
		"RHODE ISLAND": "RI",
		"SOUTH CAROLINA": "SC",
		"SOUTH DAKOTA": "SD",
		"TENNESSEE": "TN",
		"TEXAS": "TX",
		"UTAH": "UT",
		"VERMONT": "VT",
		"VIRGIN ISLANDS": "VI",
		"VIRGINIA": "VA",
		"WASHINGTON": "WA",
		"WEST VIRGINIA": "WV",
		"WISCONSIN": "WI",
		"WYOMING": "WY",
		"ARMED FORCES EUROPE, THE MIDDLE EAST, AND CANADA": "AE",
		"ARMED FORCES CANADA": "AE",
		"ARMED FORCES THE MIDDLE EAST": "AE",
		"ARMED FORCES EUROPE": "AE",
		"ARMED FORCES PACIFIC": "AP",
		"ARMED FORCES AMERICAS (EXCEPT CANADA)": "AA",
		"ARMED FORCES AMERICAS": "AA"
	};
	// this listing of stateNames has West Virginia before Virginia and the Virgin Islands (most specific to least specific)
	var stateNames = [
		"ALABAMA", "ALASKA", "AMERICAN SAMOA", "ARIZONA", "ARKANSAS", "CALIFORNIA", "COLORADO", "CONNECTICUT", "DELAWARE",
		"DISTRICT OF COLUMBIA", "FEDERATED STATES OF MICRONESIA", "FLORIDA", "GEORGIA", "GUAM", "HAWAII", "IDAHO",
		"ILLINOIS", "INDIANA", "IOWA", "KANSAS", "KENTUCKY", "LOUISIANA", "MAINE", "MARSHALL ISLANDS", "MARYLAND",
		"MASSACHUSETTS", "MICHIGAN", "MINNESOTA", "MISSISSIPPI", "MISSOURI", "MONTANA", "NEBRASKA", "NEVADA",
		"NEW HAMPSHIRE", "NEW JERSEY", "NEW MEXICO", "NEW YORK", "NORTH CAROLINA", "NORTH DAKOTA",
		"NORTHERN MARIANA ISLANDS", "OHIO", "OKLAHOMA", "OREGON", "PALAU", "PENNSYLVANIA", "PUERTO RICO", "RHODE ISLAND",
		"SOUTH CAROLINA", "SOUTH DAKOTA", "TENNESSEE", "TEXAS", "UTAH", "VERMONT", "WEST VIRGINIA", "VIRGINIA",
		"VIRGIN ISLANDS", "WASHINGTON", "WISCONSIN", "WYOMING", "ARMED FORCES EUROPE, THE MIDDLE EAST, AND CANADA",
		"ARMED FORCES CANADA", "ARMED FORCES THE MIDDLE EAST", "ARMED FORCES EUROPE", "ARMED FORCES PACIFIC",
		"ARMED FORCES AMERICAS (EXCEPT CANADA)", "ARMED FORCES AMERICAS"
	];
	var stateAbbreviations = [
		"AL", "AK", "AS", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FM", "FL", "GA", "GU", "HI", "ID", "IL", "IN", "IA",
		"KS", "KY", "LA", "ME", "MH", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
		"ND", "MP", "OH", "OK", "OR", "PW", "PA", "PR", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VI", "VA", "WA", "WV",
		"WI", "WY", "AE", "AP", "AA"
	];

	/*
	 Represents an address inputted by the user, whether it has been verified yet or not.
	 formObj must be a Form OBJECT, not a <form> tag... and the addressID is optional.
	 */
	function Address(domMap, formObj, addressID) {
		// PRIVATE MEMBERS //

		var self = this; // Pointer to self so that internal functions can reference its parent
		var fields; // Data values and references to DOM elements
		var id; // An ID by which to classify this address on the DOM

		var state = "accepted"; // Can be: "accepted" or "changed"
		// Example of a field:  street: { value: "123 main", dom: DOMElement, undo: "123 mai"}
		// Some of the above fields will only be mapped manually, not automatically.

		// Private method that actually changes the address. The keepState parameter is
		// used by the results of verification after an address is chosen; (or an "undo"
		// on a freeform address), otherwise an infinite loop of requests is executed
		// because the address keeps changing! (Set "suppressAutoVerify" to true when coming from the "Undo" link)
		var doSet = function (key, value, updateDomElement, keepState, sourceEvent, suppressAutoVerify) {
			if (!arrayContains(acceptableFields, key)) // Skip "id" and other unacceptable fields
				return false;

			if (!fields[key])
				fields[key] = {};

			if (typeof fields[key].dom !== "undefined" && fields[key].dom.tagName === "SELECT" && key !== "administrative_area") {
				value = fields[key].dom[fields[key].dom.selectedIndex].text.replace(/<|>/g, "");
			} else {
				value = value.replace(/<|>/g, ""); // prevents script injection attacks (< and > aren't in addresses, anyway)
			}

			var differentVal = fields[key].value != value;

			fields[key].undo = fields[key].value || "";
			fields[key].value = value;

			if (fields[key].dom && updateDomElement) {
				if (fields[key].dom.tagName === "INPUT") {
					$(fields[key].dom).val(value);
				} else if (fields[key].dom.tagName === "SELECT" && key === "administrative_area" && self.isDomestic()) {
					$(fields[key].dom).find("option").filter(function () {
						if ($(this).text().toUpperCase() === value) {
							return true;
						} else {
							for (state in allStatesByName) {
								if (allStatesByName[state] === value && state === $(this).text().toUpperCase()) {
									return true;
								}
							}
							return false;
						}
					}).attr('selected', true);
				}
			}

			var eventMeta = {
				sourceEvent: sourceEvent, // may be undefined
				field: key,
				address: self,
				value: value,
				suppressAutoVerification: suppressAutoVerify || false
			};

			if (differentVal && !keepState) {
				ui.unmarkAsValid(self);
				var uiTag = config.ui ? $('.smarty-ui .smarty-tag.smarty-addr-' + id) : undefined;
				if (config.target.indexOf("US") >= 0 && config.target.indexOf("INTERNATIONAL") < 0) {
					if (self.isDomestic()) {
						if (uiTag && !uiTag.is(':visible'))
							uiTag.show(); // Show checkmark tag if address is in US
						self.unaccept();
						trigger("AddressChanged", eventMeta);
					} else {
						if (uiTag && uiTag.is(':visible'))
							uiTag.hide(); // Hide checkmark tag if address is non-US
						self.accept({
							address: self
						}, false);
					}
				} else if (config.target.indexOf("INTERNATIONAL") >= 0 && config.target.indexOf("US") < 0) {
					if (uiTag && !uiTag.is(':visible'))
						uiTag.show(); // Show checkmark tag if address is in US
					self.unaccept();
					trigger("AddressChanged", eventMeta);
				} else if (config.target.indexOf("US") >= 0 && config.target.indexOf("INTERNATIONAL") >= 0) {
					if (uiTag && !uiTag.is(':visible'))
						uiTag.show(); // Show checkmark tag if address is in US
					self.unaccept();
					trigger("AddressChanged", eventMeta);
				}
			}

			return true;
		};

		// PUBLIC MEMBERS //

		this.form = formObj; // Reference to the parent form object (NOT THE DOM ELEMENT)
		this.verifyCount = 0; // Number of times this address was submitted for verification
		this.lastField; // The last field found (last to appear in the DOM) during mapping, or the order given
		this.active = true; // If true, verify the address. If false, pass-thru entirely.
		this.lastStreetInput = ""; // Used by autocomplete to detect changes

		// Constructor-esque functionality (save the fields in this address object)
		this.load = function (domMap, addressID) {
			fields = {};
			id = addressID ? addressID.replace(/[^a-z0-9_\-]/ig, '') : randomInt(1, 99999); // Strips non-selector-friendly characters

			if (typeof domMap === 'object') { // can be an actual map to DOM elements or just field/value data
				// Find the last field likely to appear on the DOM (used for UI attachments)
				this.lastField = domMap[Object.keys(domMap)[Object.keys(domMap).length - 1]];

				var isEmpty = true; // Whether the address has data in it (pre-populated) -- first assume it is empty.

				for (var prop in domMap) {
					if (!arrayContains(acceptableFields, prop)) // Skip "id" and any other unacceptable field
						continue;

					if (typeof domMap[prop] == "object" && domMap[prop].getBoundingClientRect().top > this.lastField.getBoundingClientRect().top) {
						this.lastField = domMap[prop];
					}

					var elem, val, elemArray, isData;
					try {
						elem = $(domMap[prop]);
						elemArray = elem.toArray();
						isData = elemArray ? elemArray.length == 0 : false;
					} catch (e) {
						isData = true;
					}

					if (isData) // Didn't match an HTML element, so treat it as an address string ("street1" data) instead
						val = domMap[prop] || "";
					else
						val = elem.val() || "";

					fields[prop] = {};
					fields[prop].value = val;
					fields[prop].undo = val;

					if (!isData) {
						if (config.debug) {
							elem.css('background', '#FFFFCC');
							elem.attr('placeholder', prop + ":" + id);
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
					// NOTE: When the user types a street, city, and state, then hits Enter without leaving
					// the state field, this change() event fires before the form is submitted, and if autoVerify is
					// on, the verification will not invoke form submit, because it didn't come from a form submit.
					// This is known behavior and is actually proper functioning in this uncommon edge case.
					!isData && $(domMap[prop]).change(data, function (e) {
						e.data.address.set(e.data.field, e.target.value, false, false, e, false);
					});
				}

				state = "changed";
			}
		};

		// Run the "constructor" to load up the address
		this.load(domMap, addressID);

		this.set = function (key, value, updateDomElement, keepState, sourceEvent, suppressAutoVerify) {
			if (typeof key === 'string' && arguments.length >= 2)
				return doSet(key, value, updateDomElement, keepState, sourceEvent, suppressAutoVerify);
			else if (typeof key === 'object') {
				var successful = true;
				for (var prop in key)
					successful = doSet(prop, key[prop], updateDomElement, keepState, sourceEvent, suppressAutoVerify) ? successful : false;
				return successful;
			}
		};

		this.replaceWith = function (resp, updateDomElement, e) {
			// Given the response from an API request associated with this address,
			// replace the values in the address... and if updateDomElement is true,
			// then change the values in the fields on the page accordingly.

			if (typeof resp === 'array' && resp.length > 0)
				resp = resp[0];

			// Sent via US api
			if (typeof resp.candidate_index != 'undefined') {
				if (self.isFreeform()) {
					var singleLineAddr = (resp.addressee ? resp.addressee + ", " : "") +
						(resp.delivery_line_1 ? resp.delivery_line_1 + ", " : "") +
						(resp.delivery_line_2 ? resp.delivery_line_2 + ", " : "") +
						(resp.components.urbanization ? resp.components.urbanization + ", " : "") +
						(resp.last_line ? resp.last_line : "");
					var fieldKey = "freeform";
					if (fields.address1) {
						fieldKey = "address1";
					}
					self.set(fieldKey, singleLineAddr, updateDomElement, true, e, false);
				} else {
					if (resp.addressee)
						self.set("organization", resp.addressee, updateDomElement, true, e, false);
					if (resp.delivery_line_1)
						self.set("address1", resp.delivery_line_1, updateDomElement, true, e, false);
					if (resp.delivery_line_2)
						self.set("address2", resp.delivery_line_2, updateDomElement, true, e, false); // Rarely used; must otherwise be blank.
					else
						self.set("address2", "", updateDomElement, true, e, false);
					if (resp.components.city_name)
						self.set("locality", resp.components.city_name, updateDomElement, true, e, false);
					if (resp.components.state_abbreviation)
						self.set("administrative_area", resp.components.state_abbreviation, updateDomElement, true, e, false);
					if (resp.components.zipcode && resp.components.plus4_code)
						self.set("postal_code", resp.components.zipcode + "-" + resp.components.plus4_code, updateDomElement, true, e, false);
				}
				self.set("address3", "", updateDomElement, true, e, false);
				self.set("address4", "", updateDomElement, true, e, false);
				self.set("country", "USA", updateDomElement, true, e, false);
			} else { // Sent via international API
				if (self.isFreeform()) {
					var singleLineAddr = (resp.organization ? resp.organization + ", " : "") +
						(resp.address1 ? resp.address1 : "") +
						(resp.address2 ? ", " + resp.address2 : "") +
						(resp.address3 ? ", " + resp.address3 : "") +
						(resp.address4 ? ", " + resp.address4 : "") +
						(resp.address5 ? ", " + resp.address5 : "") +
						(resp.address6 ? ", " + resp.address6 : "") +
						(resp.address7 ? ", " + resp.address7 : "") +
						(resp.address8 ? ", " + resp.address8 : "") +
						(resp.address9 ? ", " + resp.address9 : "") +
						(resp.address10 ? ", " + resp.address10 : "") +
						(resp.address11 ? ", " + resp.address11 : "") +
						(resp.address12 ? ", " + resp.address12 : "");
					var countryLine = resp.components.country_iso_3 ? resp.components.country_iso_3 : "";
					self.set("freeform", singleLineAddr, updateDomElement, true, e, false);
					self.set("country", countryLine, updateDomElement, true, e, false);
				} else {
					if (resp.organization)
						self.set("organization", resp.organization, updateDomElement, true, e, false);
					if (resp.components.locality)
						self.set("locality", resp.components.locality, updateDomElement, true, e, false);
					if (resp.components.administrative_area)
						self.set("administrative_area", resp.components.administrative_area, updateDomElement, true, e, false);
					if (resp.components.postal_code_short) {
						var fullPostalCode = resp.components.postal_code_short;
						if (resp.components.postal_code_extra)
							fullPostalCode = fullPostalCode + "-" + resp.components.postal_code_extra;
						self.set("postal_code", fullPostalCode, updateDomElement, true, e, false);
					}
					if (this.getDomFields().address4) {
						if (resp.address1)
							self.set("address1", resp.address1, updateDomElement, true, e, false);
						if (resp.address2)
							self.set("address2", resp.address2, updateDomElement, true, e, false);
						if (resp.address3)
							self.set("address3", resp.address3, updateDomElement, true, e, false);
						var addressLine4 = "";
						addressLine4 = addAddressLine(addressLine4, resp.address4, resp.address5);
						addressLine4 = addAddressLine(addressLine4, resp.address5, resp.address6);
						addressLine4 = addAddressLine(addressLine4, resp.address6, resp.address7);
						addressLine4 = addAddressLine(addressLine4, resp.address7, resp.address8);
						addressLine4 = addAddressLine(addressLine4, resp.address8, resp.address9);
						addressLine4 = addAddressLine(addressLine4, resp.address9, resp.address10);
						addressLine4 = addAddressLine(addressLine4, resp.address10, resp.address11);
						addressLine4 = addAddressLine(addressLine4, resp.address11, resp.address12);
						self.set("address4", addressLine4, updateDomElement, true, e, false);
					} else if (this.getDomFields().address3) {
						if (resp.address1)
							self.set("address1", resp.address1, updateDomElement, true, e, false);
						if (resp.address2)
							self.set("address2", resp.address2, updateDomElement, true, e, false);
						var addressLine3 = "";
						addressLine3 = addAddressLine(addressLine3, resp.address3, resp.address4);
						addressLine3 = addAddressLine(addressLine3, resp.address4, resp.address5);
						addressLine3 = addAddressLine(addressLine3, resp.address5, resp.address6);
						addressLine3 = addAddressLine(addressLine3, resp.address6, resp.address7);
						addressLine3 = addAddressLine(addressLine3, resp.address7, resp.address8);
						addressLine3 = addAddressLine(addressLine3, resp.address8, resp.address9);
						addressLine3 = addAddressLine(addressLine3, resp.address9, resp.address10);
						addressLine3 = addAddressLine(addressLine3, resp.address10, resp.address11);
						addressLine3 = addAddressLine(addressLine3, resp.address11, resp.address12);
						self.set("address3", addressLine3, updateDomElement, true, e, false);
					} else if (this.getDomFields().address2) {
						if (resp.address1)
							self.set("address1", resp.address1, updateDomElement, true, e, false);
						var addressLine2 = "";
						addressLine2 = addAddressLine(addressLine2, resp.address2, resp.address3);
						addressLine2 = addAddressLine(addressLine2, resp.address3, resp.address4);
						addressLine2 = addAddressLine(addressLine2, resp.address4, resp.address5);
						addressLine2 = addAddressLine(addressLine2, resp.address5, resp.address6);
						addressLine2 = addAddressLine(addressLine2, resp.address6, resp.address7);
						addressLine2 = addAddressLine(addressLine2, resp.address7, resp.address8);
						addressLine2 = addAddressLine(addressLine2, resp.address8, resp.address9);
						addressLine2 = addAddressLine(addressLine2, resp.address9, resp.address10);
						addressLine2 = addAddressLine(addressLine2, resp.address10, resp.address11);
						addressLine2 = addAddressLine(addressLine2, resp.address11, resp.address12);
						self.set("address2", addressLine2, updateDomElement, true, e, false);
					} else if (this.getDomFields().address1) {
						var addressLine1 = "";
						addressLine1 = addAddressLine(addressLine1, resp.address1, resp.address2);
						addressLine1 = addAddressLine(addressLine1, resp.address2, resp.address3);
						addressLine1 = addAddressLine(addressLine1, resp.address3, resp.address4);
						addressLine1 = addAddressLine(addressLine1, resp.address4, resp.address5);
						addressLine1 = addAddressLine(addressLine1, resp.address5, resp.address6);
						addressLine1 = addAddressLine(addressLine1, resp.address6, resp.address7);
						addressLine1 = addAddressLine(addressLine1, resp.address7, resp.address8);
						addressLine1 = addAddressLine(addressLine1, resp.address8, resp.address9);
						addressLine1 = addAddressLine(addressLine1, resp.address9, resp.address10);
						addressLine1 = addAddressLine(addressLine1, resp.address10, resp.address11);
						addressLine1 = addAddressLine(addressLine1, resp.address11, resp.address12);
						self.set("address1", addressLine1, updateDomElement, true, e, false);
					}
					if (resp.components.country_iso_3)
						self.set("country", resp.components.country_iso_3, updateDomElement, true, e, false);
				}
			}
		};

		var addAddressLine = function (fullLine, addressLine, nextAddressLine) {
			if (addressLine && nextAddressLine) {
				if (fullLine != "")
					fullLine += ", ";
				fullLine += addressLine;
			}
			return fullLine;
		};

		this.corners = function (lastField) {
			var corners = {};

			if (!lastField) {
				for (var prop in fields) {
					if (!fields[prop].dom || !$(fields[prop].dom).is(':visible'))
						continue;

					var dom = fields[prop].dom;
					var offset = $(dom).offset();
					offset.right = offset.left + $(dom).outerWidth(false);
					offset.bottom = offset.top + $(dom).outerHeight(false);

					corners.top = !corners.top ? offset.top : Math.min(corners.top, offset.top);
					corners.left = !corners.left ? offset.left : Math.min(corners.left, offset.left);
					corners.right = !corners.right ? offset.right : Math.max(corners.right, offset.right);
					corners.bottom = !corners.bottom ? offset.bottom : Math.max(corners.bottom, offset.bottom);
				}
			} else {
				var jqDom = $(self.lastField);
				corners = jqDom.offset();
				corners.right = corners.left + jqDom.outerWidth(false);
				corners.bottom = corners.top + jqDom.outerHeight(false);
			}

			corners.width = corners.right - corners.left;
			corners.height = corners.bottom - corners.top;

			return corners;
		};

		this.verify = function (invoke, invokeFn) {
			// Invoke contains the element to "click" on once we're all done, or is a user-defined callback function (may also be undefined)
			if (!self.enoughInput()) {
				return trigger("AddressWasMissingInput", {
					address: self,
					invoke: invoke,
					invokeFn: invokeFn,
					response: new Response([])
				});
			}

			ui.disableFields(self);
			self.verifyCount++;
			var addrData = self.toRequestIntl();
			var credentials = config.token ? "auth-id=" + encodeURIComponent(config.key) + "&auth-token=" +
			encodeURIComponent(config.token) : "auth-id=" + encodeURIComponent(config.key);
			var requestUrl = config.requestUrlInternational;
			var headers = {};
			if (self.isDomestic() && config.target.indexOf("US") >= 0) {
				requestUrl = config.requestUrlUS;
				addrData = self.toRequestUS();
				headers = {
					"X-Include-Invalid": config.xIncludeInvalid
				};
			}

			var iso = self.countryISO();
			if (typeof iso === "undefined") {
				return trigger("CountryWasInvalid", {
					address: self,
					response: new Response([]),
					invoke: invoke,
					invokeFn: invokeFn
				});
			} else {
				addrData.country = iso;
			}

			$.ajax({
					url: requestUrl + "?" + credentials +
					"&agent=" + encodeURIComponent("plugin:jquery@" + instance.version + "\|" + config.agent) +
					(config.debug ? "_debug" : ""),
					contentType: "jsonp",
					headers: headers,
					data: addrData,
					timeout: config.timeout
				})
				.done(function (response, statusText, xhr) {
					trigger("ResponseReceived", {
						address: self,
						response: new Response(response),
						invoke: invoke,
						invokeFn: invokeFn
					});
				})
				.fail(function (xhr, statusText) {
					trigger("RequestTimedOut", {
						address: self,
						status: statusText,
						invoke: invoke,
						invokeFn: invokeFn
					});
					self.verifyCount--; // Address verification didn't actually work, so don't count it
				});

			// Remember, the above callbacks happen later and this function is
			// executed immediately afterward, probably before a response is received.
			trigger("RequestSubmitted", {
				address: self
			});
		};

		this.enoughInput = function () {
			// Checks for state dropdown
			var stateText;
			if (fields.administrative_area) {
				stateText = fields.administrative_area.value;
				if (fields.administrative_area.dom !== undefined && fields.administrative_area.dom.length !== undefined) {
					if (fields.administrative_area.dom.selectedIndex < 1)
						stateText = "";
					else
						stateText = fields.administrative_area.dom.options[fields.administrative_area.dom.selectedIndex].text;
				}
			}

			self.missing = "(Missing ";
			var baseLength = self.missing.length;
			if (fields.country && !fields.country.value) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "country";
			}
			if (fields.freeform && !fields.freeform.value) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "freeform";
			}
			if (fields.address1 && !fields.address1.value) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "address1";
			}
			if (fields.postal_code && fields.locality && fields.administrative_area && !fields.postal_code.value && !fields.locality.value && !(stateText.length > 0)) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "postal code or locality and administrative area";
			} else if (fields.postal_code && fields.locality && fields.administrative_area && !fields.postal_code.value && fields.locality.value && !(stateText.length > 0)) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "postal code or administrative area";
			} else if (fields.postal_code && fields.locality && fields.administrative_area && !fields.postal_code.value && !fields.locality.value && stateText.length > 0) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "postal code or locality";
			} else if (fields.postal_code && !fields.locality && !fields.administrative_area && !fields.postal_code.value) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "postal code";
			} else if (!fields.postal_code && fields.locality && fields.administrative_area && (!fields.locality.value || !(stateText.length > 0))) {
				if (self.missing.length > baseLength)
					self.missing += ", ";
				self.missing += "locality and administrative area";
			}
			self.missing += ")";
			return (self.missing.length === baseLength + 1);
		};

		this.toRequestIntl = function () {
			var obj = {};
			if (fields.hasOwnProperty("freeform") &&
				fields.hasOwnProperty("address1") &&
				fields.hasOwnProperty("locality") &&
				fields.hasOwnProperty("administrative_area") &&
				fields.hasOwnProperty("postal_code")) {
				delete fields.address1;
				delete fields.locality;
				delete fields.administrative_area;
				delete fields.postal_code;
			}
			for (var key in fields) {
				var keyval = {};
				if (fields[key].dom && fields[key].dom.tagName === "SELECT") {
					keyval[key] = fields[key].dom[fields[key].dom.selectedIndex].text;
				} else {
					keyval[key] = fields[key].value.replace(/\r|\n/g, " "); // Line breaks to spaces
				}
				$.extend(obj, keyval);
			}
			obj.geocode = config.geocode;
			return obj;
		};

		this.toRequestUS = function () {
			var obj = {};
			if (fields.address1 && fields.address1.dom && fields.address1.dom.value) {
				obj.street = fields.address1.dom.value;
			} else if(fields.address1 && fields.address1.value) { // Covers a special case where the user calls .verify on the instance
				obj.street = fields.address1.value;
			}
			if (fields.address2 && fields.address2.dom && fields.address2.dom.value) {
				obj.street2 = fields.address2.dom.value;
			}
			if (fields.address3 && fields.address3.dom && fields.address3.dom.value) {
				if (typeof obj.street2 === 'undefined') {
					obj.street2 = fields.address3.dom.value;
				} else {
					obj.street2 = obj.street2 += ", " + fields.address3.dom.value;
				}
			}
			if (fields.address4 && fields.address4.dom && fields.address4.dom.value) {
				if (typeof obj.street2 === 'undefined') {
					obj.street2 = fields.address4.dom.value;
				} else {
					obj.street2 = obj.street2 += ", " + fields.address4.dom.value;
				}
			}
			if (fields.locality && fields.locality.dom) {
				if (fields.locality.dom.tagName === "SELECT") {
					obj.city = fields.locality.dom[fields.locality.dom.selectedIndex].text;
				} else {
					obj.city = fields.locality.dom.value;
				}
			}
			if (fields.administrative_area && fields.administrative_area.dom.value) {
				if (fields.administrative_area.dom.tagName === "SELECT") {
					obj.state = fields.administrative_area.dom[fields.administrative_area.dom.selectedIndex].text;
				} else {
					obj.state = fields.administrative_area.dom.value;
				}
			}
			if (fields.postal_code && fields.postal_code.dom.value) {
				obj.zipcode = fields.postal_code.dom.value;
			}
			if (fields.freeform && fields.freeform.dom.value) {
				obj.street = fields.freeform.dom.value;
			}
			obj.candidates = config.candidates;
			return obj;
		};

		this.toString = function () {
			if (fields.freeform) {
				return (fields.freeform ? fields.freeform.value + " " : "") + (fields.country ? fields.country.value : "");
			} else {
				var addrString = (fields.address1 ? fields.address1.value + " " : "") + (fields.address2 ? fields.address2.value + " " : "") +
				(fields.address3 ? fields.address3.value + " " : "") + (fields.address4 ? fields.address4.value + " " : "") +
				(fields.locality ? fields.locality.value + " " : "");
				if (fields.administrative_area) {
					if (fields.administrative_area.dom && fields.administrative_area.dom.tagName === "SELECT") {
						addrString += fields.administrative_area.dom[fields.administrative_area.dom.selectedIndex].text + " ";
					} else {
						addrString  += fields.administrative_area.dom.value + " ";
					}
				}
				addrString += (fields.postal_code ? fields.postal_code.value + " " : "") + (fields.country ? fields.country.value : "");
				return addrString;
			}
		};

		this.abort = function (event, keepAccept) {
			keepAccept = typeof keepAccept === 'undefined' ? false : keepAccept;
			if (!keepAccept)
				self.unaccept();
			delete self.form.processing;
			return suppress(event);
		};

		// Based on the properties in "fields," determines if this is a single-line address
		this.isFreeform = function () {
			return fields.freeform;
		};

		this.get = function (key) {
			return fields[key] ? fields[key].value : null
		};

		this.undo = function (updateDomElement) {
			updateDomElement = typeof updateDomElement === 'undefined' ? true : updateDomElement;
			for (var key in fields)
				this.set(key, fields[key].undo, updateDomElement, false, undefined, true);
		};

		this.accept = function (data, showValid) {
			showValid = typeof showValid === 'undefined' ? true : showValid;
			state = "accepted";
			ui.enableFields(self);
			if (showValid) // If user chooses original input or the request timed out, the address wasn't "verified"
				ui.markAsValid(self);
			trigger("AddressAccepted", data);
		};

		this.unaccept = function () {
			state = "changed";
			ui.unmarkAsValid(self);
			return self;
		};

		this.getUndoValue = function (key) {
			return fields[key].undo;
		};

		this.status = function () {
			return state;
		};

		this.getDomFields = function () {
			// Gets just the DOM elements for each field
			var obj = {};
			for (var prop in fields) {
				var ext = {};
				ext[prop] = fields[prop].dom;
				$.extend(obj, ext);
			}
			return obj;
		};

		this.hasDomFields = function () {
			for (var prop in fields)
				if (fields[prop].dom)
					return true;
		};

		this.isDomestic = function () {
			var countryValue = "";
			if (fields.country && fields.country.dom) {
				countryValue = fields.country.dom.value;
				if (fields.country.dom.selectedOptions)
					countryValue = fields.country.dom.selectedOptions[0].text;
			}
			countryValue = countryValue.toUpperCase().replace(/\.|\s|\(|\)|\\|\/|-/g, "");
			var usa = ["", "0", "1", "US", "USA", "USOFA", "USOFAMERICA", "AMERICAN", // 1 is AmeriCommerce
				"UNITEDSTATES", "UNITEDSTATESAMERICA", "UNITEDSTATESOFAMERICA", "AMERICA",
				"840", "223", "AMERICAUNITEDSTATES", "AMERICAUS", "AMERICAUSA", "UNITEDSTATESUS",
				"AMERICANSAMOA", "AMERIKASĀMOA", "AMERIKASAMOA", "ASM",
				"MICRONESIA", "FEDERALSTATESOFMICRONESIA", "FEDERATEDSTATESOFMICRONESIA", "FSM",
				"GUAM", "GM",
				"MARSHALLISLANDS", "MHL",
				"NORTHERNMARIANAISLANDS", "NMP",
				"PALAU", "REPUBLICOFPALAU", "BELAU", "PLW",
				"PUERTORICO", "COMMONWEALTHOFPUERTORICO", "PRI",
				"UNITEDSTATESVIRGINISLANDS", "VIR"
			]; // 840 is ISO: 3166; and 223 is some shopping carts
			return arrayContains(usa, countryValue) || fields.country.value == "-1";
		};

		this.countryISO = function () {
			if (config.target.indexOf("INTERNATIONAL") >= 0) {
				var countryValue = fields.country.dom.value;
				if (fields.country.dom.selectedOptions)
					countryValue = fields.country.dom.selectedOptions[0].text;
				countryValue = countryValue.toUpperCase().replace(/\.|\s|\(|\)|\\|\/|-|\'|\"|\,|ʻ|\&/g, "");
				var validCountries = {
					"AFGHANISTAN": "AFG",
					"AFGHANESTAN": "AFG",
					"ISLAMICREPUBLICOFAFGHANISTAN": "AFG",
					"AFG": "AFG",

					"ÅLANDISLANDS": "ALA",
					"ALANDISLANDS": "ALA",
					"AALAND": "ALA",
					"ALAND": "ALA",
					"ALA": "ALA",

					"ALBANIA": "ALB",
					"REPUBLICOFALBANIA": "ALB",
					"REPUBLIKAESHQIPËRISË": "ALB",
					"REPUBLIKAESHQIPERISE": "ALB",
					"SHQIPËRIA": "ALB",
					"SHQIPERIA": "ALB",
					"ALB": "ALB",

					"ALGERIA": "DZA",
					"PEOPLESDEMOCRATICREPUBLICOFALGERIA": "DZA",
					"ALJAZAIR": "DZA",
					"DZAYER": "DZA",
					"DZA": "DZA",

					"AMERICANSAMOA": "ASM",
					"AMERIKASĀMOA": "ASM",
					"AMERIKASAMOA": "ASM",
					"ASM": "ASM",

					"ANDORRA": "AND",
					"AND": "AND",

					"ANGOLA": "AGO",
					"AGO": "AGO",

					"ANGUILLA": "AIA",
					"AIA": "AIA",

					"ANTARCTICA": "ATA",
					"ATA": "ATA",

					"ANTIGUABARBUDA": "ATG",
					"ANTIQUA": "ATG",
					"BARBUDA": "ATG",
					"ANTIQUAANDBARBUDA": "ATG",
					"ATG": "ATG",

					"ARGENTINA": "ARG",
					"ARGENTINEREPUBLIC": "ARG",
					"LAARGENTINA": "ARG",
					"ARG": "ARG",

					"ARMENIA": "ARM",
					"HAYASTAN": "ARM",
					"HAYASDAN": "ARM",
					"HAÏASDAN": "ARM",
					"HAIASDAN": "ARM",
					"REPUBLICOFARMENIA": "ARM",
					"ARM": "ARM",

					"ARUBA": "ABW",
					"ABW": "ABW",

					"AUSTRALIA": "AUS",
					"COMMONWEALTHOFAUSTRALIA": "AUS",
					"AUS": "AUS",

					"AUSTRIA": "AUT",
					"OSTERREICH": "AUT",
					"OESTERREICH": "AUT",
					"ÖSTERREICH": "AUT",
					"REPUBLICOFAUSTRIA": "AUT",
					"AUT": "AUT",

					"AZERBAIJAN": "AZE",
					"REPUBLICOFAZERBAIJAN": "AZE",
					"AZƏRBAYCANRESPUBLIKASI": "AZE",
					"AZERBAIJANREPUBLIC": "AZE",
					"AZARBAYCAN": "AZE",
					"AZƏRBAYCAN": "AZE",
					"AZERBAYCAN": "AZE",
					"AZE": "AZE",

					"BAHAMAS": "BHS",
					"BHS": "BHS",

					"BAHRAIN": "BHR",
					"KINGDOMOFBAHRAIN": "BHR",
					"MAMLAKATALBAḤRAYN": "BHR",
					"MAMLAKATALBAHRAYN": "BHR",
					"ALBAḤRAYN": "BHR",
					"BHR": "BHR",

					"BANGLADESH": "BGD",
					"PEOPLESREPUBLICOFBANGLADESH": "BGD",
					"BGD": "BGD",

					"BARBADOS": "BRB",
					"BRB": "BRB",

					"BELARUS": "BLR",
					"REPUBLICOFBELARUS": "BLR",
					"GUDIJA": "BLR",
					"BYELARUS": "BLR",
					"BIELARUŚ": "BLR",
					"BIELARUS": "BLR",
					"BLR": "BLR",

					"BELGIUM": "BEL",
					"BELGIQUE": "BEL",
					"BELGIEN": "BEL",
					"BELGIE": "BEL",
					"BELGIË": "BEL",
					"BEL": "BEL",

					"BELIZE": "BLZ",
					"BLZ": "BLZ",

					"BENIN": "BEN",
					"REPUBLICOFBENIN": "BEN",
					"RÉPUBLIQUEDUBÉNIN": "BEN",
					"REPUBLIQUEDEBENIN": "BEN",
					"BÉNIN": "BEN",
					"BEN": "BEN",

					"BERMUDA": "BMU",
					"BMU": "BMU",

					"BHUTAN": "BTN",
					"DRUKYUL": "BTN",
					"BTN": "BTN",

					"BOLIVIA": "BOL",
					"BULIWYA": "BOL",
					"WULIWYA": "BOL",
					"VOLÍVIA": "BOL",
					"VOLIVIA": "BOL",
					"BOL": "BOL",

					"BONAIRESINTEUSTATIUSANDSABA": "BES",
					"BONAIRESINTEUSTATIUSSABA": "BES",
					"BONAIRE": "BES",
					"SINTEUSTATIUS": "BES",
					"SABA": "BES",
					"SINTEUSTATIUSANDSABA": "BES",
					"BES": "BES",

					"BOSNIAHERZEGOVINA": "BIH",
					"BOSNIA": "BIH",
					"HERZEGOVINA": "BIH",
					"BOSNAIHERCEGOVINA": "BIH",
					"BIH": "BIH",

					"BOTSWANA": "BWA",
					"REPUBLICOFBOTSWANA": "BWA",
					"BWA": "BWA",

					"BRAZIL": "BRA",
					"FEDERATIVEREPUBLICOFBRAZIL": "BRA",
					"BRASIL": "BRA",
					"BRA": "BRA",

					"BRITISHINDIANOCEANTERRITORY": "IOT",
					"IOT": "IOT",

					"BRITISHVIRGINISLANDS": "VGV",
					"VGV": "VGV",

					"BRUNEIDARUSSALAM": "BRN",
					"NEGARABRUNEIDARUSSALAM": "BRN",
					"BRN": "BRN",

					"BULGARIA": "BGR",
					"BULGARIYA": "BGR",
					"BĂLGARIJA": "BGR",
					"BALGARIJA": "BGR",
					"BGR": "BGR",

					"BURKINAFASO": "BFA",
					"BFA": "BFA",

					"BURUNDI": "BDI",
					"BDI": "BDI",

					"CAMBODIA": "KHM",
					"KINGDOMOFCAMBODIA": "KHM",
					"ROYAUMEDUCAMBODGE": "KHM",
					"KAMPUCHEA": "KHM",
					"KHM": "KHM",

					"CAMEROON": "CMR",
					"CAMEROUN": "CMR",
					"CMR": "CMR",

					"CANADA": "CAN",
					"CAN": "CAN",

					"CAPEVERDEISLANDS": "CPV",
					"CAPEVERDE": "CPV",
					"CABOVERDE": "CPV",
					"CPV": "CPV",

					"CAYMANISLANDS": "CYM",
					"CYM": "CYM",

					"CENTRALAFRICANREPUBLIC": "CAF",
					"UBANGISHARI": "CAF",
					"RÉPUBLIQUECENTRAFRICAINE": "CAF",
					"REPUBLIQUECENTRAFRICAINE": "CAF",
					"CENTRALAFRICANEMPIRE": "CAF",
					"KÖDÖRÖSÊSETÎBÊAFRÎKA": "CAF",
					"KODOROSESETIBEAFRIKA": "CAF",
					"CAF": "CAF",

					"CHAD": "TCD",
					"TCHAD": "TCD",
					"TŠĀD": "TCD",
					"TSAD": "TCD",
					"TCD": "TCD",

					"CHILE": "CHL",
					"CHL": "CHL",

					"CHINA": "CHN",
					"PEOPLESREPUBLICOFCHINA": "CHN",
					"ZHONGHUAPEOPLESREPUBLIC": "CHN",
					"ZHONGGUO": "CHN",
					"ZHONGHUA": "CHN",
					"ZHŌNGGUÓ": "CHN",
					"CHN": "CHN",

					"CHRISTMASISLAND": "CXR",
					"CXR": "CXR",

					"COCOSKEELINGISLANDS": "CCK",
					"COCOSISALNDS": "CCK",
					"COCOSISLAND": "CCK",
					"KEELINGISLANDS": "CCK",
					"KEELINGSISLAND": "CCK",
					"CCK": "CCK",

					"COLOMBIA": "COL",
					"COLÓMBIA": "COL",
					"COL": "COL",

					"COMOROS": "COM",
					"COMORES": "COM",
					"KOMORI": "COM",
					"JUZURALQAMAR": "COM",
					"COM": "COM",

					"CONGO": "COD",
					"RÉPUBLIQUEDÉMOCRATIQUEDUCONGO": "COD",
					"REPUBLIQUEDEMOCRATIQUEDUCONGO": "COD",
					"THEDEMOCRATICREPUBLICOFCONGO": "COD",
					"THEDEMOCRATICREPUBLICOFTHECONGO": "COD",
					"REPUBLICOFCONGO": "COD",
					"REPUBLICOFTHECONGO": "COD",
					"RÉPUBLIQUEDUCONGO": "COD",
					"REPUBLIQUEDUCONGO": "COD",
					"COD": "COD",

					"COOKISLANDS": "COK",
					"COK": "COK",

					"COSTARICA": "CRI",
					"CRI": "CRI",

					"CROATIA": "HRV",
					"HRVATSKA": "HRV",
					"HRVAŠKA": "HRV",
					"HRVASKA": "HRV",
					"HRV": "HRV",

					"CUBA": "CUB",
					"CUB": "CUB",

					"CURACAO": "CUW",
					"CUW": "CUW",

					"CYPRUS": "CYP",
					"REPUBLICOFCYPRUS": "CYP",
					"ΚΎΠΡΟΣ": "CYP",
					"KIBRIS": "CYP",
					"CYP": "CYP",

					"CZECHREPUBLIC": "CZE",
					"ČESKÁREPUBLIKA": "CZE",
					"CESKAREPUBLIKA": "CZE",
					"ČESKO": "CZE",
					"CESKO": "CZE",
					"CZE": "CZE",

					"DENMARK": "DNK",
					"KINGDOMOFDENMARK": "DNK",
					"KONGERIGETDANMARK": "DNK",
					"DANMARK": "DNK",
					"DNK": "DNK",

					"DJIBOUTI": "DGI",
					"REPUBLICOFDJIBOUTI": "DGI",
					"RÉPUBLIQUEDEDJIBOUTI": "DGI",
					"REPUBLIQUEDEDJIBOUTI": "DGI",
					"DGI": "DGI",

					"DOMINICA": "DMA",
					"DMA": "DMA",

					"DOMINICANREPUBLIC": "DOM",
					"REPÚBLICADOMINICANA": "DOM",
					"REPUBLICADOMINICANA": "DOM",
					"DOM": "DOM",

					"ECUADOR": "ECU",
					"ECU": "ECU",

					"EGYPT": "EGY",
					"ARABREPUBLICOFEGYPT": "EGY",
					"MIṢR": "EGY",
					"MISR": "EGY",
					"MEṢR": "EGY",
					"MESR": "EGY",
					"KĪMI": "EGY",
					"KIMI": "EGY",
					"EGY": "EGY",

					"ELSALVADOR": "SLV",
					"SLV": "SLV",

					"EQUITORIALGUINEA": "GNQ",
					"GUINEAECUATORIAL": "GNQ",
					"GNQ": "GNQ",

					"ERITREA": "ERI",
					"HAGEREERTRA": "ERI",
					"ERI": "ERI",

					"ESTONIA": "EST",
					"EESTI": "EST",
					"EESTIVABARIIK": "EST",
					"ESTLAND": "EST",
					"IGAUNIJA": "EST",
					"VIRO": "EST",
					"EST": "EST",

					"ETHIOPIA": "ETH",
					"FEDERALDEMOCRATICREPUBLICOFETHIOPIA": "ETH",
					"ITYOPIYA": "ETH",
					"ETH": "ETH",

					"FALKLANDISLANDS": "FLK",
					"ISLASMALVINAS": "FLK",
					"FLK": "FLK",

					"FAROEISLANDS": "FRO",
					"FØROYAR": "FRO",
					"FOROYAR": "FRO",
					"FÆRØERNE": "FRO",
					"FAEROERNE": "FRO",
					"FRO": "FRO",

					"FIJI": "FJI",
					"FJI": "FJI",

					"FINLAND": "FIN",
					"REPUBLICOFFINLAND": "FIN",
					"SUOMI": "FIN",
					"SUOMENTASAVALTA": "FIN",
					"FIN": "FIN",

					"FRANCE": "FRA",
					"RÉPUBLIQUEFRANÇAISE": "FRA",
					"REPUBLIQUEFRANCAISE": "FRA",
					"FRENCHREPUBLIC": "FRA",
					"LAFRANCE": "FRA",
					"FRA": "FRA",

					"FRENCHGUIANA": "GUF",
					"GUYANE": "GUF",
					"GUF": "GUF",

					"FRENCHPOLYNESIA": "PYF",
					"POLYNÉSIEFRANÇAISE": "PYF",
					"POLYNESIEFRANCAISE": "PYF",
					"PYF": "PYF",

					"FRENCHSOUTHERNTERRITORIES": "ATF",
					"TERRESAUSTRALESETANTARCTIQUESFRANÇAISES": "ATF",
					"TERRESAUSTRALESETANTARCTIQUESFRANCAISES": "ATF",
					"ATF": "ATF",

					"GABON": "GAB",
					"GAB": "GAB",

					"GAMBIA": "GMB",
					"GMB": "GMB",

					"GEORGIA": "GEO",
					"SAKARTVELO": "GEO",
					"GEO": "GEO",

					"GERMANY": "DEU",
					"FEDERALREPUBLICOFGERMANY": "DEU",
					"UNDESREPUBLIKDEUTSCHLAND": "DEU",
					"DEUTSCHLAND": "DEU",
					"BRD": "DEU",
					"DEU": "DEU",

					"GHANA": "GHA",
					"GHA": "GHA",

					"GIBRALTAR": "GIB",
					"GIB": "GIB",

					"GREECE": "GRC",
					"ELLENICREPUBLIC": "GRC",
					"ELLAS": "GRC",
					"ΕΛΛΆΔΑ": "GRC",
					"ELLADA": "GRC",
					"GRC": "GRC",

					"GREENLAND": "GRL",
					"GRØNLAND": "GRL",
					"GRONLAND": "GRL",
					"KALAALLITNUNAAT": "GRL",
					"GRL": "GRL",

					"GRENADA": "GRD",
					"GRD": "GRD",

					"GUADELOUPE": "GLP",
					"GLP": "GLP",

					"GUAM": "GUM",
					"GUM": "GUM",

					"GUATEMALA": "GTM",
					"GTM": "GTM",

					"GUERNSEY": "GGY",
					"GGY": "GGY",

					"GUINEA": "GIN",
					"REPUBLICOFGUINEA": "GIN",
					"GUINEE": "GIN",
					"GIN": "GIN",

					"GUINEABISSAU": "GNB",
					"REPUBLICOFGUINEABISSAU": "GNB",
					"GUINEBISSAU": "GNB",
					"GNB": "GNB",

					"GUYANA": "GUY",
					"GUY": "GUY",

					"HAITI": "HTI",
					"HTI": "HTI",

					"HOLYSEE": "VAT",
					"STATUSCIVITATISVATICANÆ": "VAT",
					"THEVATICAN": "VAT",
					"VATICANCITYSTATE": "VAT",
					"VATICANCITY": "VAT",
					"VATICAN": "VAT",
					"VAT": "VAT",

					"HONDURAS": "HND",
					"HND": "HND",

					"HONGKONG": "HKG",
					"XIANGGANG": "HKG",
					"HKG": "HKG",

					"HUNGARY": "HUN",
					"REPUBLICOFHUNGARY": "HUN",
					"MAGYARORSZÁG": "HUN",
					"MAGYARORSZAG": "HUN",
					"HUN": "HUN",

					"ICELAND": "ISL",
					"REPUBLICOFICELAND": "ISL",
					"ÍSLAND": "ISL",
					"ISLAND": "ISL",
					"LYOVELDIOISLAND": "ISL",
					"ISL": "ISL",

					"INDIA": "IND",
					"REPUBLICOFINDIA": "IND",
					"BHĀRAT": "IND",
					"BHARAT": "IND",
					"BHĀRATGAṆARĀJYA": "IND",
					"BHARATGANARAJYA": "IND",
					"IND": "IND",

					"INDONESIA": "IDN",
					"INDONESIË": "IDN",
					"INDONESIE": "IDN",
					"IDN": "IDN",

					"IRAN": "IRN",
					"ISLAMICREPUBLICOFIRAN": "IRN",
					"IRN": "IRN",

					"IRAQ": "IRG",
					"IRQ": "IRG",

					"IRELAND": "IRL",
					"REPUBLICOFIRELAND": "IRL",
					"ÉIRE": "IRL",
					"EIRE": "IRL",
					"IRL": "IRL",

					"ISLEOFMAN": "IMN",
					"IMN": "IMN",

					"ISRAEL": "ISR",
					"STATEOFISRAEL": "ISR",
					"מדינת ישראל": "ISR",
					"DAWLATALHAYAWANAT": "ISR",
					"DAWLATISRAIL": "ISR",
					"YISRAEL": "ISR",
					"ISR": "ISR",

					"ITALY": "ITA",
					"REPUBBLICAITALIANA": "ITA",
					"ITALIA": "ITA",
					"ITA": "ITA",

					"IVORYCOAST": "CIV",
					"CÔTEDIVOIRE": "CIV",
					"COTEDIVOIRE": "CIV",
					"REPUBLICOFCÔTEDIVOIRE": "CIV",
					"REPUBLICOFCOTEDIVOIRE": "CIV",
					"CIV": "CIV",

					"JAMAICA": "JAM",
					"XAMAYCA": "JAM",
					"JAM": "JAM",

					"JAPAN": "JPN",
					"NIPPON": "JPN",
					"JPN": "JPN",

					"JERSEY": "JEY",
					"JEY": "JEY",

					"JORDAN": "JOR",
					"HASHEMITEKINGDOMOFJORDAN": "JOR",
					"ALURDUNN": "JOR",
					"JOR": "JOR",

					"KAZAKHSTAN": "KAZ",
					"REPUBLICOFKAZAKHSTAN": "KAZ",
					"ҚАЗАҚСТАНРЕСПУБЛИКАСЫ": "KAZ",
					"ҚАЗАҚСТАНQAZAQSTAN": "KAZ",
					"KAZ": "KAZ",

					"KENYA": "KEN",
					"REPUBLICOFKENYA": "KEN",
					"JAMHURIYAKENYA": "KEN",
					"KEN": "KEN",

					"KIRIBATI": "KIR",
					"REPUBLICOFKIRIBATI": "KIR",
					"KIR": "KIR",

					"KOREAREPUBLICOF": "KOR",
					"SOUTHKOREA": "KOR",
					"REPUBLICOFKOREA": "KOR",
					"DAEHANMINGUK": "KOR",
					"KOR": "KOR",

					"KUWAIT": "KWT",
					"ALKUWAYT": "KWT",
					"STATEOFKUWAIT": "KWT",
					"KWT": "KWT",

					"KYRGYZSTAN": "KGZ",
					"KYRGYZRESPUBLIKASY": "KGZ",
					"KGZ": "KGZ",

					"LAOS": "LAO",
					"LAO": "LAO",

					"LATVIA": "LVA",
					"LATVIJA": "LVA",
					"LETTLAND": "LVA",
					"LETLAND": "LVA",
					"LVA": "LVA",

					"LEBANON": "LBN",
					"THELEBANESEREPUBLIC": "LBN",
					"ALJUMHURIYYAALLUBNANIYYA": "LBN",
					"LEBNAN": "LBN",
					"LUBNAN": "LBN",
					"LBN": "LBN",

					"LESOTHO": "LSO",
					"KINGDOMOFLESOTHO": "LSO",
					"LSO": "LSO",

					"LIBERIA": "LBR",
					"LBR": "LBR",

					"LIBYA": "LBY",
					"LIBIYAH": "LBY",
					"LBY": "LBY",

					"LIECHTENSTEIN": "LIE",
					"LIE": "LIE",

					"LITHUANIA": "LTU",
					"LIETUVA": "LTU",
					"ЛИТВА": "LTU",
					"LTU": "LTU",

					"LUXEMBOURG": "LUX",
					"LETZEBUERG": "LUX",
					"LUX": "LUX",

					"MACAO": "MAC",
					"MACAU": "MAC",
					"AOMEN": "MAC",
					"MAC": "MAC",

					"MACEDONIA": "MKD",
					"МАКЕДОНИЈА": "MKD",
					"MAKEDONIJA": "MKD",
					"MKD": "MKD",

					"MADAGASCAR": "MDG",
					"MDG": "MDG",

					"MALAWI": "MWI",
					"REPUBLICOFMALAWI": "MWI",
					"MWI": "MWI",

					"MALAYSIA": "MYS",
					"PERSEKUTUANMALAYSIA": "MYS",
					"FEDERATIONOFMALAYSIA": "MYS",
					"MYS": "MYS",

					"MALDIVES": "MDV",
					"DHIVEHIRAAJJE": "MDV",
					"REPUBLICOFMALDIVES": "MDV",
					"MDV": "MDV",

					"MALI": "MLI",
					"MLI": "MLI",

					"MALTA": "MLT",
					"MLT": "MLT",

					"MARSHALLISLANDS": "MHL",
					"MHL": "MHL",

					"MARTINIQUE": "MTQ",
					"MTQ": "MTQ",

					"MAURITANIA": "MRT",
					"ISLAMICREPUBLICOFMAURITANIA": "MRT",
					"MURITANIYAH": "MRT",
					"MRT": "MRT",

					"MAURITIUS": "MUS",
					"MUS": "MUS",

					"MAYOTTE": "MYT",
					"MYT": "MYT",

					"MEXICO": "MEX",
					"ESTADOSUNIDOSMEXICANOS": "MEX",
					"MÉXICO": "MEX",
					"MEX": "MEX",

					"MICRONESIA": "FSM",
					"FEDERALSTATESOFMICRONESIA": "FSM",
					"FSM": "FSM",

					"MOLDOVA": "MDA",
					"REPUBLICOFMOLDOVA": "MDA",
					"REPUBLICAMOLDOVA": "MDA",
					"MDA": "MDA",

					"MONACO": "MCO",
					"MCO": "MCO",

					"MONGOLIA": "MNG",
					"MONGOLULS": "MNG",
					"MNG": "MNG",

					"MONTENEGRO": "MNE",
					"CRNAGORA": "MNE",
					"MNE": "MNE",

					"MONTSERRAT": "MSR",
					"MSR": "MSR",

					"MOROCCO": "MAR",
					"KINGDOMOFMOROCCO": "MAR",
					"ALMAMLAKAALMAGHRIBIYA": "MAR",
					"MAGHREB": "MAR",
					"ALMAĠRIB": "MAR",
					"ALMAGRIB": "MAR",
					"MAR": "MAR",

					"MOZAMBIQUE": "MOZ",
					"MOCAMBIQUE": "MOZ",
					"MOZ": "MOZ",

					"MYANMAR": "MMR",
					"REPUBLICOFTHEUNIONOFMYANMAR": "MMR",
					"MYANMANAINGNGANDAW": "MMR",
					"MYANMA": "MMR",
					"BURMA": "MMR",
					"MMR": "MMR",

					"NAMIBIA": "NAM",
					"NAM": "NAM",

					"NAURU": "NRU",
					"NRU": "NRU",

					"NEPAL": "NPL",
					"NĒPĀLA": "NPL",
					"NEPALA": "NPL",
					"NPL": "NPL",

					"NETHERLANDSANTILLES": "ANT",
					"NEDERLANDSEANTILLEN": "ANT",
					"ANT": "ANT",

					"NETHERLANDS": "NLD",
					"THENETHERLANDS": "NLD",
					"HOLLAND": "NLD",
					"NEDERLAND": "NLD",
					"NLD": "NLD",

					"NEWCALEDONIA": "NCL",
					"CALEDONIA": "NCL",
					"NOUVELLECALÉDONIE": "NCL",
					"NOUVELLECALEDONIE": "NCL",
					"NCL": "NCL",

					"NEWZEALAND": "NZL",
					"AOTEAROA": "NZL",
					"NZL": "NZL",

					"NICARAGUA": "NIC",
					"NIC": "NIC",

					"NIGER": "NER",
					"NER": "NER",

					"NIGERIA": "NGA",
					"NGA": "NGA",

					"NIUE": "NIU",
					"NIU": "NIU",

					"NORFOLKISLAND": "NFK",
					"NFK": "NFK",

					"NORTHKOREA": "PRK",
					"DEMOCRATICPEOPLESREPUBLICOFKOREA": "PRK",
					"CHOSONMINJUJUUIINMINKONGHWAGUK": "PRK",
					"PRK": "PRK",

					"NORTHERNMARIANAISLANDS": "NMP",
					"NMP": "NMP",

					"NORWAY": "NOR",
					"NORGE": "NOR",
					"NOREG": "NOR",
					"NOR": "NOR",

					"OMAN": "OMN",
					"SALṬANATUMĀN": "OMN",
					"SALTANATUMAN": "OMN",
					"OMN": "OMN",

					"PAKISTAN": "PAK",
					"ISLAMICREPUBLICOFPAKISTAN": "PAK",
					"PAK": "PAK",

					"PALAU": "PLW",
					"REPUBLICOFPALAU": "PLW",
					"BELAU": "PLW",
					"PLW": "PLW",

					"PALESTINIANTERRITORY": "PSE",
					"FILASTIN": "PSE",
					"PSE": "PSE",

					"PANAMA": "PAN",
					"PAN": "PAN",

					"PAPUANEWGUINEA": "PNG",
					"PAPUANIUGINI": "PNG",
					"PNG": "PNG",

					"PARAGUAY": "PRY",
					"PRY": "PRY",

					"PERU": "PER",
					"REPUBLICOFPERU": "PER",
					"PERUVIANREPUBLIC": "PER",
					"REPÚBLICADELPERÚ": "PER",
					"REPuBLICADELPERu": "PER",
					"PERÚ": "PER",
					"PER": "PER",

					"PHILIPPINES": "PHL",
					"REPUBLICOFTHEPHILIPPINES": "PHL",
					"REPÚBLIKANGPILIPINAS": "PHL",
					"REPUBLIKANGPILIPINAS": "PHL",
					"PILIPINAS": "PHL",
					"FILIPINAS": "PHL",
					"PHL": "PHL",

					"PITCAIRNISLAND": "PCN",
					"PCN": "PCN",

					"POLAND": "POL",
					"REPUBLICOFPOLAND": "POL",
					"RZECZPOSPOLITAPOLSKA": "POL",
					"POLSKA": "POL",
					"POL": "POL",

					"PORTUGAL": "PRT",
					"PORTUGUESEREPUBLIC": "PRT",
					"LUSITANIA": "PRT",
					"PRT": "PRT",

					"PUERTORICO": "PRI",
					"COMMONWEALTHOFPUERTORICO": "PRI",
					"PRI": "PRI",

					"QATAR": "QAT",
					"DAWLATQAṬAR": "QAT",
					"DAWLATQATAR": "QAT",
					"QAṬAR": "QAT",
					"QAT": "QAT",

					"RÉUNION": "REU",
					"REUNIONISLAND": "REU",
					"ILEDELARÉUNION": "REU",
					"ILEDELAREUNION": "REU",
					"REU": "REU",

					"ROMANIA": "ROU",
					"ROMÂNIA": "ROU",
					"ROU": "ROU",

					"RUSSIA": "RUS",
					"RUSSIANFEDERATION": "RUS",
					"РОССИЯ": "RUS",
					"ROSSIYA": "RUS",
					"RUS": "RUS",

					"RWANDA": "RWA",
					"REPUBLICOFRWANDA": "RWA",
					"RWA": "RWA",

					"SAINTBARTHÉLEMY": "BLM",
					"SAINTBARTHELEMY": "BLM",
					"BLM": "BLM",

					"SAINTHELENA": "SHN",
					"SHN": "SHN",

					"SAINTKITTSANDNEVIS": "KNA",
					"SAINTKITTSNEVIS": "KNA",
					"FEDERATIONOFSAINTKITTSANDNEVIS": "KNA",
					"FEDERATIONOFSAINTKITTSNEVIS": "KNA",
					"SAINTCHRISTOPHERANDNEVIS": "KNA",
					"SAINTCHRISTOPHERNEVIS": "KNA",
					"KNA": "KNA",

					"SAINTLUCIA": "LCA",
					"LCA": "LCA",

					"SAINTMARTIN": "MAF",
					"MAF": "MAF",

					"SAINTPIERREANDMIQUELON": "SPM",
					"SAINTPIERREMIQUELON": "SPM",
					"SPM": "SPM",

					"SAINTVINCENTANDTHEGRENADINES": "VCT",
					"SAINTVINCENTTHEGRENADINES": "VCT",
					"VCT": "VCT",

					"SAMOA": "WSM",
					"WSM": "WSM",

					"SANMARINO": "SMR",
					"SMR": "SMR",

					"SAOTOMEANDPRINCIPE": "STP",
					"SAOTOMEPRINCIPE": "STP",
					"SÃOTOMÉANDPRÍNCIPE": "STP",
					"SÃOTOMÉPRÍNCIPE": "STP",
					"DEMOCRATICREPUBLICOFSÃOTOMÉANDPRÍNCIPE": "STP",
					"DEMOCRATICREPUBLICOFSAOTOMEANDPRINCIPE": "STP",
					"DEMOCRATICREPUBLICOFSÃOTOMÉPRÍNCIPE": "STP",
					"DEMOCRATICREPUBLICOFSAOTOMEPRINCIPE": "STP",
					"STP": "STP",

					"SAUDIARABIA": "SAU",
					"KINGDOMOFSAUDIARABIA": "SAU",
					"SAUDIA": "SAU",
					"ALARABIYAHASSUUDIYAH": "SAU",
					"SAU": "SAU",

					"SENEGAL": "SEN",
					"SEN": "SEN",

					"SERBIA": "SRB",
					"REPUBLICOFSERVIA": "SRB",
					"YUGOSLAVIA": "SRB",
					"SRBIJA": "SRB",
					"SRB": "SRB",

					"SEYCHELLES": "SYC",
					"SYC": "SYC",

					"SIERRALEONE": "SLE",
					"SLE": "SLE",

					"SINGAPORE": "SGP",
					"REPUBLICOFSINGAPORE": "SGP",
					"SINGAPURA": "SGP",
					"SGP": "SGP",

					"SINTMAARTENDUTCH": "SXM",
					"SINTMAARTEN": "SXM",
					"SXM": "SXM",

					"SLOVAKIA": "SVK",
					"SLOVAKREPUBLIC": "SVK",
					"SLOVENSKO": "SVK",
					"SVK": "SVK",

					"SLOVENIA": "SVN",
					"SLOVENIJA": "SVN",
					"SVN": "SVN",

					"SOLOMONISLANDS": "SLB",
					"SLB": "SLB",

					"SOMALIA": "SOM",
					"SOM": "SOM",

					"SOUTHAFRICA": "ZAF",
					"SUIDAFRIKA": "ZAF",
					"ZAF": "ZAF",

					"SOUTHGEORGIAANDTHESOUTHSANDWICHISLANDS": "SGS",
					"SOUTHGEORGIATHESOUTHSANDWICHISLANDS": "SGS",
					"SGS": "SGS",

					"SOUTHSUDAN": "SSD",
					"SSD": "SSD",

					"SPAIN": "ESP",
					"ESPAÑA": "ESP",
					"ESPANA": "ESP",
					"ESP": "ESP",

					"SRILANKA": "LKA",
					"CEYLON": "LKA",
					"DEMOCRATICSOCIALISTREPUBLICOFSRILANKA": "LKA",
					"LKA": "LKA",

					"SUDAN": "SDN",
					"REPUBLICOFTHESUDAN": "SDN",
					"THESUDAN": "SDN",
					"SDN": "SDN",

					"SURINAME": "SUR",
					"DUTCHGUIANA": "SUR",
					"REPUBLICOFSURINAME": "SUR",
					"SUR": "SUR",

					"SVALBARDANDJANMAYENISLANDS": "SJM",
					"SVALBARDJANMAYENISLANDS": "SJM",
					"SJM": "SJM",

					"SWAZILAND": "SWZ",
					"SWZ": "SWZ",

					"SWEDEN": "SWE",
					"SVERIGE": "SWE",
					"KINGDOMOFSWEDEN": "SWE",
					"SWE": "SWE",

					"SWITZERLAND": "CHE",
					"SWISSCONFEDERATION": "CHE",
					"SCHWEIZ": "CHE",
					"SUISSE": "CHE",
					"SVIZZERA": "CHE",
					"SVIZRA": "CHE",
					"CHE": "CHE",

					"SYRIA": "SYR",
					"SŪRIYĀ": "SYR",
					"SURIYA": "SYR",
					"SŪRĪYAH": "SYR",
					"SURIYAH": "SYR",
					"SYR": "SYR",

					"TAIWAN": "TWN",
					"REPUBLICOFCHINA": "TWN",
					"FORMOSA": "TWN",
					"TAIPEI": "TWN",
					"中華民國": "TWN",
					"臺灣": "TWN",
					"TWN": "TWN",

					"TAJIKISTAN": "TJK",
					"TJK": "TJK",

					"TANZANIA": "TZA",
					"UNITEDREPUBLICOFTANZANIA": "TZA",
					"TANGANYIKAANDZANZIBAR": "TZA",
					"TANGANYIKAZANZIBAR": "TZA",
					"TZA": "TZA",

					"THAILAND": "THA",
					"SIAM": "THA",
					"KINGDOMOFTHAILAND": "THA",
					"ประเทศไทย": "THA",
					"PRATHETTHAI": "THA",
					"THA": "THA",

					"TIMORLESTE": "TLP",
					"TIMOR": "TLP",
					"TLP": "TLP",

					"TOGO": "TGO",
					"TOGOLESEREPUBLIC": "TGO",
					"RÉPUBLIQUETOGOLAISE": "TGO",
					"REPUBLIQUETOGOLAISE": "TGO",
					"TGO": "TGO",

					"TOKELAU": "TKL",
					"TKL": "TKL",

					"TONGA": "TON",
					"TON": "TON",

					"TRINIDADANDTOBAGO": "TTO",
					"TRINIDADTOBAGO": "TTO",
					"REPUBLICOFTRINIDADANDTOBAGO": "TTO",
					"REPUBLICOFTRINIDADTOBAGO": "TTO",
					"TRINBAGO": "TTO",
					"TRINIDAD": "TTO",
					"TOBAGO": "TTO",
					"TTO": "TTO",

					"TUNISIA": "TUN",
					"REPUBLICOFTUNISIA": "TUN",
					"الجمهورية التونسية": "TUN",
					"TŪNIS": "TUN",
					"TUN": "TUN",

					"TURKEY": "TUR",
					"TÜRKIYE": "TUR",
					"TURKIYE": "TUR",
					"REPUBLICOFTURKEY": "TUR",
					"TUR": "TUR",

					"TURKMENISTAN": "TKM",
					"TKM": "TKM",

					"TURKSANDCAICOSISLANDS": "TCA",
					"TURKSCAICOSISLANDS": "TCA",
					"TCA": "TCA",

					"TUVALU": "TUV",
					"ELLICEISLANDS": "TUV",
					"TUV": "TUV",

					"UGANDA": "UGA",
					"REPUBLICOFUGANDA": "UGA",
					"UGA": "UGA",

					"UKRAINE": "UKR",
					"UKRAINA": "UKR",
					"УКРАЇНА": "UKR",
					"YКРАIНА": "UKR",
					"UKR": "UKR",

					"UNITEDARABEMIRATES": "ARE",
					"DAWLATALIMĀRĀTALARABĪYAHALMUTTAḤIDAH": "ARE",
					"DAWLATALIMARATALARABIYAHALMUTTAHIDAH": "ARE",
					"UAE": "ARE",
					"EMIRATES": "ARE",
					"ARE": "ARE",

					"UNITEDKINGDOM": "GBR",
					"GREATBRITAIN": "GBR",
					"ENGLAND": "GBR",
					"UK": "GBR",
					"WALES": "GBR",
					"SCOTLAND": "GBR",
					"NORTHERNIRELAND": "GBR",
					"BRITAIN": "GBR",
					"GBR": "GBR",

					"UNITEDSTATESMINOROUTLYINGISLANDS": "UMI",
					"UMI": "UMI",

					"UNITEDSTATESVIRGINISLANDS": "VIR",
					"VIR": "VIR",

					"UNITEDSTATES": "USA",
					"THEUNITEDSTATES": "USA",
					"UNITEDSTATESOFAMERICA": "USA",
					"AMERICA": "USA",
					"THECOLONIES": "USA",
					"USA": "USA",

					"URUGUAY": "URY",
					"EASTERNREPUBLICOFURUGUAY": "URY",
					"REPÚBLICAORIENTALDELURUGUAY": "URY",
					"REPUBLICAORIENTALDELURUGUAY": "URY",
					"URY": "URY",

					"UZBEKISTAN": "UZB",
					"REPUBLICOFUZBEKISTAN": "UZB",
					"OZBEKISTONRESPUBLIKASI": "UZB",
					"UZB": "UZB",

					"VANUATU": "VUT",
					"VUT": "VUT",

					"VENEZUELA": "VEN",
					"VEN": "VEN",

					"VIETNAM": "VNM",
					"SOCIALISTREPUBLICOFVIETNAM": "VNM",
					"VIỆTNAM": "VNM",
					"VNM": "VNM",

					"WALLISANDFUTUNAISLANDS": "WLF",
					"WALLISFUTUNAISLANDS": "WLF",
					"WALLISETFUTUNA": "WLF",
					"WLF": "WLF",

					"WESTERNSAHARA": "ESH",
					"AṢṢAḤRĀALGHARBĪYAH": "ESH",
					"ASSAHRAALGHARBIYAH": "ESH",
					"ESH": "ESH",

					"YEMEN": "YEM",
					"REPUBLICOFYEMEN": "YEM",
					"ALYAMAN": "YEM",
					"YEM": "YEM",

					"ZAMBIA": "ZMB",
					"NORTHERNRHODESIA": "ZMB",
					"REPUBLICOFZAMBIA": "ZMB",
					"ZMB": "ZMB",

					"ZIMBABWE": "ZWE",
					"RHODESIA": "ZWE",
					"REPUBLICOFRHODESIA": "ZWE",
					"REPUBLICOFZIMBABWE": "ZWE",
					"SOUTHERNRHODESIA": "ZWE",
					"ZWE": "ZWE"
				};
				return validCountries[countryValue];
			} else {
				return "USA";
			}
		};

		this.autocompleteVisible = function () {
			return config.ui && config.autocomplete && $('.smarty-autocomplete.smarty-addr-' + self.id()).is(':visible');
		};

		this.id = function () {
			return id;
		};
	}

	/*
	 Represents a <form> tag which contains mapped fields.
	 */
	function Form(domElement) {
		this.addresses = [];
		this.dom = domElement;

		this.activeAddressesNotAccepted = function () {
			var addrs = [];
			for (var i = 0; i < this.addresses.length; i++) {
				var addr = this.addresses[i];
				if (addr.status() != "accepted" && addr.active)
					addrs.push(addr);
			}
			return addrs;
		};

		this.allActiveAddressesAccepted = function () {
			return this.activeAddressesNotAccepted().length == 0;
		};
	}

	/*
	 Wraps output from the API in an easier-to-handle way
	 */

	function Response(json) {
		// PRIVATE MEMBERS //

		var checkBounds = function (idx) {
			// Ensures that an index is within the number of candidates
			if (idx >= json.length || idx < 0) {
				if (json.length == 0)
					throw new Error("Candidate index is out of bounds (no candidates returned; requested " + idx + ")");
				else
					throw new Error("Candidate index is out of bounds (" + json.length + " candidates; indicies 0 through " +
						(json.length - 1) + " available; requested " + idx + ")");
			}
		};

		var maybeDefault = function (idx) {
			// Assigns index to 0, the default value, if no value is passed in
			return typeof idx === 'undefined' ? 0 : idx;
		};

		// PUBLIC-FACING MEMBERS //

		this.raw = json;
		this.length = json.length;

		this.isValid = function () {
			return (this.length == 1 &&
			(this.raw[0].analysis.verification_status == "Verified" ||
			(typeof this.raw[0].analysis.dpv_match_code != 'undefined' && this.raw[0].analysis.dpv_match_code != "N")));
		};

		this.isInvalid = function () {
			return (this.length == 0 ||
			(this.length == 1 &&
			(this.raw[0].analysis.verification_status == "None" ||
			this.raw[0].analysis.verification_status == "Partial" ||
			this.raw[0].analysis.dpv_match_code == "N" ||
			(typeof this.raw[0].analysis.verification_status === 'undefined' &&
			typeof this.raw[0].analysis.dpv_match_code === 'undefined'))));
		};

		this.isAmbiguous = function () {
			return this.length > 1;
		};

		this.isMissingSecondary = function (idx) {
			idx = maybeDefault(idx);
			checkBounds(idx);
			return (this.raw[idx].analysis.dpv_footnotes && this.raw[idx].analysis.dpv_footnotes.indexOf("N1") > -1) ||
				(this.raw[idx].analysis.dpv_footnotes && this.raw[idx].analysis.dpv_footnotes.indexOf("R1") > -1) ||
				(this.raw[idx].analysis.footnotes && this.raw[idx].analysis.footnotes.indexOf("H#") > -1);
		};
	}

	/*
	 *	EVENT HANDLER "SHTUFF"
	 */

	/*
	 Called every time a LiveAddress event is raised.
	 This allows us to maintain the binding even if the
	 callback function is changed later.
	 "event" is the actual event object, and
	 "data" is anything extra to pass to the event handler.
	 */
	function HandleEvent(event, data) {
		var handler = instance.events[event.type];
		if (handler)
			handler(event, data);
	}

	// Submits a form by calling `click` on a button element or `submit` on a form element
	var submitForm = function (invokeOn, invokeFunction) {
		if (invokeOn && typeof invokeOn !== 'function' && invokeFunction) {
			if (invokeFunction == "click") {
				setTimeout(function () {
					$(invokeOn).click(); // Very particular: we MUST fire the native 'click' event!
				}, 5);
			} else if (invokeFunction == "submit")
				$(invokeOn).submit(); // For submit(), we have to use jQuery's, so that all its submit handlers fire.
		}
	};

	/*
	 *	MISCELLANEOUS
	 */

	function arrayContains(array, subject) {
		// See if an array contains a particular value
		for (var i in array)
			if (array[i] === subject) return true;
		return false;
	}

	function randomInt(min, max) {
		// Generate a random integer between min and max
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function lowercase(string) {
		// Return an empty string if not defined, or a lowercase string with '[]' stripped.
		return string ? string.toLowerCase().replace('[]', '') : '';
	}

	function trigger(eventType, metadata) {
		// Raise an event (in our case, a custom event)
		$(document).triggerHandler(eventType, metadata);
	}

	function bind(eventType) {
		// Bind a custom handler to an event
		$(document).bind(eventType, HandleEvent);
	}

	function suppress(event) {
		// Used to prevent form submits, and stop other events if needed
		if (!event) return false;
		if (event.preventDefault) event.preventDefault();
		if (event.stopPropagation) event.stopPropagation();
		if (event.stopImmediatePropagation) event.stopImmediatePropagation();
		event.cancelBubble = true;
		return false;
	}

});
