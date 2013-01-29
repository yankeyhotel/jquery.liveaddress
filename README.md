LiveAddress API jQuery Plugin
==================================

Add real-time, plug-and-play, free address verification to your website. Powered by
[SmartyStreets](http://smartystreets.com). Drop a couple lines of code into your webpage
and... voilà! Instant address validation.


Full documentation
-----------------------
http://smartystreets.com/kb/liveaddress-api/website-forms



Quick Start
-----------------------

1. Be sure jQuery is brought into your page early on. If you don't already have it, something like this should do the trick:
```<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script>```
2. Bring the LiveAddress API jQuery Plugin onto your page:
```<script type="text/javascript" src="//d79i1fxsrar4t.cloudfront.net/jquery.liveaddress/2.3/jquery.liveaddress.min.js"></script>```
3. Initialize the plugin with an HTML key from your account:
```<script type="text/javascript">jQuery.LiveAddress("YOUR_HTML_KEY");</script>```

That's it! Ensure it works before using it on a live site. SmartyStreets
assumes no responsibility if something goes wrong on your web page. Enable debug mode
to help you find problems, and if necessary, map the fields manually. See the
[full documentation](http://smartystreets.com/kb/liveaddress-api/website-forms) for details.



Test Runner File
-----------------------

The [index.html](https://github.com/smartystreets/jquery.liveaddress/blob/master/index.html) file provided can be used
as a convenient, mostly-isolated environment in which to test different scenarios. Knock yourself out! Better
in testing than in production, right?



Updates
-----------------------

If you use the `<script>` tags we recommend here or in the documentation, you'll automatically get all updates on the minor
release indicated by the URL. For example, a URL to the script with "2.2" in it means you'll always get the latest stable
2.2 version automatically.

This GitHub repository is where the plugin is being actively developed. It will have the latest "bleeding-edge" features
and fixes, but also bugs. So while you can link to the raw file here on GitHub instead, it is more prone to bugs and
breaking changes. It also may jump to a new minor or major version without warning, potentially breaking your implementation.



Contributing & Bug Reports
-----------------------

Feel free to submit a pull request to this repository, open an issue, or contact us if your question is more localized.
We'll help when we can, but SmartyStreets has no control over the source code of other web sites. If you can isolate
an issue and display it on [jsFiddle](http://jsfiddle.net) for us, it will help us diagnose any problems more quickly.



License (GPLv3)
-----------------------

All source code, resources, and other contents herein are copyright (c) 2012-2013 SmartyStreets and are distributed
under [Version 3 of the GNU General Public License](http://opensource.org/licenses/GPL-3.0).