/**
	@fileoverview Utilities for loading resources (especially CSS
	files).
*/

/**
	<p>In order to decouple resources from each other, HTML pages 
	and Javascript source files, we separate resources into namespaces.
	
	<p>The HTML page, whose author knows the relative URL needed to
	load each resource, initialises the namespace paths like this:
	
	<pre>
com.qwirx.loader.setNamespacePath('com.qwirx.freebase', '.');
com.qwirx.loader.setNamespacePath('com.qwirx.grid', '../com.qwirx.grid');
com.qwirx.loader.setNamespacePath('goog.closure', '../closure-library/closure/goog/css');
	</pre>	
	
	Then Javascript modules can load resources like this:
	
	<pre>
com.qwirx.loader.loadCss('com.qwirx.freebase', 'freebase.css');
	</pre>
	
	Which loads the resource <code>freebase.css</code> from the
	namespace <code>com.qwirx.freebase</code>. Simple, but avoids
	hard-coding paths in Javascript modules.
	
	<p>Only the HTML page author can know the relative paths from that
	page to the modules (resources) which she has assembled.
	
	@todo It should be possible to make a namespace relative to another
	namespace, for example the URL for <code>com.qwirx.loader</code>
	should default to the URL for <code>com.qwirx</code>, plus a
	suffix of <code>/loader</code>.

	@namespace
	@name com.qwirx.loader	
*/

/**
*/
goog.provide('com.qwirx.loader');

/**
 * Namespaces are paths to resources (CSS files), relative to the
 * URL of the current HTML document, so they should be configured
 * in that HTML document. Configured by
 * {@link com.qwirx.loader.setNamespacePath} and used by
 * {@link com.qwirx.loader.loadCss}.
 */
com.qwirx.loader.namespaces = {};

/**
	Loads (adds to the current HTML document) a CSS stylesheet file,
	whose name is relative to the path associated with the specified
	namespace (module), with the .css extension.

	<p>For example:
	
	<pre>
		com.qwirx.loader.loadCss('com.qwirx.freebase', 'freebase.css');
	</pre>
 */
com.qwirx.loader.loadCss = function(/* varargs */)
{
	var len = arguments.length;
	var namespace = arguments[0];
	var basePath = com.qwirx.loader.namespaces[namespace];
	
	for (var i = 1; i < len; i++)
	{
		var sheet = arguments[i];
		if (! window[sheet])
		{
			sheetUrl = basePath + '/' + sheet;
			linkTag = goog.dom.createDom(goog.dom.TagName.LINK,
				{rel: 'stylesheet', href: sheetUrl});
			goog.dom.appendChild(document.head, linkTag);
			window[sheet] = sheetUrl;
		}
	};
};

/**
	Sets the path (URL) used to load a particular namespace.
	For example:
	<pre>
		com.qwirx.loader.setNamespacePath('com.qwirx.grid',
			'../com.qwirx.grid');
	</pre>		
*/
com.qwirx.loader.setNamespacePath = function(namespace, path)
{
	com.qwirx.loader.namespaces[namespace] = path;
};

