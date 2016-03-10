LiveAddress API jQuery Plugin
==================================

Add real-time, plug-and-play, free address verification and autocomplete to your website. Powered by
[SmartyStreets](http://smartystreets.com). Drop a couple lines of code into your webpage
and... voilà! Instant address validation.

This plugin should be thought of as merely a framework. It is designed for only basic functionality. Just like
jQuery is a framework, if you want to do something custom, you'll have to code it yourself. Fortunately,
it's pretty easy (see the documentation, link below) and we have
[a small repository of some customizations](https://github.com/smartystreets/jquery.liveaddress/tree/master/customizations)
our customers have used before that you can copy+paste into your page, then tweak for your situation.


Full documentation
-----------------------
https://smartystreets.com/docs/plugin

Working Examples
-----------------------
http://smartystreets.github.io/jquery.liveaddress/


Quick Start
-----------------------

1. Be sure jQuery is brought into your page early on. If you don't already have it, something like this should do the trick:
```<script type="text/javascript" src="//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js"></script>```
2. Bring the LiveAddress API jQuery Plugin onto your page:
```<script type="text/javascript" src="//d79i1fxsrar4t.cloudfront.net/jquery.liveaddress/3.0/jquery.liveaddress.min.js"></script>```
3. Initialize the plugin with an HTML key from your account:
```<script type="text/javascript">jQuery.LiveAddress("HtmlKey");</script>```

That's it! Ensure it works before using it on a live site. SmartyStreets
assumes no responsibility if something goes wrong on your web page. Enable debug mode
to help you find problems, and if necessary, map the fields manually. See the
[full documentation](http://smartystreets.com/kb/liveaddress-api/website-forms) for details.


Node.js
-----------------------
If you prefer a local copy via Node.js, ```npm install liveaddress```


Troubleshooting
-----------------------
https://smartystreets.com/docs/plugin/troubleshooting



Test Runner File
-----------------------

The [index.html](https://github.com/smartystreets/jquery.liveaddress/blob/master/index.html) file provided can be used
as a convenient, isolated environment in which to test different scenarios. Knock yourself out! Better
in testing than in production, right?


Support
-----------------------

Other than maintaining production versions of this plugin and its documentation, we do not offer any further support on
this script. We welcome your feedback and will consider it to improve the plugin, but this project is open source
and we strongly encourage you to contribute to it. As SmartyStreets specializes in address verification and is not a
programming firm, we cannot offer programming or specific implementation help.

We are happy to see customers fork the project and improve upon it, and we will gladly review any pull requests that
come our way.



Updates
-----------------------

If you use the `<script>` tags we recommend here or in the documentation, you'll automatically get all updates on the minor
release indicated by the URL. For example, a URL to the script with "2.2" in it means you'll always get the latest stable
2.2 version automatically.

This GitHub repository is where the plugin is being actively developed. It will have the latest "bleeding-edge" features
and fixes, but also bugs. So while you can link to the raw file here on GitHub instead, it is more prone to bugs and
breaking changes. It also may jump to a new minor or major version without warning, potentially breaking your implementation.
Only the latest production version is actively maintained.



Bug Reports
-----------------------

Preferably, contribute to the project by forking or submitting a pull request, along with a description of the problem
you were experiencing. This is the fastest and surest way to have a bug fixed.

The slower way to get help would be to contact us, since we'll have to be able to reproduce the error before we
can fix it. If you contact us, be sure to include details such as browser, jQuery version, and a bare-bones page that
clearly reproduces the behavior you're experiencing. Strip the page of all other Javascript except for what is absolutely
necessary (usually just jQuery and the plugin's source code). Using a resource such as [jsFiddle](http://jsfiddle.net) can be useful for
reproducing bugs in their true character. You can also use the test driver file, index.html, (described above) to reproduce
errors and report those to us. Or, submit a pull request with the fix and we'll review it.


Forks
-----------------------
These are user-contributed changes to the plugin that you may find useful. Please note that we cannot support or endorse them, but we do link to them as a courtesy since you may find them helpful.

- [The cerealcable fork](https://github.com/cerealcable/jquery.liveaddress/blob/13185e2b1548fd886f99a0f2822230ea18e90213/src/jquery.liveaddress.js) puts secondary data into the second street field, if there is one. (Just be aware that those addresses are no longer in the standardized format.)


License (GPLv3)
-----------------------

All source code, resources, and other contents herein are copyright (c) 2012-2015 SmartyStreets and are distributed
under [Version 3 of the GNU General Public License](http://opensource.org/licenses/GPL-3.0).

If you require alternative licensing to embed this code into your product, please contact us to discuss your requirements.

Disclaimer
-----------------------

While the plugin provides basic address verification functionality, custom behavior will require
[custom Javascript code](https://github.com/smartystreets/jquery.liveaddress/tree/master/customizations).
Because SmartyStreets is an address verification company, not a team of contract programmers, we must assume that each website
owner has, is, or can get a developer who is familiar with Javascript.

We encourage anyone to contribute to the project and improve upon it.

We are happy to fix bugs, so follow the instructions contained in this file to troubleshoot, then
submit a proper bug report. Only the latest production version is actively maintained. Only modern browsers are supported.
By using this plugin, you assume full responsibility for the behavior and functionality of your web page and agree to the
other terms described in this repository and on [the SmartyStreets web site](https://smartystreets.com/docs/plugin).
