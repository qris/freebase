goog.provide('com.qwirx.loader');

/**
 * Namespaces are paths to resources (CSS files), relative to the
 * URL of the current HTML document, so they should be configured
 * in that HTML document.
 */
com.qwirx.loader.namespaces = {};

/**
 * Loads (adds to the current HTML document) a CSS stylesheet file,
 * whose name is relative to the path associated with the specified
 * namespace (module), with the .css extension.
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

com.qwirx.loader.setNamespacePath = function(namespace, path)
{
	com.qwirx.loader.namespaces[namespace] = path;
};

